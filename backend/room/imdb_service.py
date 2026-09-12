import re
from datetime import timedelta
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import ImdbWatchlistConnection, RoomEntry, RoomEvent

GRAPHQL_URL = "https://api.graphql.imdb.com/"
DEFAULT_HASH = "bd16984d2dec070e278187d502321c785bdf3d7771b172cc4b72002a4a6ce715"
MAX_TITLES = 12_000
ERROR_CODES = {
    "private_or_missing",
    "rate_limited",
    "unavailable",
    "response_changed",
    "too_large",
    "timed_out",
    "interrupted",
}


class WatchlistError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def normalize_url(raw):
    if not isinstance(raw, str) or len(raw.strip()) > 512:
        raise WatchlistError("response_changed")
    try:
        url = urlparse(raw.strip())
    except ValueError as error:
        raise WatchlistError("response_changed") from error
    if (
        url.scheme not in {"http", "https"}
        or url.hostname not in {"www.imdb.com", "imdb.com", "m.imdb.com"}
        or url.username
        or url.password
        or url.port
    ):
        raise WatchlistError("response_changed")
    match = re.fullmatch(r"/user/(ur\d{1,20}|p\.[A-Za-z0-9_-]{1,128})/watchlist/?", url.path)
    if not match:
        raise WatchlistError("response_changed")
    profile = match.group(1)
    return f"https://www.imdb.com/user/{profile}/watchlist/", profile


def text(value, maximum):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise WatchlistError("response_changed")
    return value.strip()


def edge_film(edge):
    try:
        item = edge["listItem"]
        imdb_id = text(item["id"], 14)
        if not re.fullmatch(r"tt\d{7,12}", imdb_id):
            raise WatchlistError("response_changed")
        title = text(item["titleText"]["text"], 240)
        title_type = item.get("titleType", {}).get("text", "") if item.get("titleType") else ""
        year = item.get("releaseYear", {}).get("year") if item.get("releaseYear") else None
        if year is not None and (not isinstance(year, int) or not 1800 <= year <= 9999):
            raise WatchlistError("response_changed")
        creator = ""
        for group in item.get("principalCreditsV2", []) or []:
            grouping = group.get("grouping", {}) if isinstance(group, dict) else {}
            if (
                grouping.get("text") not in {"Director", "Directors"}
                and grouping.get("groupingId")
                != "amzn1.imdb.concept.name_credit_category.ace5cb4c-8708-4238-9542-04641e7c8171"
            ):
                continue
            names = []
            for credit in group.get("credits", []) or []:
                name = credit.get("name", {}).get("nameText", {}).get("text")
                if isinstance(name, str):
                    names.append(name)
            creator = ", ".join(names)[:180]
            break
        return {
            "imdbId": imdb_id,
            "title": title,
            "creator": creator,
            "format": " · ".join(str(value) for value in (title_type, year) if value),
            "note": "",
        }
    except (KeyError, TypeError, AttributeError):
        raise WatchlistError("response_changed") from None


def query(payload):
    try:
        response = requests.post(
            GRAPHQL_URL,
            json=payload,
            headers={"x-imdb-client-name": "imdb-web-next"},
            timeout=12,
            allow_redirects=False,
        )
    except requests.RequestException as error:
        raise WatchlistError("unavailable") from error
    if response.status_code == 429:
        raise WatchlistError("rate_limited")
    if response.status_code in {401, 403}:
        raise WatchlistError("private_or_missing")
    if not response.ok:
        raise WatchlistError("unavailable")
    try:
        data = response.json()
    except ValueError as error:
        raise WatchlistError("response_changed") from error
    if data.get("errors"):
        codes = {
            str(item.get("extensions", {}).get("code"))
            for item in data["errors"]
            if isinstance(item, dict)
        }
        raise WatchlistError(
            "private_or_missing"
            if codes & {"FORBIDDEN", "RESOURCE_NOT_FOUND"}
            else "response_changed"
        )
    if not isinstance(data.get("data"), dict):
        raise WatchlistError("response_changed")
    return data["data"]


def read_public_watchlist(raw_url):
    if not settings.IMDB_WATCHLIST_ENABLED:
        raise WatchlistError("unavailable")
    source_url, profile = normalize_url(raw_url)
    user_id = profile
    if profile.startswith("p."):
        data = query(
            {
                "query": (
                    "query ControlRoomProfile($profileId: ID!) { "
                    "userProfile(input: { profileId: $profileId }) { userId } }"
                ),
                "variables": {"profileId": profile},
            }
        )
        user_id = (data.get("userProfile") or {}).get("userId")
        if not isinstance(user_id, str) or not re.fullmatch(r"ur\d{1,20}", user_id):
            raise WatchlistError("private_or_missing")
    films, seen, cursor, total = [], set(), None, None
    query_hash = settings.IMDB_WATCHLIST_QUERY_HASH or DEFAULT_HASH
    if not re.fullmatch(r"[a-f0-9]{64}", query_hash):
        raise WatchlistError("response_changed")
    for _ in range(120):
        variables = {
            "locale": "en-US",
            "first": 100,
            "urConst": user_id,
            "isInPace": False,
            "sort": {"by": "LIST_ORDER", "order": "ASC"},
        }
        if cursor:
            variables["after"] = cursor
        data = query(
            {
                "operationName": "WatchListPageRefiner",
                "variables": variables,
                "extensions": {"persistedQuery": {"version": 1, "sha256Hash": query_hash}},
            }
        )
        predefined = data.get("predefinedList")
        if predefined is None:
            raise WatchlistError("private_or_missing")
        search = (
            (predefined.get("titleListItemSearch") or {}) if isinstance(predefined, dict) else {}
        )
        page_total = search.get("total")
        edges = search.get("edges")
        info = search.get("pageInfo")
        if (
            not isinstance(page_total, int)
            or page_total < 0
            or page_total > MAX_TITLES
            or not isinstance(edges, list)
            or not isinstance(info, dict)
        ):
            raise WatchlistError("response_changed")
        if total is not None and total != page_total:
            raise WatchlistError("response_changed")
        total = page_total
        for edge in edges:
            film = edge_film(edge)
            if film["imdbId"] in seen:
                raise WatchlistError("response_changed")
            seen.add(film["imdbId"])
            films.append(film)
        if not info.get("hasNextPage"):
            if len(films) != total:
                raise WatchlistError("response_changed")
            return source_url, profile, films
        next_cursor = info.get("endCursor")
        if not edges or not isinstance(next_cursor, str) or next_cursor == cursor:
            raise WatchlistError("response_changed")
        cursor = next_cursor
    raise WatchlistError("too_large")


def status_for(user):
    # pyrefly: ignore [missing-attribute]
    record = ImdbWatchlistConnection.objects.filter(user=user).first()
    now = timezone.now()
    refreshing = bool(
        record and record.lease_id and record.lease_expires_at and record.lease_expires_at > now
    )
    error = record.last_error if record else None
    if record and record.lease_id and not refreshing:
        error = "interrupted"
    return {
        "available": settings.IMDB_WATCHLIST_ENABLED,
        "automatic": "while_open",
        "phase": "disconnected"
        if not record
        else "refreshing"
        if refreshing
        else "needs_attention"
        if error or not record.last_success_at
        else "connected",
        "sourceUrl": record.source_url if record else None,
        "lastAttemptAt": record.last_attempt_at.isoformat()
        if record and record.last_attempt_at
        else None,
        "lastSuccessAt": record.last_success_at.isoformat()
        if record and record.last_success_at
        else None,
        "nextRefreshAt": record.next_refresh_at.isoformat() if record else None,
        "retryAfter": record.lease_expires_at.isoformat() if refreshing else None,
        "titleCount": record.title_count if record else 0,
        "lastAdded": record.last_added if record else 0,
        "errorCode": error if error in ERROR_CODES else None,
    }


def refresh(user, raw_url=None):
    # pyrefly: ignore [missing-attribute]
    current = ImdbWatchlistConnection.objects.filter(user=user).first()
    if raw_url:
        source_url, profile = normalize_url(raw_url)
        if current and current.source_url != source_url:
            raise WatchlistError("response_changed")
    elif current:
        source_url, profile = current.source_url, current.profile_id
    else:
        return status_for(user)
    now = timezone.now()
    films_url, profile, films = read_public_watchlist(source_url)
    from .serializers import clean_entry_payload

    # pyrefly: ignore [bad-context-manager]
    with transaction.atomic():
        # pyrefly: ignore [missing-attribute]
        current, _ = ImdbWatchlistConnection.objects.select_for_update().get_or_create(
            user=user,
            defaults={"source_url": films_url, "profile_id": profile, "next_refresh_at": now},
        )
        # pyrefly: ignore [missing-attribute]
        existing = set(RoomEntry.objects.filter(kind="film").values_list("source_id", flat=True))
        added = 0
        for film in films:
            source_id = f"imdb:{film['imdbId']}"
            if source_id in existing:
                continue
            clean = clean_entry_payload(
                {
                    "kind": "film",
                    "title": film["title"],
                    "creator": film["creator"],
                    "note": film["note"],
                    "status": "Watchlist",
                    "format": film["format"],
                    "link": f"https://www.imdb.com/title/{film['imdbId']}/",
                    "source_id": source_id,
                }
            )
            # pyrefly: ignore [missing-attribute]
            entry = RoomEntry.objects.create(created_by=user, **clean)
            # pyrefly: ignore [missing-attribute]
            RoomEvent.objects.create(actor=user, title=entry.title, kind="film", action="Added")
            existing.add(source_id)
            added += 1
        current.source_url, current.profile_id = films_url, profile
        current.last_attempt_at = now
        current.last_success_at = now
        current.next_refresh_at = now + timedelta(hours=6)
        current.title_count = len(films)
        current.last_added = added
        current.last_error = None
        current.lease_id = None
        current.lease_expires_at = None
        current.snapshot_ids = [film["imdbId"] for film in films]
        current.save()
    return status_for(user)

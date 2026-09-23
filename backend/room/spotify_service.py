import base64
import hashlib
import secrets
from datetime import timedelta
from urllib.parse import urlsplit

import requests
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.utils import timezone

from .models import SpotifyAccount, SpotifyState

TOKEN_URL = "https://accounts.spotify.com/api/token"
API_URL = "https://api.spotify.com/v1/"
SCOPES = (
    "user-read-currently-playing user-read-recently-played user-library-read "
    "playlist-read-private user-read-private"
)


class SpotifyProviderError(Exception):
    def __init__(self, status=502):
        self.status = status
        super().__init__("Spotify is temporarily unavailable.")


def redirect_uris() -> list[str]:
    configured = list(getattr(settings, "SPOTIFY_REDIRECT_URIS", []) or [])
    if configured:
        return configured
    legacy = getattr(settings, "SPOTIFY_REDIRECT_URI", "")
    return [legacy] if legacy else []


def redirect_uri_for_host(host: str) -> str:
    """Choose the exact registered callback matching the browser host."""
    candidates = {
        f"http://{host}/api/spotify/callback/",
        f"https://{host}/api/spotify/callback/",
    }
    for uri in redirect_uris():
        if uri in candidates:
            return uri
    # Some reverse proxies strip the port from Host. Keep host selection safe
    # by matching only the hostname against explicitly configured callbacks.
    hostname = host.rsplit("@", 1)[-1].split(":", 1)[0].lower()
    for uri in redirect_uris():
        if urlsplit(uri).hostname == hostname:
            return uri
    return redirect_uris()[0] if redirect_uris() else ""


def configuration_issues() -> list[str]:
    """Return setting names only; never include their secret values."""
    issues = [
        name
        for name in (
            "SPOTIFY_CLIENT_ID",
            "SPOTIFY_CLIENT_SECRET",
            "SPOTIFY_REDIRECT_URI",
            "SPOTIFY_TOKEN_KEY",
        )
        if not getattr(settings, name, "")
    ]
    if "SPOTIFY_TOKEN_KEY" not in issues:
        try:
            cipher()
        except SpotifyProviderError:
            issues.append("SPOTIFY_TOKEN_KEY")
    return issues


def is_configured():
    return not configuration_issues()


def cipher():
    try:
        # pyrefly: ignore [missing-attribute]
        return Fernet(settings.SPOTIFY_TOKEN_KEY.encode())
    except (TypeError, ValueError) as error:
        raise SpotifyProviderError(503) from error


def seal(value: dict) -> str:
    import json

    return cipher().encrypt(json.dumps(value, separators=(",", ":")).encode()).decode()


def open_box(value: str) -> dict:
    import json

    try:
        return json.loads(cipher().decrypt(value.encode()).decode())
    except (InvalidToken, ValueError, TypeError, json.JSONDecodeError) as error:
        raise SpotifyProviderError(503) from error


def state_key(state: str) -> str:
    return hashlib.sha256(state.encode()).hexdigest()


def exchange(data: dict) -> dict:
    response = requests.post(
        TOKEN_URL,
        data=data,
        # pyrefly: ignore [bad-argument-type]
        auth=(settings.SPOTIFY_CLIENT_ID, settings.SPOTIFY_CLIENT_SECRET),
        timeout=12,
        allow_redirects=False,
    )
    if not response.ok:
        raise SpotifyProviderError(response.status_code)
    try:
        payload = response.json()
    except ValueError as error:
        raise SpotifyProviderError() from error
    if not payload.get("access_token"):
        raise SpotifyProviderError()
    return payload


def authorize_url(user, redirect_uri: str | None = None):
    if not is_configured():
        raise SpotifyProviderError(503)
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    )
    redirect_uri = redirect_uri or redirect_uris()[0]
    if redirect_uri not in redirect_uris():
        raise SpotifyProviderError(400)
    # pyrefly: ignore [missing-attribute]
    SpotifyState.objects.filter(user=user).delete()
    # pyrefly: ignore [missing-attribute]
    SpotifyState.objects.create(
        state_hash=state_key(state),
        user=user,
        verifier_box=seal({"verifier": verifier, "redirect_uri": redirect_uri}),
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    from urllib.parse import urlencode

    return "https://accounts.spotify.com/authorize?" + urlencode(
        {
            "response_type": "code",
            "client_id": settings.SPOTIFY_CLIENT_ID,
            "redirect_uri": settings.SPOTIFY_REDIRECT_URI,
            "state": state,
            "code_challenge_method": "S256",
            "code_challenge": challenge,
            "scope": SCOPES,
        }
    )


def finish_callback(state: str, code: str):
    # pyrefly: ignore [missing-attribute]
    record = SpotifyState.objects.select_related("user").filter(state_hash=state_key(state)).first()
    if not record or record.expires_at <= timezone.now():
        raise SpotifyProviderError(400)
    record.delete()
    state_data = open_box(record.verifier_box)
    verifier = state_data["verifier"]
    redirect_uri = state_data.get("redirect_uri") or redirect_uris()[0]
    if redirect_uri not in redirect_uris():
        raise SpotifyProviderError(400)
    token = exchange(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": verifier,
        }
    )
    profile = provider("me", token["access_token"])
    # pyrefly: ignore [missing-attribute]
    SpotifyAccount.objects.update_or_create(
        user=record.user,
        defaults={
            # pyrefly: ignore [missing-attribute]
            "spotify_id": str(profile.get("id", ""))[:160],
            # pyrefly: ignore [missing-attribute]
            "display_name": str(profile.get("display_name") or "")[:160],
            "token_box": seal(
                {
                    "access": token["access_token"],
                    "refresh": token.get("refresh_token", ""),
                    "expires": int(
                        (timezone.now().timestamp() + int(token.get("expires_in", 3600))) * 1000
                    ),
                }
            ),
        },
    )


def provider(path: str, access: str):
    response = requests.get(
        API_URL + path,
        headers={"Authorization": f"Bearer {access}"},
        timeout=12,
        allow_redirects=False,
    )
    if not response.ok:
        raise SpotifyProviderError(response.status_code)
    if response.status_code == 204:
        return None
    try:
        return response.json()
    except ValueError as error:
        raise SpotifyProviderError() from error


def account_tokens(user):
    # pyrefly: ignore [missing-attribute]
    account = SpotifyAccount.objects.filter(user=user).first()
    if not account:
        return None
    token = open_box(account.token_box)
    if int(token.get("expires", 0)) <= int(timezone.now().timestamp() * 1000) + 60_000:
        if not token.get("refresh"):
            account.delete()
            return None
        fresh = exchange({"grant_type": "refresh_token", "refresh_token": token["refresh"]})
        token = {
            "access": fresh["access_token"],
            "refresh": fresh.get("refresh_token") or token["refresh"],
            "expires": int(
                (timezone.now().timestamp() + int(fresh.get("expires_in", 3600))) * 1000
            ),
        }
        account.token_box = seal(token)
        account.save(update_fields=["token_box", "updated_at"])
    return account, token


def spotify(path: str, user):
    linked = account_tokens(user)
    if not linked:
        raise SpotifyProviderError(409)
    account, token = linked
    try:
        # pyrefly: ignore [bad-argument-type]
        return provider(path, token["access"])
    except SpotifyProviderError as error:
        if error.status != 401:
            raise
        fresh = exchange({"grant_type": "refresh_token", "refresh_token": token["refresh"]})
        token = {
            "access": fresh["access_token"],
            "refresh": fresh.get("refresh_token") or token["refresh"],
            "expires": int(
                (timezone.now().timestamp() + int(fresh.get("expires_in", 3600))) * 1000
            ),
        }
        account.token_box = seal(token)
        account.save(update_fields=["token_box", "updated_at"])
        return provider(path, token["access"])


def track(item):
    if not isinstance(item, dict) or not item.get("id") or not item.get("name"):
        return None
    url = item.get("external_urls", {}).get("spotify")
    if not isinstance(url, str) or not url.startswith("https://open.spotify.com/track/"):
        return None
    return {
        "id": str(item["id"]),
        "title": str(item["name"])[:240],
        "creator": ", ".join(
            str(artist.get("name", "")) for artist in item.get("artists", []) if artist.get("name")
        )[:180],
        "url": url,
        "image": (item.get("album", {}).get("images") or [{}])[0].get("url"),
    }


def saved_song(item):
    item = item if isinstance(item, dict) else {}
    source = item.get("track") or item.get("item") or {}
    base = track(source)
    added = item.get("added_at")
    album = source.get("album", {}).get("name")
    release = source.get("album", {}).get("release_date")
    year = (
        int(release[:4])
        if isinstance(release, str) and len(release) >= 4 and release[:4].isdigit()
        else None
    )
    if not base or not isinstance(added, str) or not album:
        return None
    duration = source.get("duration_ms")
    return {
        **base,
        "addedAt": added,
        "album": str(album)[:240],
        "releaseYear": year,
        "durationMs": duration if isinstance(duration, int) and duration > 0 else None,
    }

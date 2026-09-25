"""Song source lookup for the listening room.

Spotify metadata tells us which song an entry is; it never provides the
audio. Full-track downloads come from catalogs that exist to be
downloaded: Jamendo serves Creative Commons music, Audius serves
artist-uploaded tracks through its open API (only when the artist marked
the track downloadable), and the Internet Archive serves its public audio
collections. Commercial catalogs live on licensed stores only, so a song
absent from the open catalogs reports a miss instead of a clip or a rip.

Ranking follows the scheme proven by spotDL (spotify-downloader): every
candidate gets a fuzzy title score, an artist-evidence score, and a
duration score exp(-0.1 * |delta seconds|); derivative markers (live,
remix, cover, ...) cost 15 points each unless the song title itself
carries them; the best candidate wins instead of the first loose match.
"""

import re
import time
import unicodedata
from difflib import SequenceMatcher
from functools import lru_cache
from math import exp
from urllib.parse import quote

import requests
from django.conf import settings

JAMENDO_SEARCH_URL = "https://api.jamendo.com/v3.0/tracks/"
AUDIUS_HOST = "https://discoveryprovider.audius.co"
AUDIUS_SEARCH_URL = f"{AUDIUS_HOST}/v1/tracks/search"
ARCHIVE_SEARCH_URL = "https://archive.org/advancedsearch.php"
ARCHIVE_METADATA_URL = "https://archive.org/metadata"
ARCHIVE_DOWNLOAD_URL = "https://archive.org/download"
ARCHIVE_AUDIO_FORMATS = {
    "VBR MP3",
    "128Kbps MP3",
    "64Kbps MP3",
    "MP3",
    "Flac",
    "24bit Flac",
    "Ogg Vorbis",
}
SEARCH_TIMEOUT = (3.05, 8)
METADATA_TIMEOUT = (3.05, 15)
FILE_TIMEOUT = (3.05, 30)
LOOKUP_TTL_SECONDS = 24 * 60 * 60
USER_AGENT = "for-nooshin-room/1.0"
APP_NAME = "for-nooshin-room"

TITLE_GATE = 60.0
ARTIST_GATE = 60.0
# Below this a candidate is a wrong recording rather than a rough
# version: strong title and artist evidence dragged down by a very
# different duration is exactly the "[1 Hour] loop" shape, which is
# still worth delivering as a labelled derivative.
MIN_SCORE = 35.0
EARLY_EXIT_SCORE = 90.0

# entry id -> (expires_at, payload); the catalogs' answers rarely change,
# so repeat clicks on a card cost nothing. The version shadows verdicts
# from an older matcher.
_CACHE_VERSION = 3
_lookup_cache = {}


class SongSourceError(Exception):
    def __init__(self, status):
        self.status = status
        super().__init__(status)


def _normalize(text):
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"\([^)]*\)|\[[^]]*\]", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


@lru_cache(maxsize=8192)
def _ratio(want, have):
    if not want or not have:
        return 0.0
    return SequenceMatcher(None, want, have).ratio() * 100


def _sorted_words(text):
    return " ".join(sorted(_normalize(text).split()))


_ARTIST_STOPWORDS = {"the", "and", "feat", "ft", "with", "of", "a", "an", "vs", "versus"}


def _artist_tokens(artist):
    return [
        token
        for token in _normalize(artist).split()
        if len(token) >= 3 and token not in _ARTIST_STOPWORDS
    ]


def _primary_artist(creator):
    return creator.split(",")[0].strip()


def _bare_title(title):
    bare = re.sub(r"\([^)]*\)|\[[^]]*\]", " ", title).replace('"', " ")
    bare = " ".join(bare.split())
    return bare.split(" - ")[0].strip() or bare.strip()


def _search_title_variants(title):
    """Title forms catalogs actually use: without credits, punctuation,
    or trailing feature notes ("Dracula (with JENNIE)" -> "Dracula")."""
    bare = _bare_title(title)
    variants = []
    for candidate in [
        bare,
        bare.replace("'", "").replace("\u2019", ""),
        bare.split(" with ")[0].strip(),
    ]:
        candidate = candidate.strip()
        if candidate and candidate not in variants:
            variants.append(candidate)
    return variants


def _title_score(entry_title, candidate_title):
    """Best fuzzy agreement between the song title (in every search
    variant) and the candidate's title; containment is near-certain
    because catalog file names embed the artist and packaging noise."""
    have = _normalize(candidate_title)
    if not have:
        return 0.0
    forms = [entry_title, *_search_title_variants(entry_title)]
    best = 0.0
    for form in forms:
        want = _normalize(form)
        if not want:
            continue
        score = _ratio(want, have)
        if len(want) != len(have):
            score = max(score, _ratio(_sorted_words(form), _sorted_words(candidate_title)))
        if want == have:
            score = 100.0
        elif len(want) >= 5 and want in have:
            score = max(score, 92.0)
        elif len(have) >= 5 and have in want:
            score = max(score, 92.0)
        best = max(best, score)
    return best


def _flat(text):
    """Normalization that keeps parenthesised and bracketed words:
    derivative markers hide in them ("[1 Hour]", "(Remix)")."""
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).split())


_ARTIST_NOISE = {
    "the",
    "and",
    "of",
    "a",
    "an",
    "to",
    "in",
    "on",
    "or",
    "is",
    "it",
    "by",
    "my",
    "vs",
}


def _artist_score(entry_creator, evidence):
    """Fuzzy presence of the credited artists in the candidate's artist
    evidence. The primary artist dominates, as in spotDL's matcher;
    containment beats ratio because archive evidence is prose. Spotify
    credits join several artists into one string ("Metric, Brie Larson")
    and can include a show ("Imagine Dragons, JID, Arcane") the catalogs
    never mention, so each credited name is scored on its own."""
    names = [name.strip() for name in (entry_creator or "").split(",") if name.strip()]
    if not names:
        return 65.0
    have = _normalize(evidence)
    have_words = set(have.split())
    scores = []
    for name in names:
        want = _normalize(name)
        if not want:
            scores.append(0.0)
            continue
        score = _ratio(want, have)
        if len(want) != len(have):
            score = max(score, _ratio(_sorted_words(name), have))
        # Two-letter name parts matter: "a-ha" never survives a >=3-char
        # token filter, and ratio against prose cannot rescue it.
        want_words = [word for word in want.split() if len(word) >= 2 and word not in _ARTIST_NOISE]
        if len(want) >= 5 and want in have:
            score = max(score, 95.0)
        elif want_words and all(word in have_words for word in want_words):
            score = max(score, 88.0)
        scores.append(score)
    primary = scores[0]
    others = scores[1:]
    if not others:
        return primary
    return primary * 0.7 + (sum(others) / len(others)) * 0.3


def _entry_seconds(entry):
    millis = getattr(entry, "provider_duration_ms", None)
    return millis / 1000 if millis else None


def _parse_length(value):
    """Archive 'length' arrives as seconds ("230.94") or clock
    ("3:50.12"); Jamendo and Audius report plain seconds."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        if ":" in text:
            parts = text.split(":")
            return sum(float(part) * 60**i for i, part in enumerate(reversed(parts)))
        seconds = float(text)
        return seconds if seconds > 0 else None
    except ValueError:
        return None


def _duration_score(entry, seconds):
    want = _entry_seconds(entry)
    if want is None or not seconds or seconds <= 0:
        return None
    return exp(-0.1 * abs(want - seconds)) * 100


# Derivative markers, applied to the candidate's whole text. Prefix
# words catch inflections ("remastered", "mashups"); exact words are the
# ones whose prefixes collide with packaging ("edition" is an album
# pressing, not a radio edit, so "edit" must not prefix-match).
_FORBIDDEN_PREFIX_WORDS = (
    "remix",
    "remaster",
    "reverb",
    "acoustic",
    "instrumental",
    "karaoke",
    "slowed",
    "nightcore",
    "bootleg",
    "rework",
    "mashup",
    "mash",
    "tribute",
    "medley",
    "bassboost",
    "sped",
    "8daudio",
    "hour",
)
_FORBIDDEN_EXACT_WORDS = (
    "live",
    "cover",
    "demo",
    "edit",
    "edits",
    "edited",
    "loop",
    "vs",
    "mix",
    "8d",
)


def _forbidden_hits(text, entry_title):
    """Derivative markers the candidate carries but the song title does
    not; each costs 15 points (spotDL's penalty), so a song called
    "... (Remix)" is not punished for matching a remix."""
    tokens = set(_flat(text).split())
    title_tokens = set(_flat(entry_title).split())

    def carries(words, token_set):
        return any(
            token == word or (word in _FORBIDDEN_PREFIX_WORDS and token.startswith(word))
            for word in words
            for token in token_set
        )

    hits = 0
    for word in set(_FORBIDDEN_PREFIX_WORDS + _FORBIDDEN_EXACT_WORDS):
        if carries((word,), tokens) and not carries((word,), title_tokens):
            hits += 1
    return hits


def _candidate_score(entry, candidate_title, evidence, seconds, full_text):
    """Score one candidate against the entry, or None when it cannot be
    the same recording."""
    title = _title_score(entry.title, candidate_title)
    title -= 15 * _forbidden_hits(full_text, entry.title)
    if title <= TITLE_GATE:
        return None
    artist = _artist_score(entry.creator, evidence)
    if artist < ARTIST_GATE:
        return None
    score = (title * 2 + artist) / 3
    duration = _duration_score(entry, seconds)
    if duration is not None:
        # A clean-named file with a very different length can still be a
        # live rendition the catalogs are full of, so duration adjusts
        # the score instead of vetoing the candidate.
        score = (score + duration) / 2
    if score < MIN_SCORE:
        return None
    return score


_JUNK_TITLE_WORDS = {
    "feat",
    "ft",
    "featuring",
    "official",
    "video",
    "audio",
    "lyrics",
    "lyric",
    "radio",
    "edit",
    "version",
    "single",
    "album",
    "hq",
    "hd",
    "kbps",
    "and",
    "the",
}


def _leftover_explained(matched_title, file_title, entry_creator):
    """A match backed only by the item description must still be the same
    recording: every word in the file title that the song title doesn't
    cover has to be a credited artist, a number, or packaging noise."""
    want_words = set(_normalize(matched_title).split())
    credited = set(_artist_tokens(entry_creator))
    for word in _normalize(file_title).split():
        if word in want_words or word in credited or word.isdigit():
            continue
        if word in _JUNK_TITLE_WORDS:
            continue
        return False
    return True


def _found(source, entry, title, artist, file_url, page="", variant="original"):
    return {
        "status": "found",
        "source": source,
        "kind": "full",
        "title": title or entry.title,
        "artist": artist or entry.creator,
        "file": file_url,
        "page": page,
        "variant": variant,
    }


def _scored(found, score, full_text, entry_title):
    """Attach the derivative label the UI shows as "Closest version
    saved" when the winner carries a derivative marker."""
    if _forbidden_hits(full_text, entry_title):
        found["variant"] = "derivative"
    return score, found


class _Ranked:
    """Prefer an original rendition over any derivative: a live take of
    the song is closer to the request than a remix of it, even when the
    remix's fuzzy score is higher."""

    def __init__(self):
        self.original = None
        self.derivative = None

    def add(self, score, found):
        """Track a scored candidate; True when the search can stop."""
        if found.get("variant") == "original":
            if self.original is None or score > self.original[0]:
                self.original = (score, found)
            return score >= EARLY_EXIT_SCORE
        if self.derivative is None or score > self.derivative[0]:
            self.derivative = (score, found)
        return False

    def best(self):
        if self.original is not None:
            return self.original[1]
        return self.derivative[1] if self.derivative else None


def _jamendo_match(entry):
    client_id = getattr(settings, "JAMENDO_CLIENT_ID", "")
    if not client_id:
        return None
    searches = [
        f"{entry.creator} {entry.title}".strip(),
        f"{_primary_artist(entry.creator)} {_bare_title(entry.title)}".strip(),
    ]
    best = _Ranked()
    for search in searches:
        try:
            response = requests.get(
                JAMENDO_SEARCH_URL,
                params={
                    "client_id": client_id,
                    "format": "json",
                    "limit": 10,
                    "search": search,
                },
                headers={"User-Agent": USER_AGENT},
                timeout=SEARCH_TIMEOUT,
            )
            response.raise_for_status()
            results = response.json().get("results", [])
        except requests.RequestException, ValueError:
            return None
        for track in results:
            download = track.get("audiodownload") or track.get("audio")
            if not download:
                continue
            name = track.get("name") or ""
            score = _candidate_score(
                entry,
                name,
                track.get("artist_name") or "",
                _parse_length(track.get("audio_duration")),
                name,
            )
            if score is None:
                continue
            if best.add(
                *_scored(
                    _found(
                        "jamendo",
                        entry,
                        name,
                        track.get("artist_name"),
                        download,
                        track.get("shareurl", ""),
                    ),
                    score,
                    name,
                    entry.title,
                )
            ):
                return best.best()
    return best.best()


def _audius_results(query):
    try:
        response = requests.get(
            AUDIUS_SEARCH_URL,
            params={"query": query, "app_name": APP_NAME},
            headers={"User-Agent": USER_AGENT},
            timeout=SEARCH_TIMEOUT,
        )
        response.raise_for_status()
        return response.json().get("data", [])
    except requests.RequestException, ValueError:
        return []


def _audius_match(entry):
    # Combined queries sometimes return nothing while the title alone finds
    # the track; the artist is still verified by the match itself.
    queries = [
        f"{entry.creator} {entry.title}".strip(),
        f"{_primary_artist(entry.creator)} {_bare_title(entry.title)}".strip(),
        _bare_title(entry.title),
    ]
    best = _Ranked()
    for query in queries:
        for track in _audius_results(query)[:10]:
            if not track.get("is_downloadable"):
                continue
            # The download url is signed server-side; appending anything breaks it.
            file_url = (track.get("download") or {}).get("url", "")
            if not file_url:
                continue
            artist = (track.get("user") or {}).get("name", "")
            title = track.get("title", "")
            score = _candidate_score(
                entry, title, artist, _parse_length(track.get("duration")), title
            )
            if score is None:
                continue
            permalink = track.get("permalink", "")
            page = f"https://audius.co{permalink}" if permalink.startswith("/") else permalink
            if best.add(
                *_scored(
                    _found("audius", entry, title, artist, file_url, page),
                    score,
                    title,
                    entry.title,
                )
            ):
                return best.best()
    return best.best()


def _archive_track_title(file_name):
    stem = file_name.rsplit("/", 1)[-1]
    stem = re.sub(r"\.[a-z0-9]{2,4}$", "", stem, flags=re.IGNORECASE)
    stem = re.sub(r"^\s*\d{1,3}[\s._-]+", "", stem)
    return stem


def _archive_item_candidates(identifier, item_title, entry):
    """Score every downloadable audio file of one archive item against
    the entry, best-first-ready, or [] when the item holds no match.

    Artist evidence comes in tiers. The strict tier (creator, item
    title, and the file's own name) proves the recording; descriptions
    are a second tier because they also cite unrelated artists, so a
    description-backed match must additionally pass _leftover_explained.
    """
    # archive.org serves big items slowly on a cold cache; a single read
    # timeout silently drops real mirrors, so retry once.
    metadata = None
    for attempt in range(2):
        try:
            response = requests.get(
                f"{ARCHIVE_METADATA_URL}/{identifier}",
                headers={"User-Agent": USER_AGENT},
                timeout=METADATA_TIMEOUT,
            )
            response.raise_for_status()
            metadata = response.json()
            break
        except (requests.RequestException, ValueError):
            if attempt:
                return []
    if not metadata:
        return []
    item = metadata.get("metadata", {})
    creators = item.get("creator", "")
    if isinstance(creators, list):
        creators = " ".join(str(creator) for creator in creators)
    subjects = item.get("subject", "")
    if isinstance(subjects, list):
        subjects = " ".join(str(subject) for subject in subjects)
    description = item.get("description", "")
    if not isinstance(description, str):
        description = ""
    strict_context = " ".join(part for part in [creators, item_title] if part)
    loose_context = " ".join(
        part for part in [strict_context, subjects, description[:2000]] if part
    )
    bare = _search_title_variants(entry.title)
    bare_title = bare[0] if bare else entry.title
    candidates = []
    for file_info in metadata.get("files", []):
        if file_info.get("format") not in ARCHIVE_AUDIO_FORMATS:
            continue
        name = file_info.get("name", "")
        track_title = _archive_track_title(name)
        seconds = _parse_length(file_info.get("length"))
        # Creators belong here too: cover items say so in the creator
        # field ("Written by A-Ha, covered by ..."), not in the file name.
        full_text = f"{creators} {item_title} {track_title}"
        score = _candidate_score(
            entry, track_title, f"{strict_context} {track_title}", seconds, full_text
        )
        if score is None:
            if not _leftover_explained(bare_title, track_title, entry.creator):
                continue
            score = _candidate_score(
                entry, track_title, f"{loose_context} {track_title}", seconds, full_text
            )
            if score is None:
                continue
        found = _found(
            "archive",
            entry,
            entry.title,
            creators,
            f"{ARCHIVE_DOWNLOAD_URL}/{identifier}/{quote(name)}",
            f"https://archive.org/details/{identifier}",
        )
        candidates.append(_scored(found, score, full_text, entry.title))
    return candidates


# Accents stay: creators are indexed as written ("The Marías"), so the
# field value must keep them; a transliterated variant covers items that
# spell the name in plain ASCII.
_ARCHIVE_FIELD_SAFE = re.compile(r"[^\w .'+&/_-]+")


def _transliterate(text):
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()


def _album_variants(album):
    if not album:
        return []
    bare = " ".join(re.sub(r"\([^)]*\)|\[[^]]*\]", " ", album).split())
    variants = []
    for candidate in [album.strip(), bare]:
        candidate = candidate.strip().strip('"')
        if candidate and candidate not in variants:
            variants.append(candidate)
    return variants[:2]


def _archive_docs(query):
    try:
        response = requests.get(
            ARCHIVE_SEARCH_URL,
            params={
                "q": query,
                "fl[]": ["identifier", "title", "creator"],
                "rows": 10,
                "page": 1,
                "output": "json",
            },
            headers={"User-Agent": USER_AGENT},
            timeout=SEARCH_TIMEOUT,
        )
        response.raise_for_status()
        return response.json().get("response", {}).get("docs", [])
    except requests.RequestException, ValueError:
        return []


ARCHIVE_DOCS_PER_QUERY = 4
ARCHIVE_DOC_BUDGET = 12
# Item metadata fetches dominate the walk; without a wall-clock cap a
# slow archive response can outrun the frontend's request budget.
ARCHIVE_TIME_BUDGET = 25.0


def _archive_queries(entry):
    titles = _search_title_variants(entry.title)
    full_creator = entry.creator.replace('"', " ").strip()
    primary = _primary_artist(full_creator)
    field_primary = _ARCHIVE_FIELD_SAFE.sub(" ", primary).strip()
    field_variants = []
    for candidate in [field_primary, _transliterate(field_primary)]:
        candidate = _ARCHIVE_FIELD_SAFE.sub(" ", candidate).strip()
        if candidate and candidate not in field_variants:
            field_variants.append(candidate)
    queries = []

    def add(query):
        if query not in queries:
            queries.append(query)

    for index, title in enumerate(titles):
        for field in field_variants:
            add(f'creator:(({field})) AND "{title}" AND mediatype:(audio)')
        if field_primary:
            add(f'"{title}" AND "{field_primary}" AND mediatype:(audio)')
        if index == 0 and full_creator:
            add(f'"{title}" AND "{full_creator}" AND mediatype:(audio)')
    # Modern album mirrors carry the album name as the item title and
    # bare track names as files, so item search cannot see them by track
    # title; the album name is what surfaces them, and the file-level
    # scorer picks the track out of the item.
    album = getattr(entry, "provider_album", "") or ""
    for album_variant in _album_variants(album):
        for field in field_variants:
            add(f'creator:(({field})) AND "{album_variant}" AND mediatype:(audio)')
        add(f'"{album_variant}" AND "{primary}" AND mediatype:(audio)')
    if titles:
        add(f'"{titles[0]}" AND mediatype:(audio)')
    return queries


def _archive_match(entry):
    queries = _archive_queries(entry)
    started = time.monotonic()
    seen = set()
    checked = 0
    best = _Ranked()
    for query in queries:
        if checked >= ARCHIVE_DOC_BUDGET or time.monotonic() - started > ARCHIVE_TIME_BUDGET:
            break
        scanned_this_query = 0
        for doc in _archive_docs(query):
            if scanned_this_query >= ARCHIVE_DOCS_PER_QUERY or checked >= ARCHIVE_DOC_BUDGET:
                break
            identifier = doc.get("identifier", "")
            if not identifier or identifier in seen:
                continue
            seen.add(identifier)
            checked += 1
            scanned_this_query += 1
            for score, found in _archive_item_candidates(identifier, doc.get("title", ""), entry):
                if best.add(score, found):
                    return found
    return best.best()


def lookup_song(entry):
    """Return the best open-catalog source for a music entry, or a miss."""
    # A member-uploaded file outranks every catalog and must bypass the
    # cache, or an earlier miss would keep answering after the upload.
    if getattr(entry, "song_file", None):
        return _found("manual", entry, entry.title, entry.creator, "")
    key = (_CACHE_VERSION, entry.id)
    cached = _lookup_cache.get(key)
    now = time.monotonic()
    if cached and cached[0] > now:
        return cached[1]
    payload = _jamendo_match(entry) or _audius_match(entry) or _archive_match(entry)
    if not payload:
        payload = {"status": "miss"}
    _lookup_cache[key] = (now + LOOKUP_TTL_SECONDS, payload)
    return payload


_SAFE_FILENAME = re.compile(r"[^A-Za-z0-9 .,_()-]+")
_AUDIO_EXTENSIONS = {
    "mpeg": ".mp3",
    "mp3": ".mp3",
    "mp4": ".m4a",
    "m4a": ".m4a",
    "aac": ".m4a",
    "wav": ".wav",
    "wave": ".wav",
    "x-wav": ".wav",
    "ogg": ".ogg",
    "vorbis": ".ogg",
    "flac": ".flac",
    "x-flac": ".flac",
    "flv": ".flv",
}


def download_filename(payload, content_type=""):
    base = f"{payload.get('artist', '')} - {payload.get('title', 'song')}".strip(" -")
    base = _SAFE_FILENAME.sub("", base)[:100].strip() or "song"
    subtype = content_type.split("/")[-1].split(";")[0].strip().lower()
    extension = _AUDIO_EXTENSIONS.get(subtype, ".mp3")
    return f"{base} (song){extension}"


def fetch_source_file(payload):
    """Stream the source file, or raise SongSourceError."""
    try:
        response = requests.get(
            payload["file"],
            headers={"User-Agent": USER_AGENT},
            stream=True,
            timeout=FILE_TIMEOUT,
        )
    except requests.RequestException as error:
        raise SongSourceError(502) from error
    if response.status_code != 200:
        response.close()
        raise SongSourceError(502)
    return response

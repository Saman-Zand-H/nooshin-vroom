import json
from datetime import datetime
from urllib.parse import urlparse

from django.http import HttpRequest

from .models import RoomEntry, RoomEvent

STATUS_OPTIONS = {
    "book": {"Want to read", "Reading", "Finished"},
    "music": {"Saved", "On repeat"},
    "wish": {"Someday", "Would love", "Favourite"},
    "request": {"Requested", "Practicing", "Recorded", "Delivered"},
    "note": {"Saved"},
    "film": {"Watchlist", "Watching", "Finished"},
    "game": {"Want to play", "Playing", "Finished"},
    "rabbit_hole": {"Saved"},
    "movie_night": {"Idea", "Planned", "Watched"},
    "adventure": {"Someday", "A memory"},
    "lyric": {"On the wall"},
}
KINDS = set(STATUS_OPTIONS)
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
RECORDING_TYPES = {
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "video/mp4",
    "video/webm",
}


class ValidationFailure(ValueError):
    pass


def parse_json_body(request: HttpRequest) -> dict:
    raw = (
        # pyrefly: ignore [missing-attribute]
        request.POST.get("data") if request.content_type.startswith("multipart/") else request.body
    )
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="strict")
    try:
        # pyrefly: ignore [bad-argument-type]
        value = json.loads(raw or "{}")
    except (TypeError, ValueError, UnicodeDecodeError) as error:
        raise ValidationFailure("The request body is not valid JSON.") from error
    if not isinstance(value, dict):
        raise ValidationFailure("The request body must be an object.")
    return value


def bounded_text(value, limit: int, *, required: bool = False) -> str:
    if not isinstance(value, str):
        value = ""
    value = value.strip()
    if required and not value:
        raise ValidationFailure("Add a title before saving.")
    if len(value) > limit:
        raise ValidationFailure("One of the fields is too long.")
    return value


def safe_url(value) -> str:
    value = bounded_text(value, 2000)
    if not value:
        return ""
    parsed = urlparse(value)
    if (
        not parsed.hostname
        or parsed.scheme not in {"http", "https"}
        or parsed.username
        or parsed.password
    ):
        raise ValidationFailure("Use a complete http or https link.")
    return value


def validate_details(kind: str, value):
    if value is None:
        return None
    if not isinstance(value, dict) or len(json.dumps(value, ensure_ascii=False)) > 20_000:
        raise ValidationFailure("This section details payload is invalid.")
    return value


def clean_entry_payload(payload: dict) -> dict:
    kind = bounded_text(payload.get("kind"), 32, required=True)
    status = bounded_text(payload.get("status"), 32, required=True)
    if kind not in KINDS or status not in STATUS_OPTIONS[kind]:
        raise ValidationFailure("Choose a valid collection and status.")
    try:
        progress = int(payload.get("progress", 0))
        rating = int(payload.get("rating", 0))
    except (TypeError, ValueError) as error:
        raise ValidationFailure("Progress and rating must be numbers.") from error
    if not 0 <= progress <= 100 or not 0 <= rating <= 5:
        raise ValidationFailure("Progress or rating is outside the allowed range.")
    if status == "Finished":
        progress = 100
    image_url = safe_url(payload.get("image_url")) or None
    if image_url and urlparse(image_url).hostname not in {
        "books.google.com",
        "books.googleusercontent.com",
        "covers.openlibrary.org",
        # Spotify album art from the Web API and its newer CDN mirror.
        "i.scdn.co",
        "image-cdn-ak.spotifycdn.com",
        "image-cdn-fa.spotifycdn.com",
    }:
        raise ValidationFailure("Use a catalogue cover or upload your own image.")
    provider_added_at = parse_datetime(payload.get("provider_added_at"))
    provider_album = bounded_text(payload.get("provider_album"), 240) or None
    provider_release_year = parse_release_year(payload.get("provider_release_year"))
    provider_duration_ms = parse_duration(payload.get("provider_duration_ms"))
    if kind != "music" and any(
        (
            provider_added_at,
            provider_album,
            provider_release_year,
            provider_duration_ms,
        )
    ):
        raise ValidationFailure("Provider song metadata belongs only to music entries.")
    return {
        "kind": kind,
        "title": bounded_text(payload.get("title"), 240, required=True),
        "creator": bounded_text(payload.get("creator"), 180),
        "note": bounded_text(payload.get("note"), 4000),
        "status": status,
        "progress": progress,
        "rating": rating,
        "format": bounded_text(payload.get("format"), 80),
        "link": safe_url(payload.get("link")),
        "image_url": image_url,
        "source_id": bounded_text(payload.get("source_id"), 200) or None,
        "details": validate_details(kind, payload.get("details")),
        "provider_added_at": provider_added_at,
        "provider_album": provider_album,
        "provider_release_year": provider_release_year,
        "provider_duration_ms": provider_duration_ms,
    }


def parse_duration(value):
    if value in (None, ""):
        return None
    try:
        value = int(value)
    except (TypeError, ValueError) as error:
        raise ValidationFailure("A track duration is invalid.") from error
    if not 1 <= value <= 3_600_000:
        raise ValidationFailure("A track duration is invalid.")
    return value


def parse_datetime(value):
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise ValidationFailure("A provider date is invalid.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValidationFailure("A provider date is invalid.") from error
    if parsed.tzinfo is None:
        raise ValidationFailure("A provider date is invalid.")
    return parsed


def parse_release_year(value):
    if value in (None, ""):
        return None
    try:
        value = int(value)
    except (TypeError, ValueError) as error:
        raise ValidationFailure("A release year is invalid.") from error
    if not 1000 <= value <= 9999:
        raise ValidationFailure("A release year is invalid.")
    return value


def entry_json(request: HttpRequest, entry: RoomEntry) -> dict:
    image_path = f"images/{entry.id}" if entry.image_file else None
    recording_path = f"recordings/{entry.id}" if entry.recording_file else None
    return {
        "id": str(entry.id),
        "kind": entry.kind,
        "title": entry.title,
        "creator": entry.creator,
        "note": entry.note,
        "status": entry.status,
        "progress": entry.progress,
        "rating": entry.rating,
        "format": entry.format,
        "link": entry.link,
        "image_path": image_path,
        "image_url": entry.image_url,
        "recording_path": recording_path,
        "recording_type": entry.recording_type,
        "source_id": entry.source_id,
        # pyrefly: ignore [missing-attribute]
        "provider_added_at": entry.provider_added_at.isoformat()
        if entry.provider_added_at
        else None,
        "provider_album": entry.provider_album,
        "provider_release_year": entry.provider_release_year,
        "provider_duration_ms": entry.provider_duration_ms,
        # pyrefly: ignore [missing-attribute]
        "created_at": entry.created_at.isoformat(),
        # pyrefly: ignore [missing-attribute]
        "updated_at": entry.updated_at.isoformat(),
        # pyrefly: ignore [missing-attribute]
        "created_by": str(entry.created_by_id),
        "version": entry.version,
        "shelf_cubby": entry.shelf_cubby,
        "shelf_position": entry.shelf_position,
        "shelf_orientation": entry.shelf_orientation,
        "shelf_stack": entry.shelf_stack or None,
        "details": entry.details,
    }


def event_json(event: RoomEvent) -> dict:
    return {
        "id": str(event.id),
        "title": event.title,
        "kind": event.kind,
        "action": event.action,
        # pyrefly: ignore [missing-attribute]
        "created_at": event.created_at.isoformat(),
    }

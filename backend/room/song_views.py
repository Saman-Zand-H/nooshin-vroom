"""Member views for legal song downloads in the listening room."""

import mimetypes
import os

from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.http import (
    FileResponse,
    Http404,
    HttpRequest,
    HttpResponse,
    JsonResponse,
    StreamingHttpResponse,
)
from django.views.decorators.http import require_GET, require_POST

from .models import RoomEntry, RoomEvent
from .song_service import (
    SongSourceError,
    download_filename,
    fetch_source_file,
    lookup_song,
)
from .song_tags import tagged_audio

SONG_UPLOAD_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    "audio/x-aac",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/vnd.wave",
    "audio/ogg",
    "application/ogg",
    "audio/vorbis",
    "audio/flac",
    "audio/x-flac",
    "audio/opus",
    "audio/webm",
}
SONG_UPLOAD_EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".flac", ".opus", ".webm"}
SONG_UPLOAD_MAX_SIZE = 60 * 1024 * 1024
# Catalog files above this size stream through untagged instead of buffering.
TAG_MAX_BYTES = 64 * 1024 * 1024


def _music_entry(entry_id):
    try:
        # pyrefly: ignore [missing-attribute]
        entry = RoomEntry.objects.get(id=entry_id, kind="music")
    # pyrefly: ignore [missing-attribute]
    except RoomEntry.DoesNotExist:
        raise Http404("Song not found.") from None
    return entry


def _attachment_response(response, entry, content_type):
    payload = {"artist": entry.creator, "title": entry.title}
    response["Content-Disposition"] = (
        f'attachment; filename="{download_filename(payload, content_type)}"'
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


@require_GET
def lookup(request: HttpRequest, entry_id):
    """Report the best open-catalog source for a song entry."""
    try:
        payload = lookup_song(_music_entry(entry_id))
    except SongSourceError:
        return JsonResponse({"error": "The song source is temporarily unavailable."}, status=502)
    return JsonResponse(payload)


@require_POST
def upload(request: HttpRequest, entry_id):
    """Attach a member-supplied audio file; it replaces any earlier one."""
    entry = _music_entry(entry_id)
    song: UploadedFile | None = request.FILES.get("file")  # pyrefly: ignore [bad-assignment]
    if not song:
        return JsonResponse({"error": "Choose an audio file to add."}, status=400)
    extension = os.path.splitext(song.name or "")[1].lower()
    type_ok = song.content_type in SONG_UPLOAD_TYPES or (
        song.content_type in {"", "application/octet-stream"}
        and extension in SONG_UPLOAD_EXTENSIONS
    )
    # pyrefly: ignore [unsupported-operation]
    if not type_ok or song.size > SONG_UPLOAD_MAX_SIZE:
        return JsonResponse({"error": "Only audio files up to 60 MB can be added."}, status=400)
    old_song = entry.song_file.name if entry.song_file else None
    entry.song_file = song
    # pyrefly: ignore [bad-context-manager]
    with transaction.atomic():
        entry.version += 1
        entry.save()
        # pyrefly: ignore [missing-attribute]
        RoomEvent.objects.create(
            # pyrefly: ignore [missing-attribute]
            actor=request.user,
            title=entry.title,
            kind=entry.kind,
            action="Updated",
        )
    if old_song:
        # pyrefly: ignore [missing-attribute]
        entry.song_file.storage.delete(old_song)
    return JsonResponse(lookup_song(entry))


@require_POST
def remove(request: HttpRequest, entry_id):
    """Drop a member-supplied file and fall back to the catalogs."""
    entry = _music_entry(entry_id)
    old_song = entry.song_file.name if entry.song_file else None
    if not old_song:
        return JsonResponse({"ok": True})
    storage = entry.song_file.storage
    # pyrefly: ignore [bad-assignment]
    entry.song_file = None
    # pyrefly: ignore [bad-context-manager]
    with transaction.atomic():
        entry.version += 1
        entry.save()
        # pyrefly: ignore [missing-attribute]
        RoomEvent.objects.create(
            # pyrefly: ignore [missing-attribute]
            actor=request.user,
            title=entry.title,
            kind=entry.kind,
            action="Updated",
        )
    storage.delete(old_song)
    return JsonResponse({"ok": True})


@require_GET
def file(request: HttpRequest, entry_id):
    """Serve the song as a download with the room's tags and cover art."""
    entry = _music_entry(entry_id)
    if entry.song_file:
        content_type = (
            # pyrefly: ignore [unsupported-operation]
            mimetypes.guess_type(entry.song_file.name)[0] or "application/octet-stream"
        )
        # pyrefly: ignore [unsupported-operation]
        data = entry.song_file.open("rb").read()
        tagged = tagged_audio(data, content_type, entry)
        response = (
            HttpResponse(tagged, content_type=content_type)
            if tagged is not None
            # pyrefly: ignore [unsupported-operation]
            else FileResponse(entry.song_file.open("rb"), content_type=content_type)
        )
        return _attachment_response(response, entry, content_type)
    try:
        payload = lookup_song(entry)
    except SongSourceError:
        return JsonResponse({"error": "The song source is temporarily unavailable."}, status=502)
    if payload.get("status") != "found" or not payload.get("file"):
        return JsonResponse({"error": "Song source not found."}, status=404)
    try:
        upstream = fetch_source_file(payload)
    except SongSourceError:
        return JsonResponse({"error": "The song source is temporarily unavailable."}, status=502)
    content_type = upstream.headers.get("Content-Type", "")
    if not content_type.startswith("audio/"):
        content_type = "application/octet-stream"
    declared = upstream.headers.get("Content-Length", "")
    if declared.isdigit() and int(declared) > TAG_MAX_BYTES:
        return _attachment_response(
            StreamingHttpResponse(upstream.iter_content(64 * 1024), content_type=content_type),
            entry,
            content_type,
        )
    chunks = []
    size = 0
    for chunk in upstream.iter_content(64 * 1024):
        size += len(chunk)
        if size > TAG_MAX_BYTES:
            break
        chunks.append(chunk)
    if size > TAG_MAX_BYTES:
        # The provider lied about the size; fetch again and stream untouched.
        try:
            retry = fetch_source_file(payload)
        except SongSourceError:
            return JsonResponse(
                {"error": "The song source is temporarily unavailable."}, status=502
            )
        return _attachment_response(
            StreamingHttpResponse(retry.iter_content(64 * 1024), content_type=content_type),
            entry,
            content_type,
        )
    data = b"".join(chunks)
    tagged = tagged_audio(data, content_type, entry)
    if tagged is not None:
        data = tagged
    return _attachment_response(HttpResponse(data, content_type=content_type), entry, content_type)

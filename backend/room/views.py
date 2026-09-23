import mimetypes
import re
from functools import wraps
from urllib.parse import urlparse

from django.core.files.uploadedfile import UploadedFile
from django.db import IntegrityError, connection, transaction
from django.http import FileResponse, JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from PIL import Image, UnidentifiedImageError

from .auth_views import member_for
from .bookshelf_fixture import ensure_physical_bookshelf
from .models import RoomEntry, RoomEvent
from .serializers import (
    IMAGE_TYPES,
    RECORDING_TYPES,
    ValidationFailure,
    clean_entry_payload,
    entry_json,
    event_json,
    parse_json_body,
)


def member_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated or member_for(request) is None:
            return JsonResponse({"error": "Sign in required."}, status=401)
        return view(request, *args, **kwargs)

    return wrapped


@require_GET
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return JsonResponse({"status": "degraded", "database": "unavailable"}, status=503)
    return JsonResponse({"status": "ok", "database": "ok"})


@require_GET
@member_required
def room_snapshot(request):
    # Provisioning can happen after migrations, so ensure starter shelf rows
    # exist when the first member opens the room.
    owner = (
        request.user.__class__.objects.filter(room_membership__role="owner").first()
        or request.user
    )
    ensure_physical_bookshelf(owner=owner)
    return JsonResponse(
        {
            # pyrefly: ignore [missing-attribute]
            "entries": [entry_json(request, entry) for entry in RoomEntry.objects.all()],
            # pyrefly: ignore [missing-attribute]
            "events": [event_json(event) for event in RoomEvent.objects.all()[:30]],
        }
    )


@require_POST
@csrf_protect
@member_required
def entry_collection(request):
    try:
        payload = clean_entry_payload(parse_json_body(request))
        validate_upload(request.FILES.get("image"), IMAGE_TYPES, 5 * 1024 * 1024)
        validate_upload(request.FILES.get("recording"), RECORDING_TYPES, 50 * 1024 * 1024)
        if request.FILES.get("recording") and payload["kind"] != "request":
            raise ValidationFailure("Recordings belong only to violin requests.")
        # pyrefly: ignore [bad-context-manager]
        with transaction.atomic():
            # pyrefly: ignore [missing-attribute]
            entry = RoomEntry.objects.create(created_by=request.user, **payload)
            attach_files(entry, request)
            if request.FILES:
                entry.save()
            # pyrefly: ignore [missing-attribute]
            RoomEvent.objects.create(
                actor=request.user, title=entry.title, kind=entry.kind, action="Added"
            )
        return JsonResponse(entry_json(request, entry), status=201)
    except ValidationFailure as error:
        return JsonResponse({"error": str(error)}, status=400)
    except IntegrityError:
        return JsonResponse({"error": "That catalogue item is already in the room."}, status=409)


@require_http_methods(["PUT", "PATCH", "DELETE"])
@csrf_protect
@member_required
def entry_detail(request, entry_id):
    try:
        # pyrefly: ignore [missing-attribute]
        entry = RoomEntry.objects.get(id=entry_id)
    # pyrefly: ignore [missing-attribute]
    except RoomEntry.DoesNotExist:
        return JsonResponse({"error": "That item is no longer in the room."}, status=404)
    if request.method == "DELETE":
        try:
            expected = int(request.headers.get("X-Entry-Version", "0"))
        except ValueError:
            expected = 0
        if expected != entry.version:
            return JsonResponse(
                {"error": "This item changed. Reload it before removing it."}, status=409
            )
        # pyrefly: ignore [bad-context-manager]
        with transaction.atomic():
            # pyrefly: ignore [missing-attribute]
            RoomEvent.objects.create(
                actor=request.user, title=entry.title, kind=entry.kind, action="Removed"
            )
            entry.delete()
        return JsonResponse({"ok": True})
    try:
        payload = clean_entry_payload(parse_json_body(request))
        expected = int(
            request.headers.get("X-Entry-Version", parse_json_body(request).get("version", 0))
        )
        validate_upload(request.FILES.get("image"), IMAGE_TYPES, 5 * 1024 * 1024)
        validate_upload(request.FILES.get("recording"), RECORDING_TYPES, 50 * 1024 * 1024)
        if request.FILES.get("recording") and payload["kind"] != "request":
            raise ValidationFailure("Recordings belong only to violin requests.")
    except (ValidationFailure, TypeError, ValueError) as error:
        return JsonResponse({"error": str(error) or "The item could not be saved."}, status=400)
    if expected != entry.version:
        return JsonResponse({"error": "This item changed. Reload it before saving."}, status=409)
    old_image = entry.image_file.name if entry.image_file else None
    old_recording = entry.recording_file.name if entry.recording_file else None
    replaced_image = "image" in request.FILES or request.POST.get("clear_image") == "true"
    replaced_recording = (
        "recording" in request.FILES or request.POST.get("clear_recording") == "true"
    )
    # pyrefly: ignore [bad-context-manager]
    with transaction.atomic():
        for field, value in payload.items():
            setattr(entry, field, value)
        entry.version += 1
        attach_files(entry, request)
        if replaced_image:
            entry.image_url = None
        entry.save()
        # pyrefly: ignore [missing-attribute]
        RoomEvent.objects.create(
            actor=request.user, title=entry.title, kind=entry.kind, action="Updated"
        )
    if old_image and replaced_image:
        entry.image_file.storage.delete(old_image)
    if old_recording and replaced_recording:
        entry.recording_file.storage.delete(old_recording)
    return JsonResponse(entry_json(request, entry))


@require_GET
@member_required
def entry_media(request, media_kind, entry_id):
    if media_kind not in {"images", "recordings"}:
        return JsonResponse({"error": "Attachment not found."}, status=404)
    try:
        # pyrefly: ignore [missing-attribute]
        entry = RoomEntry.objects.get(id=entry_id)
    # pyrefly: ignore [missing-attribute]
    except RoomEntry.DoesNotExist:
        return JsonResponse({"error": "Attachment not found."}, status=404)
    field = entry.image_file if media_kind == "images" else entry.recording_file
    if not field:
        return JsonResponse({"error": "Attachment not found."}, status=404)
    response = FileResponse(
        field.open("rb"),
        content_type=entry.recording_type
        if media_kind == "recordings" and entry.recording_type
        else mimetypes.guess_type(field.name)[0] or "application/octet-stream",
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


@require_POST
@csrf_protect
@member_required
def import_spotify(request):
    return import_entries(request, "spotify")


@require_POST
@csrf_protect
@member_required
def import_imdb(request):
    return import_entries(request, "imdb")


def validate_upload(file: UploadedFile | None, allowed: set[str], max_size: int):
    if not file:
        return
    # pyrefly: ignore [unsupported-operation]
    m4a_by_extension = (
        allowed == RECORDING_TYPES
        and file.name.lower().endswith(".m4a")
        and file.content_type in {"", "application/octet-stream"}
    )
    if file.size > max_size or (
        file.content_type not in allowed and not m4a_by_extension
    ):
        raise ValidationFailure("This attachment type or size is not allowed.")
    if file.content_type in IMAGE_TYPES:
        try:
            # pyrefly: ignore [bad-argument-type]
            Image.open(file).verify()
            file.seek(0)
        except (UnidentifiedImageError, OSError) as error:
            raise ValidationFailure("This image file could not be verified.") from error


def attach_files(entry: RoomEntry, request):
    image = request.FILES.get("image")
    recording = request.FILES.get("recording")
    if request.POST.get("clear_image") == "true":
        # pyrefly: ignore [bad-assignment]
        entry.image_file = None
    if request.POST.get("clear_recording") == "true":
        # pyrefly: ignore [bad-assignment]
        entry.recording_file = None
        # pyrefly: ignore [bad-assignment]
        entry.recording_type = None
    if image:
        entry.image_file = image
    if recording:
        entry.recording_file = recording
        entry.recording_type = (
            "audio/mp4"
            if recording.name.lower().endswith(".m4a")
            and recording.content_type in {"", "application/octet-stream"}
            else recording.content_type
        )


def import_entries(request, provider: str):
    try:
        payload = parse_json_body(request)
        items = payload.get("songs" if provider == "spotify" else "films")
        if not isinstance(items, list) or not 1 <= len(items) <= 250:
            raise ValidationFailure("Import from 1 to 250 items at a time.")
        # Cover hosts the room will reference remotely. An unknown Spotify CDN
        # host must degrade to no cover, never fail the import batch.
        cover_hosts = {
            "books.google.com",
            "books.googleusercontent.com",
            "covers.openlibrary.org",
            "i.scdn.co",
            "image-cdn-ak.spotifycdn.com",
            "image-cdn-fa.spotifycdn.com",
        }
        seen = set()
        prepared = []
        for item in items:
            if not isinstance(item, dict):
                raise ValidationFailure("The import contains an invalid item.")
            if provider == "spotify":
                track_id = str(item.get("spotify_id", ""))
                if track_id in seen or not re.fullmatch(r"[A-Za-z0-9]{22}", track_id):
                    raise ValidationFailure(
                        "The Spotify import contains a duplicate or invalid track."
                    )
                seen.add(track_id)
                cover = item.get("image")
                if not isinstance(cover, str) or urlparse(cover).hostname not in cover_hosts:
                    cover = None
                clean = clean_entry_payload(
                    {
                        "kind": "music",
                        "title": item.get("title"),
                        "creator": item.get("creator"),
                        "note": "",
                        "status": "Saved",
                        "progress": 0,
                        "rating": 0,
                        "format": "Spotify liked song",
                        "link": f"https://open.spotify.com/track/{track_id}",
                        "image_url": cover,
                        "source_id": f"spotify:{track_id}",
                        "provider_added_at": item.get("added_at"),
                        "provider_album": item.get("album"),
                        "provider_release_year": item.get("release_year"),
                        "provider_duration_ms": item.get("duration_ms"),
                    }
                )
            else:
                imdb_id = str(item.get("imdb_id", ""))
                if imdb_id in seen or not re.fullmatch(r"tt\d{7,12}", imdb_id):
                    raise ValidationFailure(
                        "The IMDb import contains a duplicate or invalid title."
                    )
                seen.add(imdb_id)
                clean = clean_entry_payload(
                    {
                        "kind": "film",
                        "title": item.get("title"),
                        "creator": item.get("creator"),
                        "note": item.get("note", ""),
                        "status": "Watchlist",
                        "progress": 0,
                        "rating": 0,
                        "format": item.get("format", "Film"),
                        "link": f"https://www.imdb.com/title/{imdb_id}/",
                        "source_id": f"imdb:{imdb_id}",
                    }
                )
            prepared.append(clean)
        added = skipped = 0
        # pyrefly: ignore [bad-context-manager]
        with transaction.atomic():
            for clean in prepared:
                identity = clean["source_id"]
                # pyrefly: ignore [missing-attribute]
                existing = RoomEntry.objects.filter(kind=clean["kind"], source_id=identity).first()
                if existing:
                    for field in (
                        "provider_added_at",
                        "provider_album",
                        "provider_release_year",
                        "provider_duration_ms",
                        "image_url",
                    ):
                        if (
                            provider == "spotify"
                            and getattr(existing, field) is None
                            and clean[field] is not None
                        ):
                            setattr(existing, field, clean[field])
                    if provider == "spotify" and existing.version:
                        existing.save(
                            update_fields=[
                                "provider_added_at",
                                "provider_album",
                                "provider_release_year",
                                "provider_duration_ms",
                                "image_url",
                            ]
                        )
                    skipped += 1
                    continue
                # pyrefly: ignore [missing-attribute]
                entry = RoomEntry.objects.create(created_by=request.user, **clean)
                # pyrefly: ignore [missing-attribute]
                RoomEvent.objects.create(
                    actor=request.user, title=entry.title, kind=entry.kind, action="Added"
                )
                added += 1
        return JsonResponse({"added": added, "skipped": skipped})
    except ValidationFailure as error:
        return JsonResponse({"error": str(error)}, status=400)
    except IntegrityError:
        return JsonResponse(
            {"error": "The import changed while it was being saved. Retry it safely."}, status=409
        )

"""Canonical room fixture exported from the latest private room snapshot."""

import json
import shutil
from pathlib import Path

from django.conf import settings
from django.db import transaction

FIXTURE_VERSION = 3
FIXTURE_PATH = Path(__file__).with_name("fixture_data.json")
ASSET_PATH = Path(__file__).with_name("fixture_media")


def _data():
    with FIXTURE_PATH.open(encoding="utf-8") as source:
        return json.load(source)


def _copy_asset(source_name, target_name):
    if not source_name:
        return None
    source = ASSET_PATH / source_name
    if not source.is_file():
        return None
    target = Path(settings.MEDIA_ROOT) / "room" / "fixture" / target_name
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.stat().st_size != source.stat().st_size:
        shutil.copyfile(source, target)
    return str(target.relative_to(settings.MEDIA_ROOT))


def apply_room_fixture(*, owner, apps=None):
    if apps is not None:
        RoomEntry = apps.get_model("room", "RoomEntry")
        ShelfLayout = apps.get_model("room", "ShelfLayout")
        ShelfDecoration = apps.get_model("room", "ShelfDecoration")
    else:
        from .models import RoomEntry, ShelfDecoration, ShelfLayout

    data = _data()
    entries = data["entries"]
    ids = {item["id"] for item in entries}
    with transaction.atomic():
        layout, _ = ShelfLayout.objects.select_for_update().get_or_create(pk=1)
        if getattr(layout, "fixture_version", 0) >= FIXTURE_VERSION:
            return
        for item in entries:
            defaults = {
                key: item.get(key)
                for key in (
                    "kind", "title", "creator", "note", "status", "progress",
                    "rating", "format", "link", "image_url", "source_id",
                    "provider_added_at", "provider_album", "provider_release_year",
                    "details", "version", "shelf_cubby", "shelf_position",
                    "shelf_orientation", "shelf_stack",
                )
            }
            defaults["created_by"] = owner
            entry, _ = RoomEntry.objects.update_or_create(id=item["id"], defaults=defaults)
            image_name = _copy_asset(item.get("fixture_image"), f"{entry.id}-image.webp")
            recording_name = _copy_asset(item.get("fixture_recording"), f"{entry.id}-recording.m4a")
            updates = []
            if image_name and entry.image_file.name != image_name:
                entry.image_file.name = image_name
                updates.append("image_file")
            if recording_name and entry.recording_file.name != recording_name:
                entry.recording_file.name = recording_name
                updates.append("recording_file")
            if updates:
                entry.save(update_fields=updates)
        RoomEntry.objects.exclude(id__in=ids).delete()
        ShelfDecoration.objects.all().delete()
        layout.revision = data["layout"]["revision"]
        layout.fixture_version = FIXTURE_VERSION
        layout.save(update_fields=["revision", "fixture_version", "updated_at"])


def ensure_physical_bookshelf(*, owner, apps=None):
    """Apply the full canonical room snapshot after member provisioning."""

    apply_room_fixture(owner=owner, apps=apps)

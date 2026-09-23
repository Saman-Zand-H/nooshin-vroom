import uuid

from django.conf import settings
from django.db import models


class RoomMember(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        MEMBER = "member", "Member"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="room_membership",
    )
    display_name = models.CharField(max_length=80)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    slot = models.PositiveSmallIntegerField(unique=True, choices=((1, "One"), (2, "Two")))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("slot",)


class RoomEntry(models.Model):
    KIND_CHOICES = (
        ("book", "Book"),
        ("music", "Music"),
        ("wish", "Wish"),
        ("request", "Request"),
        ("note", "Note"),
        ("film", "Film"),
        ("game", "Game"),
        ("movie_night", "Movie night"),
        ("adventure", "Adventure"),
        ("lyric", "Lyric"),
        ("love", "Little love"),
        ("cycle", "Moon days"),
        ("body", "Weigh-in"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=32, choices=KIND_CHOICES)
    title = models.CharField(max_length=240)
    creator = models.CharField(max_length=180, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=32)
    progress = models.PositiveSmallIntegerField(default=0)
    rating = models.PositiveSmallIntegerField(default=0)
    format = models.CharField(max_length=80, blank=True)
    link = models.URLField(max_length=2000, blank=True)
    image_url = models.URLField(max_length=2000, blank=True, null=True)
    image_file = models.FileField(upload_to="room/images/%Y/%m/", blank=True, null=True)
    recording_file = models.FileField(upload_to="room/recordings/%Y/%m/", blank=True, null=True)
    recording_type = models.CharField(max_length=80, blank=True, null=True)
    source_id = models.CharField(max_length=200, blank=True, null=True)
    provider_added_at = models.DateTimeField(blank=True, null=True)
    provider_album = models.CharField(max_length=240, blank=True, null=True)
    provider_release_year = models.PositiveSmallIntegerField(blank=True, null=True)
    provider_duration_ms = models.PositiveIntegerField(blank=True, null=True)
    details = models.JSONField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="room_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    version = models.PositiveIntegerField(default=1)
    shelf_cubby = models.PositiveSmallIntegerField(default=0)
    shelf_position = models.PositiveIntegerField(default=0)
    shelf_orientation = models.CharField(
        max_length=12,
        choices=(("vertical", "Vertical"), ("horizontal", "Horizontal")),
        default="vertical",
    )
    shelf_stack = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        ordering = ("-updated_at", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("kind", "source_id"),
                condition=models.Q(source_id__isnull=False),
                name="room_entry_source_unique",
            )
        ]


class RoomEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="room_events",
    )
    title = models.CharField(max_length=240)
    kind = models.CharField(max_length=32)
    action = models.CharField(max_length=16)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")


class ShelfLayout(models.Model):
    """The shared physical bookshelf arrangement (one room, one revision)."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    revision = models.PositiveIntegerField(default=1)
    # Version of the bundled starter fixture already applied.  This lets the
    # first request seed after user provisioning without re-adding deletions.
    fixture_version = models.PositiveSmallIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)


class ShelfDecoration(models.Model):
    KIND_CHOICES = (
        ("mug", "Engineer mug"),
        ("pinecones", "Pinecones"),
        ("dolls", "Doll couple"),
        ("headphones", "Headphones"),
        ("stationery", "Stationery"),
        ("eggs", "Painted eggs"),
        ("roses", "Rose vase"),
        ("speaker", "Speaker"),
        ("tea-set", "Tea set"),
        ("keepsakes", "Keepsakes"),
        ("notebooks", "Notebooks"),
        ("binders", "Tall binders"),
        ("paperback-stack", "Paperback stack"),
        ("bust", "Bust"),
        ("vase", "Vase"),
        ("globe", "Globe"),
        ("plant", "Plant"),
        ("candle", "Candle"),
        ("postcard", "Postcard"),
        ("ticket", "Ticket"),
        ("custom", "Custom"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    label = models.CharField(max_length=80)
    cubby = models.PositiveSmallIntegerField(default=0)
    position = models.PositiveIntegerField(default=0)
    image_file = models.FileField(upload_to="room/decor/%Y/%m/", blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)


class SpotifyAccount(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True
    )
    spotify_id = models.CharField(max_length=160)
    display_name = models.CharField(max_length=160, blank=True)
    token_box = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)


class SpotifyState(models.Model):
    state_hash = models.CharField(max_length=128, primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    verifier_box = models.TextField()
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ImdbWatchlistConnection(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True
    )
    source_url = models.URLField(max_length=512)
    profile_id = models.CharField(max_length=160)
    last_attempt_at = models.DateTimeField(blank=True, null=True)
    last_success_at = models.DateTimeField(blank=True, null=True)
    next_refresh_at = models.DateTimeField()
    title_count = models.PositiveIntegerField(default=0)
    last_added = models.PositiveIntegerField(default=0)
    last_error = models.CharField(max_length=32, blank=True, null=True)
    lease_id = models.UUIDField(blank=True, null=True)
    lease_expires_at = models.DateTimeField(blank=True, null=True)
    snapshot_ids = models.JSONField(default=list)

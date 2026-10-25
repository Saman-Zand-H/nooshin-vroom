import tempfile

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from .models import RoomMember


class PrivateApiCacheTests(TestCase):
    """A CDN fronts the site, so API responses must forbid shared caching."""

    def setUp(self):
        # Opening the room seeds the bookshelf, which copies fixture images.
        media = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(override_settings(MEDIA_ROOT=media))

    def test_room_snapshot_is_private(self):
        user = get_user_model().objects.create_user(
            username="member@example.test", email="member@example.test"
        )
        # pyrefly: ignore [missing-attribute]
        RoomMember.objects.create(user=user, display_name="Member", slot=1, role="owner")
        self.client.force_login(user)
        response = self.client.get("/api/room/")
        # pyrefly: ignore [missing-attribute]
        self.assertEqual(response.status_code, 200)
        # pyrefly: ignore [bad-index]
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_signed_out_responses_are_private(self):
        for path in ("/api/room/", "/api/auth/session/", "/api/health/"):
            with self.subTest(path=path):
                response = self.client.get(path)
                # pyrefly: ignore [bad-index]
                self.assertEqual(response["Cache-Control"], "private, no-store")

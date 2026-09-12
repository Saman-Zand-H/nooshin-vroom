from cryptography.fernet import Fernet
from django.test import SimpleTestCase, override_settings

from .spotify_service import configuration_issues, is_configured, redirect_uri_for_host


class SpotifyConfigurationTests(SimpleTestCase):
    key = Fernet.generate_key().decode()

    @override_settings(
        SPOTIFY_CLIENT_ID="client",
        SPOTIFY_CLIENT_SECRET="secret",
        SPOTIFY_REDIRECT_URI="http://127.0.0.1:5188/api/spotify/callback/",
        SPOTIFY_TOKEN_KEY=key,
    )
    def test_complete_server_configuration_is_ready(self):
        self.assertEqual(configuration_issues(), [])
        self.assertTrue(is_configured())

    @override_settings(
        SPOTIFY_CLIENT_ID="client",
        SPOTIFY_CLIENT_SECRET="secret",
        SPOTIFY_REDIRECT_URI="http://127.0.0.1:5188/api/spotify/callback/",
        SPOTIFY_TOKEN_KEY="",
    )
    def test_missing_encryption_key_is_reported(self):
        self.assertEqual(configuration_issues(), ["SPOTIFY_TOKEN_KEY"])
        self.assertFalse(is_configured())

    @override_settings(
        SPOTIFY_CLIENT_ID="client",
        SPOTIFY_CLIENT_SECRET="secret",
        SPOTIFY_REDIRECT_URI="http://127.0.0.1:5188/api/spotify/callback/",
        SPOTIFY_TOKEN_KEY="not-a-fernet-key",
    )
    def test_invalid_encryption_key_is_reported(self):
        self.assertEqual(configuration_issues(), ["SPOTIFY_TOKEN_KEY"])
        self.assertFalse(is_configured())

    @override_settings(
        SPOTIFY_REDIRECT_URI="http://127.0.0.1:5188/api/spotify/callback/",
        SPOTIFY_REDIRECT_URIS=[
            "http://localhost:5188/api/spotify/callback/",
            "http://127.0.0.1:5188/api/spotify/callback/",
        ],
    )
    def test_loopback_host_selects_matching_registered_callback(self):
        self.assertEqual(
            redirect_uri_for_host("localhost:5188"),
            "http://localhost:5188/api/spotify/callback/",
        )
        self.assertEqual(
            redirect_uri_for_host("localhost"),
            "http://localhost:5188/api/spotify/callback/",
        )
        self.assertEqual(
            redirect_uri_for_host("127.0.0.1:5188"),
            "http://127.0.0.1:5188/api/spotify/callback/",
        )

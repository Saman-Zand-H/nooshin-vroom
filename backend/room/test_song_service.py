import time
from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase, override_settings

from . import song_service


class _FakeResponse:
    def __init__(self, status_code=200, headers=None):
        self.status_code = status_code
        self.headers = headers or {}

    def close(self):
        pass


class PickAudioFormatTests(SimpleTestCase):
    def test_m4a_beats_higher_bitrate_webm(self):
        formats = [
            {
                "format_id": "251",
                "ext": "webm",
                "vcodec": "none",
                "acodec": "opus",
                "abr": 160,
                "url": "opus-url",
            },
            {
                "format_id": "140",
                "ext": "m4a",
                "vcodec": "none",
                "acodec": "mp4a.40.2",
                "abr": 128,
                "url": "m4a-url",
            },
        ]
        picked = song_service._pick_audio_format(formats)
        assert picked is not None
        self.assertEqual(picked["format_id"], "140")

    def test_video_and_storyboard_streams_are_ignored(self):
        formats = [
            {"format_id": "18", "ext": "mp4", "vcodec": "avc1", "acodec": "mp4a", "url": "v"},
            {"format_id": "sb0", "ext": "m4a", "vcodec": "none", "acodec": "none", "url": "sb"},
            {"format_id": "140", "ext": "m4a", "vcodec": "none", "acodec": "mp4a.40.2", "url": "a"},
        ]
        picked = song_service._pick_audio_format(formats)
        assert picked is not None
        self.assertEqual(picked["format_id"], "140")

    def test_no_audio_only_stream_is_a_miss(self):
        formats = [
            {"format_id": "18", "ext": "mp4", "vcodec": "avc1", "acodec": "mp4a", "url": "v"}
        ]
        self.assertIsNone(song_service._pick_audio_format(formats))
        self.assertIsNone(song_service._pick_audio_format([]))


class UncreditedTierTests(SimpleTestCase):
    def _entry(self):
        return SimpleNamespace(
            id=5, title="Summer Wine", creator="ceZk", provider_duration_ms=295367
        )

    def test_clean_title_with_matching_duration_wins(self):
        score = song_service._youtube_uncredited_score(self._entry(), "*SUMMER WINE*", 296)
        assert score is not None
        self.assertGreater(score, 90)

    def test_longer_title_of_another_song_is_rejected(self):
        # "Last of the Summer Wine" is a sitcom named after the song.
        self.assertIsNone(
            song_service._youtube_uncredited_score(
                self._entry(), "Last of the Summer Wine - Season 28 Episode 03", 295
            )
        )

    def test_other_artists_version_is_rejected(self):
        self.assertIsNone(
            song_service._youtube_uncredited_score(
                self._entry(), "Summer Wine - Nancy Sinatra & Lee Hazlewood", 260
            )
        )

    def test_derivative_marker_is_rejected(self):
        self.assertIsNone(
            song_service._youtube_uncredited_score(self._entry(), "Summer Wine (Single Edit)", 295)
        )

    def test_far_duration_is_rejected(self):
        self.assertIsNone(song_service._youtube_uncredited_score(self._entry(), "Summer Wine", 320))

    def test_near_title_without_duration_is_rejected(self):
        self.assertIsNone(
            song_service._youtube_uncredited_score(
                self._entry(), "Summer Wine Official Video", None
            )
        )

    def test_exactly_named_upload_passes_without_duration(self):
        entry = SimpleNamespace(
            id=7, title="Summer Wine", creator="ceZk", provider_duration_ms=None
        )
        score = song_service._youtube_uncredited_score(entry, "Summer Wine", None)
        self.assertEqual(score, 100.0)
        self.assertEqual(
            song_service._youtube_uncredited_score(entry, "*SUMMER WINE*", None), 100.0
        )

    def test_winner_is_labelled_the_closest_version(self):
        winner = song_service._youtube_uncredited(self._entry(), [("abc", "*SUMMER WINE*", 296)])
        assert winner is not None
        self.assertEqual(winner["variant"], "derivative")
        self.assertEqual(winner["page"], "https://www.youtube.com/watch?v=abc")
        self.assertIsNone(song_service._youtube_uncredited(self._entry(), []))

    def test_queries_widen_to_the_bare_title_without_duplicates(self):
        self.assertEqual(
            song_service._youtube_queries(self._entry()),
            ["ceZk Summer Wine", "Summer Wine"],
        )


class YoutubeResolveTests(SimpleTestCase):
    def test_resolve_fills_stream_url_headers_and_content_type(self):
        found = {
            "status": "found",
            "source": "youtube",
            "title": "All",
            "artist": "Snow Patrol",
            "file": "",
            "page": "https://www.youtube.com/watch?v=abc",
            "variant": "original",
        }
        info = {
            "http_headers": {"User-Agent": "yt-dlp-ua"},
            "formats": [
                {
                    "format_id": "140",
                    "ext": "m4a",
                    "vcodec": "none",
                    "acodec": "mp4a.40.2",
                    "abr": 128,
                    "url": "https://stream/m4a",
                    "http_headers": {
                        "User-Agent": "yt-dlp-ua",
                        "Referer": "https://www.youtube.com",
                    },
                }
            ],
        }
        with mock.patch.object(song_service, "_youtube_extract", return_value=info):
            resolved = song_service._youtube_resolve(found)
        assert resolved is not None
        self.assertEqual(resolved["file"], "https://stream/m4a")
        self.assertEqual(resolved["content_type"], "audio/mp4")
        self.assertEqual(resolved["headers"]["Referer"], "https://www.youtube.com")

    def test_live_stream_does_not_resolve(self):
        found = {"page": "https://www.youtube.com/watch?v=abc"}
        info = {"is_live": True, "formats": []}
        with mock.patch.object(song_service, "_youtube_extract", return_value=info):
            self.assertIsNone(song_service._youtube_resolve(found))

    @override_settings(YTDLP_ENABLED=False)
    def test_disabled_source_reports_nothing(self):
        entry = SimpleNamespace(id=1, title="All", creator="Snow Patrol")
        self.assertIsNone(song_service._youtube_match(entry))


class FetchSourceFileTests(SimpleTestCase):
    def test_verdict_headers_override_the_room_user_agent(self):
        response = _FakeResponse(200, {"Content-Type": "audio/mp4"})
        payload = {
            "file": "https://stream.example/audio",
            "headers": {"User-Agent": "yt-dlp-ua", "Referer": "https://www.youtube.com"},
        }
        with mock.patch.object(song_service.requests, "get", return_value=response) as get:
            self.assertIs(song_service.fetch_source_file(payload), response)
        headers = get.call_args.kwargs["headers"]
        self.assertEqual(headers["User-Agent"], "yt-dlp-ua")
        self.assertEqual(headers["Referer"], "https://www.youtube.com")

    def test_catalog_verdicts_keep_the_room_user_agent(self):
        response = _FakeResponse(200, {"Content-Type": "audio/mpeg"})
        with mock.patch.object(song_service.requests, "get", return_value=response) as get:
            song_service.fetch_source_file({"file": "https://cdn.example/song.mp3"})
        self.assertEqual(get.call_args.kwargs["headers"], {"User-Agent": song_service.USER_AGENT})

    def test_error_status_raises_song_source_error(self):
        with mock.patch.object(song_service.requests, "get", return_value=_FakeResponse(403)):
            with self.assertRaises(song_service.SongSourceError) as raised:
                song_service.fetch_source_file({"file": "https://stream.example/expired"})
        self.assertEqual(raised.exception.status, 502)

    def test_proxied_verdicts_fetch_through_the_verdict_proxy(self):
        response = _FakeResponse(200, {"Content-Type": "audio/mp4"})
        proxy = "socks5h://127.0.0.1:10808"
        with mock.patch.object(song_service.requests, "get", return_value=response) as get:
            song_service.fetch_source_file({"file": "https://stream", "proxy": proxy})
        self.assertEqual(get.call_args.kwargs["proxies"], {"http": proxy, "https": proxy})
        self.assertEqual(get.call_args.kwargs["timeout"], (15.05, 60))


class LyricChannelMatchTests(SimpleTestCase):
    def test_credit_in_the_title_matches_the_strict_pass(self):
        entry = SimpleNamespace(
            id=6,
            title="STORM II",
            creator="GENER8ION, Yung Lean",
            provider_duration_ms=174000,
        )
        flat = {
            "entries": [
                {
                    "id": "iHxL7o5Ejiw",
                    "title": "GENER8ION, Yung Lean - STORM II (Lyrics)",
                    "uploader": "The Vibe Guide",
                    "duration": 174,
                }
            ]
        }
        full = {
            "http_headers": {"User-Agent": "yt-dlp-ua"},
            "formats": [
                {
                    "format_id": "140",
                    "ext": "m4a",
                    "vcodec": "none",
                    "acodec": "mp4a.40.2",
                    "abr": 128,
                    "url": "https://stream/m4a",
                }
            ],
        }

        def fake_extract(options, target):
            return flat if "ytsearch" in target else full

        with mock.patch.object(song_service, "_youtube_extract", side_effect=fake_extract):
            payload = song_service._youtube_match(entry)
        assert payload is not None
        self.assertEqual(payload["page"], "https://www.youtube.com/watch?v=iHxL7o5Ejiw")
        self.assertEqual(payload["variant"], "original")
        # The card's own names label the download, not the uploader's.
        self.assertEqual(payload["title"], "STORM II")
        self.assertEqual(payload["artist"], "GENER8ION, Yung Lean")


class LookupCacheTests(SimpleTestCase):
    def setUp(self):
        song_service._lookup_cache.clear()
        self.addCleanup(song_service._lookup_cache.clear)

    def _entry(self):
        return SimpleNamespace(
            id=77,
            title="All",
            creator="Snow Patrol",
            song_file=None,
            provider_duration_ms=210000,
        )

    def test_youtube_verdicts_expire_with_the_stream_url(self):
        entry = self._entry()
        with (
            mock.patch.object(song_service, "_jamendo_match", return_value=None),
            mock.patch.object(song_service, "_audius_match", return_value=None),
            mock.patch.object(song_service, "_archive_match", return_value=None),
            mock.patch.object(
                song_service,
                "_youtube_match",
                return_value={"status": "found", "source": "youtube", "file": "https://s"},
            ),
        ):
            payload = song_service.lookup_song(entry)
        self.assertEqual(payload["source"], "youtube")
        key = (song_service._CACHE_VERSION, entry.id)
        expires_at, cached = song_service._lookup_cache[key]
        self.assertIs(cached, payload)
        remaining = expires_at - time.monotonic()
        self.assertLessEqual(remaining, song_service.YOUTUBE_URL_TTL_SECONDS)
        self.assertGreater(remaining, song_service.YOUTUBE_URL_TTL_SECONDS - 10)
        song_service.evict_lookup(entry)
        self.assertNotIn(key, song_service._lookup_cache)

    def test_misses_expire_quickly_so_a_blocked_source_retries(self):
        entry = self._entry()
        with (
            override_settings(JAMENDO_CLIENT_ID=""),
            mock.patch.object(song_service, "_jamendo_match", return_value=None),
            mock.patch.object(song_service, "_audius_match", return_value=None),
            mock.patch.object(song_service, "_archive_match", return_value=None),
            mock.patch.object(song_service, "_youtube_match", return_value=None),
        ):
            payload = song_service.lookup_song(entry)
        self.assertEqual(payload, {"status": "miss"})
        key = (song_service._CACHE_VERSION, entry.id)
        expires_at, _ = song_service._lookup_cache[key]
        remaining = expires_at - time.monotonic()
        self.assertLessEqual(remaining, song_service.MISS_TTL_SECONDS)
        self.assertGreater(remaining, song_service.MISS_TTL_SECONDS - 10)

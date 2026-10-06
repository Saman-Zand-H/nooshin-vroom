"""Probe YouTube reachability exactly the way the song service uses it.

Run on the server when songs report misses:

    python manage.py check_youtube
    python manage.py check_youtube --proxy socks5://127.0.0.1:1080

Prints the raw yt-dlp and stream errors so a blocked network says so
instead of silently turning every song into a miss.
"""

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Check yt-dlp search, stream resolution, and the stream download."

    def add_arguments(self, parser):
        parser.add_argument(
            "--proxy",
            default="",
            help="Override YTDLP_PROXY for this run, e.g. socks5://127.0.0.1:1080.",
        )

    def handle(self, *args, **options):
        import yt_dlp

        from room.song_service import _pick_audio_format, _youtube_options

        proxy = options["proxy"] or getattr(settings, "YTDLP_PROXY", "")
        self.stdout.write(f"proxy: {proxy or 'direct'}")
        self.stdout.write(f"enabled: {getattr(settings, 'YTDLP_ENABLED', True)}")

        def options_with(flat, proxy_url):
            opts = dict(_youtube_options(flat))
            if proxy_url:
                opts["proxy"] = proxy_url
            return opts

        self.stdout.write("\n[1/3] searching")
        try:
            # Built dynamically, so the options dict cannot carry yt-dlp's
            # TypedDict shape.
            with yt_dlp.YoutubeDL(options_with(True, proxy)) as ydl:  # pyrefly: ignore [bad-argument-type]
                info = ydl.extract_info("ytsearch3:Taylor Swift This Love", download=False)
            entries = [e for e in (info or {}).get("entries") or [] if e]
            for entry in entries:
                self.stdout.write(
                    f"  {entry.get('id')} {entry.get('duration')}s {entry.get('title')!r}"
                    f" by {entry.get('uploader')!r}"
                )
            winner = entries[0] if entries else None
        except Exception as error:
            self.stderr.write(f"  search failed: {error}")
            return
        if winner is None:
            self.stderr.write("  search returned no results")
            return

        self.stdout.write("\n[2/3] resolving the stream")
        try:
            with yt_dlp.YoutubeDL(options_with(False, proxy)) as ydl:  # pyrefly: ignore [bad-argument-type]
                full = ydl.extract_info(
                    f"https://www.youtube.com/watch?v={winner.get('id')}", download=False
                )
        except Exception as error:
            self.stderr.write(f"  resolve failed: {error}")
            return
        fmt = _pick_audio_format((full or {}).get("formats") or [])
        if fmt is None:
            self.stderr.write("  no audio-only stream in the formats")
            return
        self.stdout.write(f"  picked {fmt.get('format_id')} ({fmt.get('ext')})")

        self.stdout.write("\n[3/3] downloading the stream")
        import requests

        try:
            response = requests.get(
                fmt["url"],
                headers=fmt.get("http_headers") or {"User-Agent": "for-nooshin-room/1.0"},
                proxies={"http": proxy, "https": proxy} if proxy else None,
                stream=True,
                timeout=(15.05, 60),
            )
            if response.status_code != 200:
                self.stderr.write(
                    f"  stream answered {response.status_code}; the proxy exit ip "
                    "differs from the resolving one, or the url expired"
                )
                return
            chunk = next(response.iter_content(65536), b"")
            self.stdout.write(
                f"  stream ok: {response.headers.get('Content-Type')}, "
                f"{response.headers.get('Content-Length')} bytes, first chunk {len(chunk)}"
            )
        except requests.RequestException as error:
            self.stderr.write(f"  stream failed: {error}")
            return
        self.stdout.write("\nYouTube path is healthy from here.")

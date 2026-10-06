"""Embed cover art and clean tags into song files served to members."""

import base64
import io
from functools import lru_cache

import requests
from mutagen.flac import FLAC, Picture
from mutagen.id3 import APIC, TALB, TDRC, TIT2, TPE1
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4, MP4Cover
from mutagen.oggvorbis import OggVorbis

from .models import RoomEntry

ART_TIMEOUT = (3.05, 10)
ART_MAX_BYTES = 3 * 1024 * 1024
ART_TYPES = {"image/jpeg", "image/png"}

# Formats the tagger knows how to rewrite; anything else passes through.
TAGGERS = {
    "audio/mpeg": "id3",
    "audio/mp3": "id3",
    "audio/mp4": "mp4",
    "audio/m4a": "mp4",
    "audio/x-m4a": "mp4",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/ogg": "ogg",
    "application/ogg": "ogg",
    "audio/vorbis": "ogg",
}


@lru_cache(maxsize=64)
def _fetch_cover(url: str) -> tuple[str, bytes] | None:
    try:
        response = requests.get(url, timeout=ART_TIMEOUT, stream=True)
        response.raise_for_status()
        content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip()
        if content_type not in ART_TYPES:
            return None
        chunks = []
        size = 0
        for chunk in response.iter_content(64 * 1024):
            size += len(chunk)
            if size > ART_MAX_BYTES:
                return None
            chunks.append(chunk)
    except requests.RequestException:
        return None
    return content_type, b"".join(chunks)


def _cover(entry: RoomEntry) -> tuple[str, bytes] | None:
    url = str(entry.image_url or "").strip()
    if not url.startswith("https://"):
        return None
    return _fetch_cover(url)


def _meta(entry: RoomEntry) -> tuple[str, str, str, str]:
    return (
        str(entry.title or ""),
        str(entry.creator or ""),
        str(entry.provider_album or ""),
        str(entry.provider_release_year or ""),
    )


def _tag_id3(data: bytes, entry: RoomEntry) -> bytes:
    title, artist, album, year = _meta(entry)
    # mutagen rewrites tags in place, so load and save the same buffer.
    buffer = io.BytesIO(data)
    audio = MP3(buffer)
    if audio.tags is None:
        audio.add_tags()
    # add_tags() installs an empty frame set, so tags is set from here on.
    tags = audio.tags
    assert tags is not None
    tags.setall("TIT2", [TIT2(encoding=3, text=title)])
    tags.setall("TPE1", [TPE1(encoding=3, text=artist)])
    if album:
        tags.setall("TALB", [TALB(encoding=3, text=album)])
    if year:
        tags.setall("TDRC", [TDRC(encoding=3, text=year)])
    cover = _cover(entry)
    if cover:
        mime, art = cover
        tags.setall("APIC", [APIC(mime=mime, type=3, desc="Cover", data=art)])
    # ID3v2.3 keeps the art readable in every player, including car stereos.
    audio.save(buffer, v2_version=3)
    return buffer.getvalue()


def _tag_mp4(data: bytes, entry: RoomEntry) -> bytes:
    title, artist, album, year = _meta(entry)
    buffer = io.BytesIO(data)
    audio = MP4(buffer)
    if audio.tags is None:
        audio.add_tags()
    audio["\xa9nam"] = [title]
    audio["\xa9ART"] = [artist]
    if album:
        audio["\xa9alb"] = [album]
    if year:
        audio["\xa9day"] = [year]
    cover = _cover(entry)
    if cover:
        mime, art = cover
        imageformat = MP4Cover.FORMAT_PNG if mime == "image/png" else MP4Cover.FORMAT_JPEG
        audio["covr"] = [MP4Cover(art, imageformat=imageformat)]
    audio.save(buffer)
    return buffer.getvalue()


def _tag_flac(data: bytes, entry: RoomEntry) -> bytes:
    title, artist, album, year = _meta(entry)
    buffer = io.BytesIO(data)
    audio = FLAC(buffer)
    audio["title"] = [title]
    audio["artist"] = [artist]
    if album:
        audio["album"] = [album]
    if year:
        audio["date"] = [year]
    cover = _cover(entry)
    if cover:
        mime, art = cover
        picture = Picture()
        picture.type = 3
        picture.mime = mime
        picture.desc = "Cover"
        picture.data = art
        audio.clear_pictures()
        audio.add_picture(picture)
    audio.save(buffer)
    return buffer.getvalue()


def _tag_ogg(data: bytes, entry: RoomEntry) -> bytes:
    title, artist, album, year = _meta(entry)
    buffer = io.BytesIO(data)
    audio = OggVorbis(buffer)
    audio["title"] = [title]
    audio["artist"] = [artist]
    if album:
        audio["album"] = [album]
    if year:
        audio["date"] = [year]
    cover = _cover(entry)
    if cover:
        mime, art = cover
        picture = Picture()
        picture.type = 3
        picture.mime = mime
        picture.desc = "Cover"
        picture.data = art
        audio["metadata_block_picture"] = [base64.b64encode(picture.write()).decode("ascii")]
    audio.save(buffer)
    return buffer.getvalue()


def tagged_audio(data: bytes, content_type: str, entry: RoomEntry) -> bytes | None:
    """Return the file with room metadata embedded, or None to serve it untouched.

    Tagging must never break a download: any failure falls back to the
    original bytes.
    """
    kind = TAGGERS.get(content_type)
    if not kind or not data:
        return None
    tagger = {"id3": _tag_id3, "mp4": _tag_mp4, "flac": _tag_flac, "ogg": _tag_ogg}[kind]
    try:
        return tagger(data, entry)
    except Exception:
        return None

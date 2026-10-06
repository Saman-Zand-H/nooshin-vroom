# ADR-0002: Back song downloads with yt-dlp

## Status

Accepted

## Date

2026-10-06

## Context

The listening room scores every song card against open download catalogs
(Jamendo, Audius, the Internet Archive) with the spotDL-style matcher in
`room/song_service.py`. Commercial music is absent from those catalogs, so
most of the room's actual library answered "miss" and fell back to asking a
member to upload a file. The room is private with exactly two provisioned
members, and its promise is that a card saves the full track, not an
apology.

## Decision

Add yt-dlp as the last source in the lookup chain, after the open catalogs.
The matcher searches YouTube through yt-dlp (`ytsearch`), scores the flat
results with the same title/artist/duration evidence as the catalogs, then
fully extracts only the winning video and serves its best audio-only
stream — preferring the m4a format because the room's tagger rewrites it
and every player opens it. Catalog verdicts stay first because their files
are unthrottled and never expire.

Songs credited to rework artists (Spotify-only credits like "ceZk") exist
on YouTube only under the original artist or a fan channel, so a strict
artist gate would miss them. A second-chance tier fires after every
credited candidate has failed: a clean, near-exact title with at most
twice the card's words and a duration within ~19 seconds is accepted and
delivered labelled "Closest version saved", since no evidence ties it to
the credited artist.

YouTube signs direct stream urls for a few hours, so youtube verdicts use a
three-hour lookup cache instead of the catalog's day, and a failed stream
fetch evicts the verdict and resolves once more before giving up.
`YTDLP_ENABLED=false` restores the catalogs-only behavior and `YTDLP_PROXY`
routes yt-dlp through a local proxy where the server's network cannot
reach YouTube.

## Consequences

YouTube's stream urls are tied to the resolving server's IP and expire, so
downloads resolve and stream through Django on the same process host, and
misses on YouTube break youtube-dlp releases occasionally until the
package is updated (`uv lock` bumps it independently of Django releases).

## Alternatives considered

### Keep catalogs-only with member uploads

Rejected as the default: it pushed the work of sourcing music onto the
members for the majority of their library.

### Download through yt-dlp into stored media files

Not taken now: it would cache large files on the server and duplicate the
upload storage path, while the room's usage pattern is occasional,
immediate downloads.

# Production launch

## Before the first deploy

1. Provision PostgreSQL (or use the local SQLite default), install the locked backend environment with `proxychains -q uv sync --directory backend`, and run `backend/.venv/bin/python backend/manage.py migrate`.
2. Provision exactly two Django users and `RoomMember` rows with slots `1` and `2` using `python backend/manage.py provision_member`; do not expose public signup. The frontend does not render the room until Django returns an authenticated session and that session has a `RoomMember` row.
3. Set `VITE_DJANGO_API_URL` and `VITE_BASE_PATH` as GitHub Actions variables, or set `VITE_DJANGO_SAME_ORIGIN=true` when Django serves the built frontend. The build rejects missing/private API configuration.
4. Set `DJANGO_SECRET_KEY`, database, cookie/CSRF origins, email, `APP_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, and `SPOTIFY_TOKEN_KEY` as Django server secrets. Never expose these through `VITE_*`.
5. Register the Django callback URI exactly in Spotify. Production redirect URIs must use HTTPS; local development may use an explicit loopback IP.
6. Configure the host with `public/_headers` or its equivalent. Replace the placeholder `https://api.example.com` in `connect-src` with the real Django API origin. Confirm `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`, and HSTS are present on the deployed HTML and worker.
7. Keep IMDb refreshes in a protected Django management job or task queue. Enable unattended refresh only after verifying a member's public list. See [IMDb connection setup](IMDB_CONNECTION.md).

The committed `compose.yaml` runs the same service topology locally: PostgreSQL
with a health gate, Django/Gunicorn with migrations, and an Nginx frontend that
proxies `/api/` to Django. Use `docker compose up --build` with a local `.env`
created from `.env.docker.example`; never use its placeholder password or
secret values in production.

## Staging acceptance

- Both invited users can sign in, recover a password, and are denied when not listed in `RoomMember`.
- A signed-out browser sees only the entryway; direct paths, refreshes, and the PWA shell never render room data without an authenticated member session. A production build cannot be created without Django API configuration.
- A book, song, wish, note, film, game, and violin request can be created, edited, removed, and viewed by both members.
- IMDb import adds selected titles once and re-imports preserve personal notes, ratings, watched status, and artwork. Test the RPC with both invited users; no external account login is involved.
- Public IMDb connection verifies a complete list before displaying success. Private/unavailable, interrupted, malformed, and empty responses preserve room films; disconnect during a delayed read cannot restore the link. Both members can manage only their own connections, and browser roles cannot call the service-role refresh RPCs. Confirm a due list updates with both browsers closed before relying on background refresh. Check the scheduler HTTP result as well as cron delivery.
- The four new corners save and reload: rabbit-hole links, movie-night choices/venues, adventure photos/pages, and lyric-wall text/styles/order.
- JPG/PNG/WebP images resize before upload; recordings accept the documented formats and limits; private media returns only signed URLs.
- Spotify is shown as disconnected before callback completion, then shows the verified Spotify profile after PKCE callback. Revoking/disconnecting removes server tokens and does not expose them to the browser.
- Spotify Saved Tracks are read through every 50-track page and imported into the shared music collection. Reconnect and forced refresh add no duplicate Spotify IDs, manually linked matches retain their edits, and partial failures remain safely resumable.
- Songs keep Spotify's save timestamp, album, and release year separately from personal fields. The Songs page sorts newest likes first and shows totals, artist/album loyalty, one-song discoveries, save years and months, release eras, newest saves, listening fingerprints, and library timeline sections from that metadata.
- Clean route paths load directly, navigate without document reload, preserve Back/Forward, and recover through the generated static-host fallback at the configured base path.
- Fifteen-second polling and visibility refresh reach both clients. A stale version produces a recoverable conflict message; Django Channels can be added later if live push is needed.
- PWA install and offline reload preserve device-local preview items; private production never caches API, auth, provider, or media responses.
- Run `npm run format:check`, `npm run typecheck`, `npm run build:preview`, production `npm run build`, `proxychains npm audit --audit-level=high`, `python backend/manage.py check --deploy`, migration checks, Django auth/room/media smoke checks, and browser smoke/a11y checks. Do not run builds sharing `dist` concurrently.

## Rollback

The frontend deployment is immutable. Roll back the frontend artifact to the previous build or revert the commit and redeploy. Keep Django migrations additive; do not remove a migration after data exists. Disable Spotify by removing the Django provider secrets or setting the provider feature off at the API boundary. Revoke both Spotify app credentials if token compromise is suspected.

Pause hosted IMDb reads with `IMDB_WATCHLIST_ENABLED=false` and stop the Django scheduled job. Keep saved films and the last successful snapshot. Query-hash changes must be re-verified against the public contract before applying an override.

## First-hour checks

Check the deployed page, `room-sw.js`, manifest, sign-in, one image upload, one shared edit, one member-protected media response, polling refresh, and the Spotify/IMDb connect/disconnect paths. Watch Django access/error logs and database health. Check IMDb's last-success timestamp and safe error code. The service intentionally does not log access tokens, provider bodies, or personal content.

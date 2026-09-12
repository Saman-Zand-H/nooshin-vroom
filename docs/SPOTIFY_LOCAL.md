# Spotify connection through Django

Spotify OAuth runs in Django in both local and hosted mode. Keep the client ID,
client secret, redirect URI, and token-encryption key in `backend/.env` or a
deployment secret manager. The browser receives only a short-lived
authorization URL and validated Spotify data.

## Setup

1. Register the Django callback in the Spotify Developer Dashboard:

   ```text
   http://127.0.0.1:8000/api/spotify/callback/
   ```

   Production callbacks must use HTTPS and the real API origin.

2. Copy `backend/.env.example` to `backend/.env` and set `APP_URL`,
   `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, and
   `SPOTIFY_TOKEN_KEY`. Keep the file mode `0600`.

3. Apply migrations and provision the two invited members:

   ```sh
   python backend/manage.py migrate
   python backend/manage.py provision_member --email you@example.com --display-name Saman --slot 1 --role owner
   python backend/manage.py provision_member --email her@example.com --display-name Nooshin --slot 2
   ```

4. Start Django and point the frontend at it:

   ```sh
   python backend/manage.py runserver 127.0.0.1:8000
   VITE_LOCAL_PREVIEW=false VITE_DJANGO_API_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5174
   ```

## Behavior

- Django stores OAuth state and encrypted access/refresh tokens server-side.
- Every Spotify request requires an authenticated room member.
- Saved Tracks reads every page at Spotify's maximum page size of 50 and imports
  the complete liked library in batches of 250.
- Imported entries use `spotify:<track-id>` identity. Reconnects skip duplicate
  IDs and manually linked track URLs while preserving personal edits and images.
- Spotify save timestamps, album names, and release years power the Songs stats
  panels and newest-first ordering.
- The local seeded preview does not connect providers. It is loopback-only and
  must never be deployed.

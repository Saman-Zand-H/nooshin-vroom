# For Nooshin

Private, two-person room for Nooshin’s stories, songs, screens, and the things worth keeping.

## Local development

```sh
proxychains npm install
# Optional seeded device preview; only works on localhost/127.0.0.1.
VITE_LOCAL_PREVIEW=true npm run dev -- --host 127.0.0.1 --port 5174
```

Production build:

```sh
# Device-local preview (no cloud project required; never deploy this artifact)
VITE_LOCAL_PREVIEW=true npm run build:preview

# Private production build (fails closed when Django is not configured)
npm run build
npm run preview
```

For a repository-hosted GitHub Pages site, build with `VITE_BASE_PATH=/<repository-name>/ npm run build`; the included workflow sets this automatically from the repository name. A custom domain can leave the base path as `/`.

The Django service exposes a Ninja API under `/api/`. Check `/api/health/` for
liveness. Interactive API docs are available at `/api/docs` only while Django
debug mode is enabled; production hides them.

Run the full local stack with Docker:

```sh
cp .env.docker.example .env
docker compose up --build
```

This starts PostgreSQL, Django, and an Nginx-served frontend. PostgreSQL and
uploaded media persist in named volumes. Provision the first room member after
the backend is healthy with `docker compose exec backend python manage.py
provision_member ...`.

`VITE_*` values are browser configuration. Do not put Spotify client secrets, Django secret keys, database passwords, or user tokens in frontend `.env` files, source, or GitHub Pages. Keep server values in `backend/.env` (mode `0600`) or your deployment secret manager.

## Current production boundary

- The interface is responsive and installable as a PWA.
- Google Books and Open Library search are live public lookups used by the add-book flow. Results are validated against an allowlist before covers render.
- Book, song, wish, note, film, game, and violin request editors accept JPG, PNG, and WebP up to 5 MB. Client-side images are resized to WebP before storage; the server validates again.
- Device-local preview uses IndexedDB, supports attachments offline, exports a JSON backup, and labels itself `On this device`.
- Private production uses Django sessions, Django Ninja, PostgreSQL, member authorization, private media responses, optimistic version checks, and a two-member membership boundary.
- Every hosted production build requires a Django API origin (or same-origin Django serving) and shows only the sign-in gate until an authenticated user is verified in Django's `RoomMember` table. Missing API configuration fails the production build; the seeded device preview is an explicit loopback-only development opt-in.
- Public IMDb Watchlist links bring new titles into Films & series and Watch nights with verified refresh times, duplicate suppression, and preserved personal edits. Django refreshes while the room is open. Private lists retain the CSV import option. See [IMDb connection and setup](docs/IMDB_CONNECTION.md) and [CSV import](docs/IMDB_IMPORT.md).
- Spotify is never shown as connected until the real OAuth callback verifies the Spotify profile and encrypted token box.
- A verified Spotify connection paginates the complete liked-song library into Songs. Stable Spotify IDs and manually saved track links prevent duplicates, while personal edits remain untouched. See [local Spotify](docs/SPOTIFY_LOCAL.md).
- New home corners: Rabbit Holes connects saved or manually named things; Watch nights keep films or series, whether she watches alone or together, venue, time, snacks, and a chosen title; Our Adventure Book keeps photo pages for memories and future plans; Wall of Lyrics keeps user-entered words, paper/lettering styles, and saved ordering. See [section behaviour](docs/ROOM_SECTIONS.md).
- Navigation uses clean paths such as `/songs`, `/films-and-series`, and `/watch-nights`, including direct-load and GitHub Pages fallbacks. See [routing](docs/ROUTING.md).

Before a private launch, install the locked backend environment with `proxychains -q uv sync --directory backend`, set the Django environment from [`backend/.env.example`](backend/.env.example), run `backend/.venv/bin/python backend/manage.py migrate`, provision exactly two members with `provision_member`, and serve the API with Gunicorn/Uvicorn behind HTTPS. Set `VITE_DJANGO_API_URL` (or `VITE_DJANGO_SAME_ORIGIN=true`) in the frontend build. Spotify credentials, token encryption, and IMDb reader settings belong only in the Django environment. Follow the staged acceptance and rollback steps in [`docs/PRODUCTION.md`](docs/PRODUCTION.md).

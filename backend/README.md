# Django service

The backend owns the private room. It uses Django sessions and built-in auth,
Django Ninja for JSON/multipart endpoints, the Django ORM, and private media
files. Django is the only backend service.

```sh
proxychains -q uv sync --dev --directory backend
cp backend/.env.example backend/.env
python backend/manage.py migrate
python backend/manage.py provision_member --email you@example.com --display-name Saman --slot 1 --role owner
python backend/manage.py provision_member --email her@example.com --display-name Nooshin --slot 2
python backend/manage.py runserver 127.0.0.1:8000
```

The API is mounted at `/api/`. `/api/health/` is the unauthenticated liveness
check. All room, media, Spotify, and IMDb endpoints require an authenticated
session and an invited `RoomMember`; unsafe requests also require CSRF.

Run static checks with `backend/.venv/bin/ruff check backend` and
`backend/.venv/bin/pyrefly check backend`. The lockfile keeps both tools
reproducible through `uv`.

For production, use PostgreSQL through `DATABASE_URL`, a random
`DJANGO_SECRET_KEY`, HTTPS, secure cookies, explicit `FRONTEND_ORIGINS`, and a
real email backend. Run `python backend/manage.py check --deploy` before
launching. Keep `backend/.env` mode `0600` and outside the frontend artifact.

The production container is defined in `backend/Dockerfile`. Run migrations as
a release step before starting its Gunicorn process; the container health check
uses the public `/api/health/` endpoint.

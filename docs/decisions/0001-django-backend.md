# ADR-0001: Use Django as the private backend

## Status

Accepted

## Date

2026-09-07

## Context

The room needs invite-only authentication, shared entries, private media,
Spotify OAuth, and IMDb synchronization. The first slice used a hosted backend
service, but the project now needs one backend boundary that we can run and
operate directly.

## Decision

Use Django 5.2 with Django Ninja for the API. Django's built-in auth and session
libraries handle email login, password reset, password changes, and HttpOnly
sessions. `RoomMember` is an explicit authorization layer: only two provisioned
members can read or change room data. The ORM stores entries, section details,
events, media metadata, provider connections, and encrypted Spotify tokens.

Use SQLite for local development and PostgreSQL in production. Keep provider
credentials and encryption keys in the Django environment. Use authenticated
polling and visibility refresh for shared updates initially; add Django
Channels only if push delivery becomes necessary.

## Alternatives considered

### Hosted backend service

Rejected as the runtime boundary because it split auth, storage, database
policies, and provider functions across a service-specific deployment model.

### Django REST Framework

Not selected for this slice. Django Ninja provides typed OpenAPI-backed routes
with less API boilerplate and works directly with the existing JSON/multipart
contract.

### Custom Node API

Rejected because the project now needs server-side auth, data migrations, media
handling, and scheduled provider work in one Python service.

## Consequences

- The frontend must set `VITE_DJANGO_API_URL`, or Django must serve the frontend
  on the same origin.
- Production requires HTTPS, secure cookies, explicit CORS/CSRF origins, a
  random Django secret, and PostgreSQL backups.
- Existing hosted data needs an explicit export/import step before cutover;
  retired migration artifacts remain under `legacy/supabase` as reference only.
- The API has a stable health check and one application-level authorization
  boundary for room data.

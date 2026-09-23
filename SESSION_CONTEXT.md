# For Nooshin — Portable Session Context

## User goal

Build a visually attractive personal web application for the user's girlfriend. The first thought was a simple React frontend deployable on GitHub Pages. The idea evolved into a larger private application with a backend, Spotify integration, shared media and reading data, violin song requests, and a wishlist.

The app is intended for exactly two users: the user and his girlfriend. Access is private and shared between them. This is an implementation project, not only a one-time static gift.

## Girlfriend profile and taste

- 21 years old.
- Studies electrical engineering, like the user.
- Described as INTJ, very strong personality, likes villain/antihero energy, a little spoiled and mean in a playful description, but very gentle when she is gentle.
- Likes games and has a strong gaming identity.
- Loves _Game of Thrones_ and Marvel worlds.
- Loves books and audiobooks.
- Current book: _The Vicious and the Vengeful_ by B. A. Paris (as provided by the user).
- Books especially meaningful or loved: _کوری_, _Six of Crows_, and _Rock Paper Scissors_. _Rock Paper Scissors_ is especially meaningful to the relationship, but must not become a separate application section. It may appear as a hidden recurring symbol, easter egg, coded phrase, or motif.
- Has excellent movie taste and has watched almost every movie.

### Music visible in the supplied Spotify screenshots

The screenshots are a sample of her liked music, not necessarily a complete catalogue:

- Snow Patrol — “All” / _The Forest Is the Path_
- Taylor Swift — “This Love (Taylor's Version)”, “I Wish You Would (Taylor's Version)”
- Tame Impala — “Loser”, “New Person, Same Old Mistakes”, “Let It Happen”
- Twenty One Pilots — “Oldies Station”
- Radiohead — “Jigsaw Falling Into Place”
- Cocteau Twins — “Cherry-coloured Funk”
- Megan Thee Stallion — “Body”
- Ethel Cain — “Crush”
- Charli xcx — “Chains of Love”, “Always Everywhere”
- Birdy — “Words as Weapons”, “Keeping Your Head Up”, “1901”
- The Weeknd — “Open Hearts”, “False Alarm”
- Adele — “Don't You Remember”, “I Miss You”, “Rumour Has It”
- Mitski — “Your Best American Girl”
- Conan Gray — “Astronomy”
- OneRepublic — “All Fall Down”, “Stop And Stare”
- Olivia Dean / Leon Bridges — “The Hardest Part”
- Carly Simon — “You're So Vain”
- Gracie Abrams — “Minibar”, “Men Like You”, “Daughter from Hell”, “Full machine”

The audiobook screenshot includes Persian titles such as _بیمار خاموش_, _در ژرفای آب_, _زنی در کابین ۱۰_, _ساعت قصه‌گویی_, _دروغگو بودیم_, _هر دو در نهایت می‌میرند_, and _راز بین دو نفر_, among others. Preserve exact titles from the user's own library when populating real data.

## Product direction

The current in-app name is **For Nooshin**, with personal copy from Saman. The older working name was The Control Room; preserve the current name in user-facing UI and metadata.

It is her private command center: a dark, elegant, game-like personal media system. It should feel like an intelligent villain headquarters, an editorial archive, and a polished indie-game interface. It should not feel like a generic self-care app, productivity tracker, or overly sentimental gift page.

The first visit can contain a custom intro, but repeat use matters. Every return should offer discovery, recommendations, current listening, reading/media status, requests, and new content.

## Core product areas

### Dashboard

- Current Spotify song or recently played item.
- Current book/audiobook.
- Pending violin request.
- One wishlist item.
- Random recommendation or surprise drop.
- Activity feed shared by both users.
- Mode/theme selection.

### Spotify

- OAuth login and connected Spotify account.
- Liked songs, playlists, recently played, currently playing.
- Mood/energy analysis and visual summaries.
- “Play something for this feeling.”
- Curated relationships from song to mood, book, movie, character, or quote.
- Use Spotify/YouTube links or embeds rather than building a music player from scratch in the first slice.

### Personal taste graph

Connect interests through relationships:

```text
song → mood → book → movie → character → quote
```

Example: a song can lead to a book, then a movie recommendation with a personal note. This is the main discovery/replay mechanism.

### Modes

Possible modes/themes:

- Villain
- Heaven
- Chaos
- Disappear
- Unstoppable
- Focus

Changing mode changes accent colors, copy, animations, recommendations, and the atmosphere of the interface. Modes are mood/aesthetic choices, not diagnosis or productivity pressure.

### Media library

Track books, audiobooks, films, series, games, current obsessions, status, ratings, notes, and recommendations. Future integrations may include TMDB, Google Books, or RAWG.

### Violin request board

The user plays violin. His girlfriend sometimes sends song requests for him to play.

She can submit:

- Song title
- Artist
- Mood/reason
- Priority
- Optional message

Request status:

```text
Requested → Practicing → Recorded → Delivered
```

The user can upload an audio/video recording and a note. The app can keep a performance history and her reactions. Visual treatment: concert tickets, setlists, stage light, waveform animation.

### Wishlist vault

She can add items she wants:

- Product link
- Name/image
- Price
- Size/color
- Priority
- Category
- Reason or note

The user can track purchase/order/arrival/gifting privately so surprises remain intact. Shared item data is visible to both; purchase status and budget/delivery notes may be user-only.

### Surprise drops

Backend-managed content that the user can add through a small private admin view without redeploying:

- Personal message
- Song recommendation
- Movie-night suggestion
- Quote
- Memory
- New visual theme

### Shared activity

Examples:

```text
She added an item to Wishlist
You uploaded a violin performance
She finished Six of Crows
You added a movie recommendation
```

## Access model

Exactly two invited users. No public signup.

Both users can view and edit shared media, books, movies, games, modes, violin requests, wishlist items, memories, recommendations, and activity.

Small permission differences are useful:

- Girlfriend: create requests, add wishlist items, update her current media, rate performances, add recommendations.
- User: update request status, upload performances, mark purchases/deliveries, prepare surprise drops.

Keep most content shared. Hide only surprise-sensitive metadata such as purchase status, budget, delivery notes, or unpublished messages.

## Visual direction

Dark editorial game interface. Avoid generic purple AI gradients, excessive rounded cards, and a generic hacker dashboard.

- Near-black charcoal background with subtle paper/noise grain.
- Warm ivory text.
- Deep burgundy, acid green, and smoky violet accents.
- Elegant serif for major titles.
- Clean sans-serif for body/UI.
- Monospace for system labels.
- Album covers, book covers, and posters presented like a curated collage.
- Central animated power core or archive orb.
- Slow glow, sliding panels, subtle particles, and hover reveals.
- No forced autoplay audio.
- Mobile-first; she will likely use it on a phone.
- Example labels: `CONTROL ROOM // ONLINE`, `ARCHIVE_03`, `MOOD: VILLAIN`, `POWER: 87%`.

The visual system should make five beautiful screens feel more intentional than twenty generic feature screens.

## Backend and deployment direction

The frontend can still be deployed to GitHub Pages. The backend runs separately.

Current backend direction:

- React + TypeScript + Vite frontend.
- Django 5.2 with Django Ninja API for the hosted service.
- Django built-in auth/session/password-reset libraries for invite-only accounts.
- Django ORM with SQLite locally and PostgreSQL in production.
- Django media handlers for private images and recordings.
- Spotify OAuth, liked-song synchronization, and IMDb public Watchlist reads run server-side in Django.
- Authenticated polling/visibility refresh for shared updates; realtime push can be added later with Django Channels.

## Current implementation state

Working directory:

```text
/home/saman/Desktop/projects/personal/nooshin/control-room
```

The app is isolated in `control-room/` inside the personal nooshin workspace. The adjacent gift application is a separate project.

Created manually because `npm create vite` / `npx create-vite` stalled on intermittent npm registry fetches:

- `package.json`
- `index.html`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `src/` contains the production-prep implementation: mobile-first home, Bookshelf, Listening, Setlist, Little wishes, Notes, and Connections destinations; honest empty/loading/error states; Google Books/Open Library lookup/import; add/edit/remove composers for books, music, wishes, notes, films, games, and requests; client image resizing plus 5 MB image and 50 MB recording validation; IndexedDB local mode with one-time seeded context, offline media, conflict versions, export backup, and cross-tab refresh; Django API store with session auth, CSRF, private media, and typed room endpoints; AuthGate with invite-only password/recovery flow; and Django Spotify/IMDb provider services. Mood buttons were removed after review; the visual system uses a fixed dark blackberry/eggplant accent, a hand-drawn moonlit room illustration, warm paper/record/setlist objects, and no fabricated provider state. PWA manifest/Workbox service worker, GitHub Pages base-path workflow, error fallback, CSP/header template, env examples, deployment docs, and Django migrations are present. `VITE_LOCAL_PREVIEW=true npm run build:preview` is an explicit loopback-only device preview; production builds fail closed unless Django API configuration is supplied, hosted routes render only the authenticated two-member room, and a missing cloud configuration never falls back to seeded data.

The package scripts are:

```text
npm run dev
npm run build
npm run preview
npm run build:preview
npm run typecheck
npm run format:check
```

Dependencies include React, React DOM, Vite, TypeScript, Radix Dialog, Motion, Lucide, local Fontsource fonts, IndexedDB (`idb`), and Vite PWA support. The backend uses Django, Django Ninja, psycopg, cryptography, and requests. Dev checks include Prettier, Axe Playwright, and Playwright Core.

## Completed implementation slice

The first production-prep vertical slice is complete:

- Hand-authored home composition: moonlit window, bedside bookshelf, record player, paper note, fridge setlist, and wish drawer.
- Deep plum/blackberry palette, Cormorant/Manrope/Caveat typography, bundled fonts, Motion transitions, Lucide icons, and mobile-first layout.
- Books, music, wishes, notes, films, games, and violin request editors with image uploads; requests accept audio/video recordings.
- Google Books/Open Library search with cover import, allowlisted URLs, cancellation/timeouts, and an editable fallback.
- Device-local IndexedDB persistence with one-time seeded context, image resizing, offline PWA reload, backup export, optimistic version conflicts, and cross-tab updates.
- Django Ninja API with invite/password/recovery auth, HttpOnly sessions, CSRF checks, private media responses, optimistic versions, and two-member `RoomMember` authorization.
- Django Spotify service with PKCE, server-only Fernet-encrypted refresh tokens, one-time expiring state, callback verification, refresh, disconnect, status, current/recent/liked/playlist data, and no fake connection state.
- PWA Workbox precache with old-worker retirement, GitHub Pages base-path workflow, CSP/header template, error fallback, production env checks, and audit/format/type gates.

`VITE_LOCAL_PREVIEW=true npm run build:preview` is the explicit device-local build. Private `npm run build` fails closed until `VITE_DJANGO_API_URL` or `VITE_DJANGO_SAME_ORIGIN=true` is provided. Install frontend dependencies through `proxychains npm install` and backend packages through `proxychains python -m pip install -r backend/requirements.txt`.

Before private launch: provision PostgreSQL, run `python backend/manage.py migrate`, provision exactly two Django members, set server secrets, register the Django Spotify callback, set `VITE_DJANGO_API_URL`, and validate staged auth, OAuth, IMDb refreshes, uploads, polling, and rollback. Never commit credentials. The product is presented in-app as **For Nooshin**, with personal copy signed by Saman; preserve that tone.

## Additional sections (2026-09-06)

The user approved the current appearance. Keep it while extending the app. Digital letters/postbox were rejected because letters deserve to be physical.

Implemented four new corners, accessible from Home and the header Explore shortcut. Rabbit holes were later removed entirely (2026-09-24): the kind, entries, events, and all UI are gone; migration `0014_remove_rabbit_holes` deletes the data on deploy.

- **Watch nights** (`/watch-nights`): supports films or series, solo or together viewing, defaults to Nooshin’s place for solo evenings, and offers Saman’s place, Cinema, and Somewhere else. Saves shortlist, selected title, date/time, snacks, notes, and past evenings.
- **Our Adventure Book** (`/adventure-book`): an original stitched scrapbook inspired by _Up_, with a cover, photos, stories, places/dates, page turning, and Someday / Our memories filters.
- **Wall of Lyrics** (`/lyric-wall`): recreation of her physical lyric wall through user-entered words, photos, four paper colours, three lettering styles/sizes, and persistent arrangement by dragging or arrow buttons. Never auto-fetch or seed lyrics.

All four use the existing image/persistence paths and Django `RoomEntry.details` JSON. Run Django migrations before deploying; member authorization, CSRF, optimistic versions, and private media apply to each section. See `docs/ROOM_SECTIONS.md` for precise behaviour and verification limits.

Further section ideas are still being discussed; do not implement unselected suggestions automatically.

## IMDb Watchlist integration (2026-09-06)

IMDb connection and CSV import are available in Connections, Films & series (`/films-and-series`), and Watch nights (`/watch-nights`). The user explicitly requested implementation of an automatically refreshed public Watchlist link after the first CSV-only slice. Preserve both paths.

- **Public link:** accepts `/user/ur…/watchlist/` and case-sensitive `/user/p.…/watchlist/` links. The server uses IMDb's undocumented website GraphQL interface with the maintained Kometa query contract. It reads every page before adding titles or displaying verified success. No IMDb login, password, cookie, licensed subscription, or fabricated provider state.
- **Persistence:** IndexedDB version 3 stores the device-local connection. `0006_imdb_connection.sql` adds service-role-only cloud connection/lease/commit functions, one connection per invited member. Added films are shared. Refreshes skip existing identities and retain edits, ratings, watched status, pictures, and user deletions while the title remains in the previous snapshot. IMDb removals and disconnect never remove room films.
- **Refresh:** six hours after success; one hour after error; a Django database lease will fence overlapping and late completions. The active Django slice refreshes while the room is open; a protected management command or Celery beat job can add closed-room refresh after staging verification.
- **Failures:** null/private/missing, changed/partial response, timeout, and size/count failures keep the last complete snapshot. A genuine non-null empty list succeeds without deleting saved films. The UI shows verified time/count, errors, cooldown, refresh, and disconnect, including during a read.
- **Private CSV:** accepts the member's downloaded title-list CSV, previews selected films/series, and imports Watchlist records in atomic batches of 250. Re-imports skip existing IDs, including manual IMDb title links. Keep private lists private; use IMDb's official Export control. No poster service is implied; existing picture upload remains available for both import paths.

Apply migrations `0005`, `0006`, and `0007` after `0004` in cloud mode. The reader is bounded to 12,000 titles, 120 pages, and 90 seconds; slow/large lists may require CSV. CSV files are capped at 16 MB / 12,000 rows; previews and film lists are paginated for phone performance. See `docs/IMDB_CONNECTION.md`, `docs/IMDB_IMPORT.md`, and `docs/IMDB_PUBLIC_CONTRACT.md` for implementation, setup, and sources.

Verification: a full unauthenticated public reference read returned 2,155 titles (2,144 with directors) before the Django migration. The active Django reader keeps the same bounded public-list contract; hosted PostgreSQL, scheduler delivery, and the member's actual Watchlist URL remain deployment checks.

## Spotify liked-song synchronization and routes (2026-09-07)

- After a verified Spotify connection, `SpotifyLibrarySync` reads every Saved Tracks page with the provider's maximum page size of 50 and imports each page into the Songs collection. It also runs on a later foreground visit, with a five-minute successful-sync cooldown; the visible Refresh control forces a new pass.
- Imported music uses `spotify:<22-character track ID>` and a canonical `open.spotify.com/track/...` link. Local IndexedDB and cloud migration `0008_spotify_liked_songs.sql` both skip imported IDs and manually added matching track links. Re-sync never overwrites titles, artists, status, notes, or uploaded pictures; unliking never deletes a room song. Page batches are resumable and bounded at 50,000 tracks with an explicit error rather than truncation.
- Spotify save timestamps, album names, and release years are stored separately by migration `0009_spotify_song_metadata.sql`. `/songs` sorts all music by provider save date descending, then manual additions by their room date, and shows multiple factual stats sections: totals, unique artists, album coverage, one-song discoveries, save years and months, top artists/albums, release eras, newest saves, listening fingerprints, and oldest/newest save span. It does not infer play counts or moods.
- Django owns Spotify OAuth in local and hosted mode. The Ninja API exposes the same paginated `liked` action, Fernet-encrypts server-side tokens, and keeps provider secrets in `backend/.env` or deployment secrets. The Vite server does not call Spotify directly.
- Application navigation uses clean paths from `src/lib/routes.ts`: `/books`, `/songs`, `/films-and-series`, `/games`, `/setlist`, `/wishes`, `/notes`, `/connections`, `/corners`, `/watch-nights`, `/adventure-book`, `/lyric-wall`, and `/little-loves`. Internal links use `history.pushState`, Back/Forward uses `popstate`, and old route hashes migrate once. The generated `404.html` plus external `route-fallback.js` preserves direct routes on GitHub Pages and respects `VITE_BASE_PATH`. Django password-recovery query parameters and the `#main-content` accessibility anchor are not application routing.
- Browser verification covers full paginated import, a manual-link duplicate retaining edits, a repeat sync adding zero songs, direct clean paths, Back, legacy hash migration, stats sections, chronological ordering, and 390px layout. Migrations `0008` and `0009` were applied with `0001`–`0007` in isolated PostgreSQL; role denial, counts, rollback, attribution, duplicate skipping, metadata enrichment, and edit preservation passed.

## Constraints and preferences

## Deepened listening statistics (2026-09-23)

- `/songs` statistics grew from derived-only panels to a fuller factual story: weekday and hour-of-day save patterns (local timezone via `Intl.DateTimeFormat` parts), monthly saving streaks and quiet stretches with the song that broke the silence, artists revisited across different saving years, oldest-recording-to-newest-release span, version counts (Taylor's Version, remix, acoustic, live, sped-up), recurring artist pairings in credits, and title word frequency with a function-word stop list. Cross-corner panels count liked songs that later became violin requests or lyric-wall pieces; they match on `spotify:<id>` or a normalized title.
- Migration `0012_roomentry_provider_duration_ms.py` adds `provider_duration_ms`. The Spotify import now stores track durations and cover URLs alongside existing metadata; the None-backfill loop fills them for already-saved songs on the next sync without touching edits. Durations power the "if you played it all" total listening time; covers power a canvas-extracted dominant-colour palette (up to 24 covers, saturation-weighted bucketing, CORS-safe null handling).
- The `image_url` host allowlist extends to `i.scdn.co`, `image-cdn-ak.spotifycdn.com`, and `image-cdn-fa.spotifycdn.com` (both CDNs verified to send `Access-Control-Allow-Origin: *`). The import drops covers from unexpected hosts instead of failing the batch. The `listening` endpoint's recently-played limit rose from 10 to 50 for the live "recent rotation" panel, which counts artists across those plays.
- Verified locally against a mirror of the production database: one forced re-sync backfilled durations and covers for all 451 songs; totals, weekday sums, discovery lags, palette swatches, and cross-corner counts checked out. Durations and covers remain empty in production until the first member visit sync after deploy; panels show honest placeholders until then.

## Django and Docker backend (2026-09-07)

- The hosted backend is Django 5.2 with Django Ninja under `backend/`. Built-in Django sessions/auth, CSRF, `RoomMember` authorization, ORM persistence, private media, Spotify OAuth, and IMDb reads are the only active backend paths. Supabase runtime code was removed; old files are retained only under `legacy/supabase` as a non-deployed migration reference.
- `compose.yaml` runs PostgreSQL 16, Django/Gunicorn, and an Nginx frontend proxy. PostgreSQL and media use named volumes. Backend startup waits for the database, applies migrations, then starts Gunicorn; all services expose health checks. The local Compose stack was built and reached healthy state on 2026-09-07.
- Backend dependencies are locked with `uv` in `backend/uv.lock`. Ruff 0.16.6 and Pyrefly 1.2.0 are dev dependencies; `ruff check`, `ruff format --check`, and `pyrefly check` run in the backend CI workflow. Pyrefly suppressions cover Django's dynamic ORM descriptors and are generated, explicit line-level directives.
- Production requires `DJANGO_DEBUG=false`, a random `DJANGO_SECRET_KEY`, secure cookies, explicit `FRONTEND_ORIGINS`, HTTPS, PostgreSQL through `DATABASE_URL`, and provider secrets only in the backend environment. The frontend production build requires `VITE_DJANGO_API_URL` or `VITE_DJANGO_SAME_ORIGIN=true` and never falls back to seeded local data on a hosted origin.

- IMDb follow-up: lack of official consumer OAuth does not make automatic connection impossible. The direct public reader is implemented; validate a member's exact public URL before claiming their list is connected. `docs/IMDB_RESEARCH.md` retains the alternatives and research history.

- User wants ideas and implementation to remain personal, cool, comforting, and visually attractive.
- Avoid making the site a productivity lecture or daily obligation.
- Avoid a separate Rock Paper Scissors section; use it only as a hidden motif.
- Keep implementation incremental and build/test each slice.
- Do not store secrets in the repository.
- No external model consultation or OpenRouter usage.

## Moon days and real data (2026-09-24)

- The local PostgreSQL database now holds **real user data**: 11 cycle entries logged by Nooshin (Sep 2025 – Aug 2026) and her real weigh-in (67.7 kg, 2026-09-24). These are NOT test data — never delete or overwrite them in cleanup. Any verification entry created through the UI must be removed by its own specific id, never by kind-wide filters like `kind='cycle'` or by date patterns that might match her records.
- Her cycle entries record whole cycles: `started` is the first day of the period, `ended` is the day the next one began (or the day before). The Moon days display understands this: period shading is capped at ten days per entry, and spans longer than that are shown in history as "N-day cycle" records rather than one long period.
- Cycle predictions average the last six gaps between starts (gaps outside 15–60 days ignored); with fewer than two logged starts they fall back to her usual 29 days. The wheel also shows cycle phases (period / follicular / around ovulation / luteal), with ovulation estimated 14 days before the next expected period.
- She goes to the gym regularly, but deliberately no gym or exercise feature exists; the weigh-in log is the only body tracking.

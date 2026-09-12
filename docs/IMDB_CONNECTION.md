# Public IMDb Watchlist connection

Members can paste a public IMDb Watchlist link in **Connections → IMDb
connection**, Films & series, or Watch nights. Django reads the public list,
verifies the complete snapshot, and adds new titles to the shared film
collection. No IMDb password, cookie, OAuth token, or account credential enters
the room.

The [CSV importer](IMDB_IMPORT.md) remains available for private lists and
provider outages. The public reader follows the verified response contract in
[IMDB_PUBLIC_CONTRACT.md](IMDB_PUBLIC_CONTRACT.md).

## Member experience

1. Copy a full public IMDb Watchlist link containing
   `/user/ur…/watchlist/` or `/user/p.…/watchlist/`.
2. Open **IMDb connection**, paste the link, and connect. Django stores the
   connection only after the complete list verifies and its additions commit.
3. Read the last successful refresh time, title count, new-title count, and
   status. **Refresh now** retries a failed read.
4. **Disconnect link** stops updates and preserves existing room films.

Each invited member manages their own public link. Imported films are shared.

## Django setup

Run the backend with `python backend/manage.py runserver` or Gunicorn/Uvicorn
behind HTTPS. Apply migrations and provision the two members first:

```sh
python backend/manage.py migrate
python backend/manage.py provision_member --email you@example.com --display-name Saman --slot 1 --role owner
python backend/manage.py provision_member --email her@example.com --display-name Nooshin --slot 2
```

Set `APP_URL`, `FRONTEND_ORIGINS`, `DJANGO_SECRET_KEY`, database settings, and
`IMDB_WATCHLIST_QUERY_HASH` in the Django environment. The Ninja endpoints are:

- `GET /api/imdb/status/`
- `POST /api/imdb/connect/` with `{ "url": "…" }`
- `POST /api/imdb/refresh/`
- `POST /api/imdb/disconnect/`

Every endpoint requires an authenticated Django session and a `RoomMember`.

## Refresh and safety contract

- Django reads every page before returning a snapshot: up to 12,000 titles, 120
  pages of 100, 12 seconds per request, and 90 seconds overall.
- It rejects provider errors, private/null lists, changing totals, duplicate
  IDs, repeated cursors, malformed fields, and over-limit responses.
- New films receive title, director names when available, title type/year, a
  canonical IMDb link, and `Watchlist` status. Artwork remains user-uploaded.
- Existing notes, ratings, watched state, titles, and pictures are never
  overwritten. Removing a title from IMDb never deletes its room entry.
- Connection state, imported entries, events, counts, and success timestamps
  commit in one Django transaction. Failed reads keep the previous state.

The official IMDb Lists FAQ says external non-IMDb URLs in list titles,
descriptions, or notes can force a list private even when its setting appears
public. Verify the shared URL while signed out. Control Room never calls IMDb's
`editListVisibility` mutation and never uses account cookies to bypass it.

## Verification boundary

The public reader is an undocumented IMDb website interface, not an official
consumer Watchlist API. Query hashes and response fields can change; re-verify
the pinned contract before changing `IMDB_WATCHLIST_QUERY_HASH`. Provider
responses, member list contents, and credentials are not logged.

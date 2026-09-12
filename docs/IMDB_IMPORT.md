# IMDb Watchlist import

For Nooshin imports a member's own IMDb title-list CSV into Films & series. The imported titles are available to Watch nights and Rabbit Holes. This is an export snapshot, not an authenticated IMDb connection or automatic synchronization. Current official interface evidence and limitations are in [IMDB_RESEARCH.md](IMDB_RESEARCH.md).

For automatically refreshed public lists, use the separate [IMDb connection](IMDB_CONNECTION.md). Both paths share duplicate detection and preserve personal edits. CSV remains the option for keeping a list private.

## Using it

1. In IMDb's website, sign in and open [your Watchlist](https://www.imdb.com/watchlist/).
2. Choose Export, and download the CSV when IMDb makes it available. Some exports are prepared on the Exports page before download.
3. In For Nooshin, choose **Import IMDb Watchlist** in Connections, Films & series, or Watch nights.
4. Review the preview, deselect anything you do not want to bring over, and import.

Your IMDb Watchlist can stay private. No IMDb password, cookie, account token, public-list URL, or licensed API subscription is required. Use a fresh export for later additions. Removing a title from IMDb does not delete it from the room.

## Import contract

- Read UTF-8 CSV with Papa Parse. Names, not column positions, identify fields. Extra columns such as `Original Title` are tolerated.
- Require `Title` and a valid title identity in `Const`/`Tconst`/`IMDb ID` or an IMDb `URL`/`Title URL`. IDs must be `tt` plus 7–12 digits. When both ID and URL are supplied, they must agree. Links use exact IMDb hosts and are replaced with a canonical HTTPS title link.
- Import Title, Directors, Title Type, Year, and list Description when present. New records use `Watchlist` status. The IMDb global score and 1–10 user rating are not mapped into the room's 1–5 rating or treated as watched evidence.
- CSV files do not provide poster files. Imported titles keep the room's fallback artwork until the member uploads a picture. No poster service is implied.
- Validate up to 12,000 rows and 16 MB. The selection preview renders 25 rows per page; Films & series renders 48 items per page. Quoted commas/newlines/quotes and Unicode are supported; malformed quoting fails before writing. Individually invalid rows are displayed for review and excluded.
- Deduplicate by IMDb ID, including manually saved entries whose IMDb identity appears only in their title link. Existing entries keep their status, notes, rating, picture, version, and title. Duplicate rows in the same CSV are counted and skipped.
- Save in atomic batches of at most 250. A failure keeps confirmed earlier batches; retrying safely skips records already committed. Success counts come from the store/SQL response. The original CSV is never uploaded; cloud mode sends only the selected title fields.

## Production

Apply `0005_imdb_watchlist.sql` after `0004`. It adds the authenticated `import_imdb_watchlist` RPC and an IMDb-link lookup function/index. The RPC uses invoker permissions, checks room membership, validates the payload, and never accepts a caller-provided author ID. It uses the existing `room_entries` RLS and event trigger. Conflicts only skip entries; they never overwrite data. Batch imports are serialized to prevent two members from duplicating the same IMDb list. No new secrets or external-fetch handler is needed.

Cloud collection reads now page past PostgREST's default row limit. Realtime notifications are debounced so importing many titles does not reload the whole room once per inserted row. Local imports use one IndexedDB transaction per batch and notify other open tabs.

## Verification scope

Parser checks use synthetic CSV fixtures matching the documented field contract. Browser checks cover selection, persistence, duplicate suppression, preserving local edits/pictures, Watch night use, malformed files, escaped untrusted text, accessibility, and 320–1440px layouts. Django checks use the local ORM schema and session membership boundary for duplicates, preserved edits, and all-or-nothing batch validation. Hosted PostgreSQL and the user's actual export remain deployment checks.

# Control Room IMDb watchlist import research

Date checked: 2026-09-06
Scope: bringing a room member's IMDb Watchlist into Films & series and Watch nights without collecting their IMDb password or pretending an account is connected.

Current implementation: the requested public-link connector is implemented alongside CSV import. See [IMDb connection setup](IMDB_CONNECTION.md) and the [verified public reader contract](IMDB_PUBLIC_CONTRACT.md). The sections below preserve the original export research and the follow-up connection options.

## Original CSV recommendation

Use an **IMDb CSV import**, explicitly described as a snapshot. The user exports their own Watchlist in IMDb, downloads the finished file, and chooses that file in Control Room. They can keep their IMDb Watchlist private. Re-importing should add newly selected titles, skip existing IMDb IDs, and preserve local notes, pictures, and watched status.

The first-party developer documentation reviewed describes licensed entertainment metadata delivered through AWS Data Exchange, not a free consumer OAuth API for reading a user's Watchlist. No documented consumer Watchlist API or authorization scopes were found. This is a finding about the published interfaces, not a claim that IMDb has no internal list API. See sources 1, 2, 6, and 7.

## Verified behavior

| Finding | First-party evidence | Effect on this integration |
| --- | --- | --- |
| Watchlist contains movies and TV shows the member wants to watch. It is private by default. | Watchlist FAQ, updated 9 July 2026 [1]. | Accept title types intentionally; a public profile/list URL does not grant access to a private Watchlist. |
| Lists can be exported using the **Export** icon at the upper right. | Lists FAQ, updated 9 July 2026 [2]. An older IMDb employee response explicitly confirms Watchlist export [3]. | Link to the member's Watchlist and explain the current web export control. Do not use the older “bottom of page” placement. |
| IMDb exports spreadsheet-readable CSV. | Ratings FAQ explicitly states Export creates a `.csv` file; Check-ins FAQ also documents CSV list export [4]. | Read the downloaded CSV in the browser. No IMDb login credentials belong in Control Room. |
| Exports are saved snapshots, not live lists. | IMDb employee Col Needham explains that exports remain on the exports page for four weeks and retain the contents at export time even if the source list changes or is deleted [5]. | “Imported” and “Import a newer file” are truthful; “Connected” or “Synced” would be misleading. |
| Exported title text may use its original form; release date, year, and runtime can depend on location. | List Pages Redesign FAQ [8]. | Preserve provided text. Treat optional metadata conservatively; do not infer identity from localized titles. |
| CSV columns can change. | An IMDb employee confirms importers should accommodate the newer `Original title` field [9]. The help pages inspected do not publish a complete stable CSV header schema. | Read named headers rather than fixed column positions. Extra fields must not break the import. |
| Lists, Watchlists, and Check-ins have a 12,000-item limit. | Lists FAQ [2]. | Bound file size and processing; use a selection preview for large lists rather than rendering every item immediately. |
| The official API requires an AWS account, subscription, AWS credentials, and an API key from IMDb. | API onboarding and key-concepts documentation [6], [7]. The overview describes title/name datasets [10]. | A paid metadata product is not evidence of access to a member's Watchlist. Do not implement a fake IMDb connection button. |

## Export instructions and evidence limits

Suggested app instructions:

1. Open [your IMDb Watchlist](https://www.imdb.com/watchlist/) in a browser and sign in to IMDb there.
2. Choose **Export** near the top of the list. Download the CSV when it is ready. If IMDb shows an export still being prepared, return to its exports page once complete.
3. Return to Control Room, choose the CSV file, review titles, and import the selection.
4. To bring in later additions, export a fresh file and import again.

The existence and snapshot behavior of IMDb's exports page are confirmed by the employee reply in source 5. A July–August 2026 support conversation also describes exports in an “in progress” state [11], but that timing/state report comes from a user; employee replies troubleshoot it rather than promise a completion time. The reviewed official help does not specify an export-generation SLA or guarantee an immediate download. Use conditional instructions, not a promised wait duration. No signed-in export was performed in this research.

For phones, direct the member to IMDb's website. The Lists FAQ explicitly warns that its examples are for the website and can differ from iOS/Android apps [2]. Do not promise an identical export control in the native app.

The parser can support recognized headers such as `Const`, `Title`, `Original Title`, `URL`, `Title Type`, `Year`, `Runtime (mins)`, `Genres`, and `Directors`, but treat this as an application compatibility contract to validate against an actual export, not an IMDb-published complete schema. Require a usable title and IMDb title ID; make optional metadata optional. Never guess a film's IMDb identity from its title alone. Export snapshots should not delete existing room entries or overwrite personal edits.

Poster transfer is separate from Watchlist membership. These sources do not promise poster-image files or reusable artwork URLs in CSV. Keep Control Room's existing image uploads available; do not advertise automatic poster import without implementing and validating a permitted image source.

## Sources

1. [IMDb Watchlist FAQ](https://help.imdb.com/article/imdb/track-movies-tv/watchlist-faq/G9PA556494DM8YBA)
2. [IMDb Lists FAQ](https://help.imdb.com/article/imdb/track-movies-tv/lists-faq/GNQMN47VZSE7KW38)
3. [IMDb employee: How to export Watchlist](https://community-imdb.sprinklr.com/conversations/imdbcom/how-to-export-watchlist/61be41d2add924150d1748de) — older UI placement, 2021.
4. [IMDb Ratings FAQ](https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV) and [Check-ins FAQ](https://help.imdb.com/article/imdb/track-movies-tv/check-ins-faq/GG59ELYW45FMC7J3).
5. [IMDb employee: export-page snapshot behavior](https://community-imdb.sprinklr.com/conversations/imdbcom/export-page/66dc4dc9b15112717bb3ed07?commentId=66dc6ce044bcb778be08fe8a) — September 2024, read September 2026.
6. [Getting access to the IMDb API](https://developer.imdb.com/documentation/api-documentation/getting-access/)
7. [IMDb API key concepts and AWS authentication](https://developer.imdb.com/documentation/api-documentation/key-concepts/)
8. [IMDb List Pages Redesign FAQ](https://help.imdb.com/article/imdb/new-features-updates/list-pages-redesign/GLF7EF3VJPXM34XG)
9. [IMDb employee: importers must accommodate the Original title field](https://community-imdb.sprinklr.com/conversations/imdbcom/any-way-to-not-include-original-title-in-csv-export-of-ratings/66eb61c017cd75572b42c4c3)
10. [IMDb GraphQL API overview](https://developer.imdb.com/documentation/api-documentation/)
11. [IMDb support conversation: rating export in progress](https://community-imdb.sprinklr.com/conversations/imdbcom/rating-export-in-progress-issue/6a511cc0c8a9ae047cf10411) — user-reported behavior, not a guaranteed service contract.

All sources were read through public unauthenticated pages. No user account, Watchlist contents, API subscription, credential, CAPTCHA bypass, or unofficial scraping integration was used.

## Unofficial connection options

Follow-up checked: 2026-09-06. **An automatically refreshed IMDb Watchlist connection is possible for publicly readable lists.** Lack of an official consumer OAuth API does not make CSV the only technical option. The recommendation above is the credential-free snapshot option; it should not be presented as proof that periodic connection is impossible.

### Direct public Watchlist reader, following Kometa

[Kometa's current Watchlist documentation](https://kometa.wiki/en/latest/files/builders/imdb/watchlist/) supports a user identifier or a complete Watchlist URL. Root-agent source inspection verified handling of both legacy `ur...` identifiers and newer `p...` identifiers. [The implementation](https://github.com/Kometa-Team/Kometa/blob/0f564beba5e23667f32c251fc0a5ebc3fbf051f1/modules/imdb.py) uses POST requests to `api.graphql.imdb.com` with `WatchListPageRefiner`, a maintained persisted-query hash from `IMDb-Hash/WATCHLIST_HASH`, and explicit handling of `FORBIDDEN` for private lists. This is an undocumented IMDb web interface used by a maintained open-source project, not IMDb's licensed AWS API and not consumer OAuth.

This provides a concrete implementation reference for a server-side, read-only connector that periodically re-reads a public Watchlist. No IMDb password or account token is part of that public-reader path. Publicness, pagination, current hashes, and accessibility still have to be verified against the exact source before Control Room can honestly display a successful connection. IMDb changes can break this interface. Keep the last successful snapshot and expose the last successful refresh; treat a denied/failed fetch as failure, not as an empty Watchlist.

### MDBList as an intermediary

MDBList's [official External Lists documentation source](https://github.com/linaspurinis/mdblist.doc/blob/b83ab16a20482b0dc70799974d15526d5c5eb092/docs/external_lists.md), updated on 2026-09-03, explicitly supports both:

- IMDb custom lists: `https://www.imdb.com/list/{list-id}`.
- IMDb user Watchlists: `https://www.imdb.com/user/{user}/watchlist`.

That document states external lists update automatically on the account's schedule. The [official account comparison](https://github.com/linaspurinis/mdblist.doc/blob/b83ab16a20482b0dc70799974d15526d5c5eb092/docs/supporter.md) specifies **weekly external-list updates on free accounts** with one external list, and **24-hour external-list updates on paid tiers**. Do not confuse those numbers with its faster schedule for MDBList's own dynamic lists. These are the documented schedules at inspection time, not a freshness guarantee verified against a particular user's Watchlist.

The [public API reference](https://api.mdblist.com/docs/) and [OpenAPI schema](https://api.mdblist.com/schema/?format=json) document:

- `GET /external/lists/user` to discover the authenticated member's linked/imported external lists.
- `GET /external/lists/{listid}/items` to read them, with cursor pagination and title, `imdb_id`, and release-year fields.
- Optional `append_to_response=poster,genres,description,ratings` for additional metadata.

This makes `IMDb public Watchlist → MDBList external list → Control Room` a feasible periodically refreshed integration. Creating/linking the external source happens in MDBList; no public API for creating that link was verified. It needs a MDBList account plus an API key or registered OAuth app. [MDBList authentication docs](https://api.mdblist.com/docs/authentication/) support API keys, device-code authorization, public PKCE, and confidential OAuth. Its documented OAuth scope is currently `write`, which grants broad access; a read-only OAuth scope is not documented. This is a MDBList connection, not an IMDb account login.

The inspected MDBList docs do not describe an IMDb password/cookie flow, private IMDb Watchlist access, or the service's internal fetching method. Treat private-source access as unsupported unless separately demonstrated. Its docs website returned HTTP 403 in this environment, so the same first-party documentation was read from its public GitHub source; no access gate was bypassed. No MDBList account, API credential, or live Watchlist sync was used during this research.

### Radarr confirms a narrower maintained integration

[Radarr's current supported-lists wiki](https://wiki.servarr.com/radarr/supported#imdb-lists) and [source validator](https://github.com/Radarr/Radarr/blob/516ca5979e0b2ed776778e9b73158aec0a456c96/src/NzbDrone.Core/ImportLists/RadarrList2/IMDb/IMDbListSettings.cs) accept an IMDb user Watchlist ID matching `ur` plus digits. The [request generator](https://github.com/Radarr/Radarr/blob/516ca5979e0b2ed776778e9b73158aec0a456c96/src/NzbDrone.Core/ImportLists/RadarrList2/IMDb/IMDbListRequestGenerator.cs) asks Radarr's metadata service for `list/imdb/{user-id}`. Its [import class](https://github.com/Radarr/Radarr/blob/516ca5979e0b2ed776778e9b73158aec0a456c96/src/NzbDrone.Core/ImportLists/RadarrList2/IMDb/IMDbListImport.cs) specifies a 12-hour minimum refresh interval. No IMDb credential field appears in these settings.

Radarr explicitly removed `ls...` list support in [April 2025](https://github.com/Radarr/Radarr/commit/d9704a999dba8e5e68f42c185ba07b641995c1db). Its current `ur`-only validator also does not establish support for newer `p...` profile IDs. Do not read its `ls` removal as removal of every possible user-Watchlist integration. The current metadata service's fetching internals and permission for independent third-party use were not verified; its old public backend repository is archived. Radarr is useful evidence and a reference, not a backend dependency selected for Control Room.

### Choice for Control Room

For a member who wants to keep using IMDb, validate their actual Watchlist URL and public readability first. A direct public reader offers the simplest user flow; MDBList supplies a documented downstream API and scheduled external-source refresh at the cost of another account and a slower source schedule. Keep the CSV importer for private Watchlists and as a fallback. Following this research, the user requested implementation and the direct public reader was added; see [connection setup](IMDB_CONNECTION.md). No member's actual list has been connected during verification.

An early bounded read-only probe returned a null list. Later verified public examples established the correct response contract and a complete 2,155-title read succeeded through the implemented reader and local Vite route. Null still means unavailable, not an empty success. The exact member URL and visibility must still be tested. No account cookies or tokens were supplied. See [public response contract](IMDB_PUBLIC_CONTRACT.md).

# IMDb public Watchlist reader contract

Verified: 2026-09-06. Scope: read-only public Watchlists, without IMDb login, password, session cookies, or CAPTCHA/access-control bypass. This describes IMDb's undocumented web GraphQL interface as used by Kometa. It is not a supported IMDb consumer OAuth API.

## Sources and live verification

- [Kometa Watchlist documentation](https://kometa.wiki/en/latest/files/builders/imdb/watchlist/): accepts legacy `ur` identifiers, newer `p.` profile identifiers, and complete Watchlist URLs.
- [Kometa reader source, pinned](https://github.com/Kometa-Team/Kometa/blob/0f564beba5e23667f32c251fc0a5ebc3fbf051f1/modules/imdb.py): headers, query construction, profile resolution, parsing, and pagination.
- [IMDb-Hash source, pinned](https://github.com/Kometa-Team/IMDb-Hash/tree/ad39873127261b25c3aa39a6b7e4625ee6949fa7): current persisted-query hashes; its `check-imdb-hash.py` includes a public Watchlist example.
- Initial unauthenticated probes returned a non-null Watchlist and rich title metadata. A second page returned distinct rows and an advancing cursor. Both literal and variable-based `p.` profile resolution succeeded. Subsequent implementation verification read the complete reference Watchlist: **2,155 titles**, **2,144 with director names**, using pages of 100. The live Vite route independently returned the same complete count in about 31 seconds. See [implementation and verification scope](IMDB_CONNECTION.md).
- The earlier local probe `/tmp/control-room-imdb-public-query-response.json` contained `data.predefinedList: null` and no GraphQL errors. That is an unavailable-list response, not an empty public Watchlist.

No member's actual Watchlist was supplied or connected in this verification.

## HTTP envelope

```text
POST https://api.graphql.imdb.com/
Content-Type: application/json
x-imdb-client-name: imdb-web-next
```

The public path needs no IMDb API key, authorization header, or cookie. Keep a bounded timeout and response-size limit. An HTTP success alone does not prove a successful GraphQL operation; validate `errors` and the required response structure on every page.

## Resolve a newer profile identifier

Legacy IDs match `^ur[0-9]+$`. New profile IDs match `^p\.[A-Za-z0-9_-]+$`. Kometa resolves `p.` IDs to internal `ur` IDs before requesting a Watchlist. Its validator comment saying “pass through” does not describe the later reader behavior.

The following variable-based query was verified successfully; **`ID!` is the working variable type**:

```graphql
query ControlRoomProfile($profileId: ID!) {
  userProfile(input: { profileId: $profileId }) {
    userId
  }
}
```

Send the profile identifier in `variables.profileId`. Read `data.userProfile.userId` and validate it as a `ur` identifier. A null/missing profile, missing ID, or GraphQL error means resolution failed; do not continue with `p.` in `urConst`.

For a full URL, parse it as a URL, require the exact permitted IMDb host, and extract the identifier from `/user/{identifier}/watchlist`. Ignore normal query strings/fragments. Do not fetch arbitrary supplied URLs or infer identity from display names.

## Watchlist request

```json
{
  "operationName": "WatchListPageRefiner",
  "variables": {
    "locale": "en-US",
    "first": 100,
    "urConst": "ur51920649",
    "isInPace": false,
    "sort": { "by": "LIST_ORDER", "order": "ASC" }
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "bd16984d2dec070e278187d502321c785bdf3d7771b172cc4b72002a4a6ce715"
    }
  }
}
```

The identifier above is the public example maintained by IMDb-Hash, not a Control Room member. The hash is public query metadata, not a credential. Source: [WATCHLIST_HASH](https://raw.githubusercontent.com/Kometa-Team/IMDb-Hash/ad39873127261b25c3aa39a6b7e4625ee6949fa7/WATCHLIST_HASH). Upstream updates the [moving reference](https://raw.githubusercontent.com/Kometa-Team/IMDb-Hash/master/WATCHLIST_HASH) when IMDb changes the persisted query. Validate any refreshed hash as exactly 64 hexadecimal characters; do not fetch or execute upstream code.

Kometa uses pages of 100 for Watchlists. Its hash checker uses 250 in an example, so 100 is a conservative implementation choice, not a verified API maximum. Initial probes used `first: 2`; the complete implementation read used `first: 100`.

Sort values in Kometa include `LIST_ORDER`, `TITLE_REGIONAL`, `USER_RATING`, `POPULARITY`, `USER_RATING_COUNT`, `RELEASE_DATE`, `RUNTIME`, and `DATE_ADDED`, with `ASC` or `DESC`. Use one stable sort across all pages.

## Response and field paths

Read the connection at `data.predefinedList.titleListItemSearch`:

```text
data.predefinedList.id
data.predefinedList.titleListItemSearch.total
data.predefinedList.titleListItemSearch.pageInfo.hasNextPage
data.predefinedList.titleListItemSearch.pageInfo.hasPreviousPage
data.predefinedList.titleListItemSearch.pageInfo.endCursor
data.predefinedList.titleListItemSearch.edges[]
```

For each edge, the title is at **`edge.listItem`**, not `edge.node.title`. `edge.node` contains list-entry metadata: `absolutePosition` and `description` in the inspected response.

| Desired field | Path relative to `edge.listItem` | Handling |
| --- | --- | --- |
| IMDb identity | `id` | Require a valid `tt` identifier. |
| Display title | `titleText.text` | Required for a useful imported card. |
| Original title | `originalTitleText.text` | Optional fallback. |
| Type | `titleType.id`, `titleType.text` | Examples in upstream source: `movie`, `tvMovie`, `tvSeries`, `tvMiniSeries`, `short`, `tvEpisode`, `video`, `videoGame`. Do not silently treat games or episodes as films. |
| Release year | `releaseYear.year` | Optional; `releaseYear.endYear` may be null. |
| Picture | `primaryImage.url`, `width`, `height` | Optional. Validate source URL and apply existing media handling before treating an image as a durable upload. |
| Runtime | `runtime.seconds` | Optional; `originalRuntime.seconds` also appeared. Convert seconds to minutes intentionally. |
| Genres | `titleGenres.genres[].genre.text` | Optional. |
| IMDb rating | `ratingsSummary.aggregateRating` | Optional. `voteCount` also available. |
| Plot | `plot.plotText.plainText` | Optional. Do not overwrite the member's personal note. |
| Directors | `principalCreditsV2[].credits[].name.nameText.text` | Select only the director grouping, described below. |

The inspected persisted query already returned these fields; a separate request per title is unnecessary. Other fields present included `certificate`, `canRate`, `series`, `latestTrailer`, `releaseDate`, `productionStatus`, `episodes`, and `metacritic`. Treat them as optional; the response is not a fixed official schema promise.

Director groups had `grouping.groupingId` equal to:

```text
amzn1.imdb.concept.name_credit_category.ace5cb4c-8708-4238-9542-04641e7c8171
```

For the requested `en-US` locale, the same grouping displayed both `Director` and `Directors` across the inspected rows. Other groups included `Stars`. Do not take every principal credit as a director. Names can be absent; an empty creator field is preferable to guessing. The grouping ID and path are currently observed behavior, not an official stable contract.

## Pagination and termination

For the next page, send the same payload with `variables.after = previous.pageInfo.endCursor`. The cursor is opaque; do not decode or construct it. Live page-two validation confirmed `first: 2` returned two new entries, no overlap, and a changed cursor.

- Stop only after a complete valid page reports `hasNextPage: false`, or a deliberate application limit is reached and clearly reported as truncation.
- If another page is promised, require a non-empty cursor that differs from all prior cursors and require forward progress. A repeated cursor or an empty page with `hasNextPage: true` is a failure.
- Bound page count, total rows, response bytes, and elapsed time. IMDb's official Lists FAQ currently limits Watchlists to 12,000 items, but do not trust remote `total` alone to terminate a loop.
- Deduplicate by IMDb title ID across pages. List contents can change during polling; there is no snapshot-consistency guarantee in the inspected interface.
- Validate errors and shape on **every page**. Kometa's own implementation is a reference; its later-page access does not repeat all first-page error checks, so copying it literally would be insufficient.
- Keep the last successful room snapshot when any page fails. Do not mark a partial run as a completed refresh or remove titles based on a partial/failed result.

## Error semantics and limits of verification

- HTTP error or non-JSON response: upstream request failure.
- GraphQL `errors[].extensions.code = FORBIDDEN`: Kometa treats this as a private list. This exact error was verified from source, not generated against a private account.
- `RESOURCE_NOT_FOUND`: Kometa treats this as a nonexistent list. Source-verified.
- Nonempty `errors` of any other kind, including an unknown persisted query: query failure; do not interpret partial `data` as full success.
- `data.predefinedList: null`, even with HTTP 200 and no errors: no accessible public Watchlist was returned. The response does not distinguish privacy, invalid identity, absence, and every other upstream condition. Do not label it definitely private or definitely empty.
- A structurally valid connection with `total: 0`, `edges: []`, and `hasNextPage: false` is the expected empty-list shape, but no empty public example was verified in this pass. Distinguish that shape from `predefinedList: null`.
- Verification established a working complete public reader and metadata shape against maintained public examples. It did not establish a service guarantee, transactional whole-list consistency at IMDb, live access to either member's Watchlist, or browser CORS support. The implementation runs on the server and retains the CSV fallback.

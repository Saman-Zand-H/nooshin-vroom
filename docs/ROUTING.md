# Application routes

The room uses clean browser-history paths. Hashes are reserved for document anchors and are not application navigation.

| Destination        | Path                |
| ------------------ | ------------------- |
| Home               | `/`                 |
| Books              | `/books`            |
| Films & series     | `/films-and-series` |
| Games              | `/games`            |
| Songs              | `/songs`            |
| Violin setlist     | `/setlist`          |
| Wishes             | `/wishes`           |
| Notes              | `/notes`            |
| Connections        | `/connections`      |
| More corners       | `/corners`          |
| Rabbit Holes       | `/rabbit-holes`     |
| Watch nights       | `/watch-nights`     |
| My Adventure Book | `/adventure-book`   |
| Wall of Lyrics     | `/lyric-wall`       |

Internal links use `history.pushState()` and Back/Forward is handled through `popstate`. This follows the platform contracts documented by [MDN `pushState`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState) and [MDN `popstate`](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event). Opening an old `#listen`-style bookmark replaces it once with the corresponding clean path.

Vite development and preview servers return the application shell for direct route requests. Static builds also emit `404.html` and the CSP-compatible `route-fallback.js`; GitHub Pages uses them to return a missing clean path to the configured base URL, then `restoreStaticRoute()` replaces the temporary URL before React renders. `VITE_BASE_PATH` remains part of every generated route, so project Pages and custom-domain root deployments use the same route table.

Hosts with configurable rewrites should serve `index.html` for the route paths above. Keep Django `/api/` paths, Spotify callbacks, and static assets out of that rewrite. The PWA navigation fallback already denies callback and API paths.

Every direct route still passes through the application authentication gate. A signed-out visitor receives only the entryway; room entries, events, and attachments are loaded after Django verifies an authenticated member. Static hosting cannot hide the JavaScript shell itself, so production builds must use the Django API configuration documented in [`PRODUCTION.md`](PRODUCTION.md); the build fails when it is absent.

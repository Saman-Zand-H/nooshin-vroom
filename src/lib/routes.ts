export const viewPaths = {
  home: "/",
  library: "/books",
  films: "/films-and-series",
  games: "/games",
  listen: "/songs",
  requests: "/setlist",
  vault: "/wishes",
  notes: "/notes",
  connections: "/connections",
  explore: "/corners",
  "rabbit-holes": "/rabbit-holes",
  "movie-night": "/watch-nights",
  adventures: "/adventure-book",
  lyrics: "/lyric-wall",
} as const;

export type View = keyof typeof viewPaths;
const base = import.meta.env.BASE_URL;
const baseRoot = base === "/" ? "" : base.slice(0, -1);
const pathViews = new Map(
  Object.entries(viewPaths).map(([view, path]) => [
    `${baseRoot}${path}`,
    view as View,
  ]),
);

export function routeHref(view: View): string {
  return `${baseRoot}${viewPaths[view]}`;
}

export function viewFromPath(pathname = window.location.pathname): View | null {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const home = routeHref("home");
  const normalizedHome = home === "/" ? "/" : home.replace(/\/$/, "");
  if (normalized === normalizedHome) return "home";
  return pathViews.get(normalized) ?? null;
}

export function restoreStaticRoute() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("__route");
  if (!encoded) return;
  try {
    const restored = new URL(encoded, window.location.origin);
    if (
      restored.origin === window.location.origin &&
      viewFromPath(restored.pathname)
    )
      window.history.replaceState(null, "", restored.href);
  } catch {
    /* Keep the safe root URL. */
  }
}

export function migrateHashRoute(): View | null {
  const legacy = window.location.hash.slice(1) as View;
  if (!(legacy in viewPaths)) return null;
  window.history.replaceState(null, "", routeHref(legacy));
  return legacy;
}

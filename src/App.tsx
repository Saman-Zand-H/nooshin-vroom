import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Feather,
  Headphones,
  Home as HomeIcon,
  Moon,
  MoonStar,
  Settings,
  Ticket,
  Compass,
} from "lucide-react";
import { MotionConfig } from "motion/react";
import { AuthGate } from "./components/AuthGate";
import { Home } from "./components/Home";
import { Collection } from "./components/Collections";
import { Connections } from "./components/Connections";
const Composer = lazy(() =>
  import("./components/Composer").then((module) => ({
    default: module.Composer,
  })),
);
import { RoomProvider, useRoom } from "./lib/room-context";
import type { Entry, Kind } from "./lib/model";
import { ImdbAutoRefresh } from "./lib/imdb-connection";
import { SpotifyLibrarySync } from "./lib/spotify-sync";
import { routeHref, viewPaths, viewFromPath, type View } from "./lib/routes";
const ExtraRooms = lazy(() => import("./components/sections/ExtraRooms"));
const extraViews: View[] = [
  "explore",
  "movie-night",
  "adventures",
  "lyrics",
  "little-loves",
  "moon-days",
];

const navigation: { id: View; label: string; icon: typeof HomeIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "library", label: "Bookshelf", icon: BookOpen },
  { id: "listen", label: "Listening", icon: Headphones },
  { id: "requests", label: "Setlist", icon: Ticket },
  { id: "adventures", label: "Adventure book", icon: Compass },
  { id: "moon-days", label: "Moon days", icon: MoonStar },
];
const navViewIds = new Set(navigation.map(({ id }) => id));
const viewKinds: Record<string, Kind> = {
  library: "book",
  listen: "music",
  requests: "request",
  vault: "wish",
  notes: "note",
  films: "film",
  games: "game",
};
function viewFromLocation() {
  return viewFromPath() ?? "home";
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthGate>
        {(access) => (
          <RoomProvider key={access.member.user_id} access={access}>
            <Room />
          </RoomProvider>
        )}
      </AuthGate>
    </MotionConfig>
  );
}

function Room() {
  const { local, loading, error, reload } = useRoom();
  const [view, setView] = useState(viewFromLocation);
  const [composer, setComposer] = useState<{
    kind: Kind;
    entry?: Entry;
  } | null>(null);
  const [message, setMessage] = useState("");
  const toastTimer = useRef<number>(undefined);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const change = () => {
      setView(viewFromLocation());
      window.scrollTo({ top: 0 });
      main.current?.focus({ preventScroll: true });
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a")
          : null;
      if (!anchor || anchor.target || anchor.download) return;
      const url = new URL(anchor.href, window.location.href);
      const next =
        url.origin === window.location.origin
          ? viewFromPath(url.pathname)
          : null;
      if (!next) return;
      event.preventDefault();
      // pushState creates the clean route; popstate restores Back/Forward.
      // Sources: https://developer.mozilla.org/en-US/docs/Web/API/History/pushState
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event
      window.history.pushState(null, "", url.href);
      change();
    };
    window.addEventListener("popstate", change);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("popstate", change);
      document.removeEventListener("click", click);
    };
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const navigate = (next: string) => {
    if (!(next in viewPaths)) return;
    window.history.pushState(null, "", routeHref(next as View));
    setView(next as View);
    window.scrollTo({ top: 0 });
    main.current?.focus({ preventScroll: true });
  };
  const onSaved = (text: string) => {
    setMessage(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setMessage(""), 3500);
  };
  const onAdd = (kind: Kind) => setComposer({ kind });
  const onEdit = (entry: Entry) => setComposer({ kind: entry.kind, entry });
  return (
    <div className="app">
      <ImdbAutoRefresh />
      <SpotifyLibrarySync />
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a
          href={routeHref("home")}
          className="wordmark"
          aria-label="Nooshin, home"
        >
          <span className="brand-mark">
            <Moon size={22} strokeWidth={1.2} />
            <span>✧</span>
          </span>
          <span>
            Nooshin
            <span className="brand-caption">
              a quiet room for the things you love
            </span>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.map(({ id, label }) => (
            <a
              key={id}
              href={routeHref(id)}
              aria-current={
                view === id ||
                (id === "library" && ["films", "games"].includes(view))
                  ? "page"
                  : undefined
              }
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="header-end">
          {local && <span className="local-label">Private on this device</span>}
          <a
            href={routeHref("explore")}
            className="icon-button"
            aria-label="Explore more rooms"
            aria-current={
              extraViews.includes(view) && !navViewIds.has(view)
                ? "page"
                : undefined
            }
          >
            <Compass size={20} strokeWidth={1.3} />
          </a>
          <a
            href={routeHref("notes")}
            className="icon-button desktop-notes"
            aria-label="Notes"
            aria-current={view === "notes" ? "page" : undefined}
          >
            <Feather size={18} />
          </a>
          <a
            href={routeHref("connections")}
            className="icon-button"
            aria-label="Connections and settings"
            aria-current={view === "connections" ? "page" : undefined}
          >
            <Settings size={19} strokeWidth={1.5} />
          </a>
        </div>
      </header>
      <main className="main-content" id="main-content" ref={main} tabIndex={-1}>
        {loading ? (
          <div className="room-loading" role="status">
            <Moon size={30} />
            <p>Loading…</p>
          </div>
        ) : error ? (
          <div className="room-loading" role="alert">
            <p>{error}</p>
            <button className="button primary" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        ) : view === "home" ? (
          <Home onAdd={onAdd} onEdit={onEdit} onNavigate={navigate} />
        ) : view === "connections" ? (
          <Connections />
        ) : extraViews.includes(view) ? (
          <Suspense
            fallback={
              <div className="room-loading" role="status">
                Loading…
              </div>
            }
          >
            <ExtraRooms key={view} view={view} onAdd={onAdd} onEdit={onEdit} />
          </Suspense>
        ) : (
          <Collection
            key={view}
            kind={viewKinds[view] || "book"}
            onAdd={onAdd}
            onEdit={onEdit}
          />
        )}
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={routeHref(id)}
            aria-current={
              view === id ||
              (id === "library" && ["films", "games"].includes(view))
                ? "page"
                : undefined
            }
          >
            <Icon size={20} strokeWidth={1.5} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      {composer && (
        <Suspense
          fallback={
            <div className="toast visible" role="status">
              Opening editor…
            </div>
          }
        >
          <Composer
            key={composer.entry?.id || composer.kind}
            {...composer}
            onClose={() => setComposer(null)}
            onSaved={onSaved}
          />
        </Suspense>
      )}
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </div>
  );
}

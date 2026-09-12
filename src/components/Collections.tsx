import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Feather,
  Headphones,
  Plus,
  Search,
  Sparkles,
  Star,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Library,
  LayoutGrid,
} from "lucide-react";
import type { Entry, Kind } from "../lib/model";
import { useRoom } from "../lib/room-context";
import { Artwork, Recording } from "./Artwork";
import { spotifyRequest, useSpotify, type Listening } from "../lib/spotify";
import { ImdbImportButton } from "./ImdbImportButton";
import { ImdbConnectionButton } from "./ImdbConnection";
import { SpotifyConnectButton } from "./SpotifyConnectButton";
import { screenType, type ScreenType } from "../lib/screen-media";
import { compareSpotifyEntries } from "../lib/spotify-library";
import {
  requestSpotifyLibrarySync,
  useSpotifyLibrarySyncState,
} from "../lib/spotify-sync";
import { routeHref } from "../lib/routes";
import { SpotifyStats } from "./SpotifyStats";
import { Bookcase } from "./Bookcase";

interface Actions {
  onAdd: (kind: Kind) => void;
  onEdit: (entry: Entry) => void;
}
const emptyCopy: Record<Kind, { heading: string; body: string }> = {
  book: {
    heading: "Which world has you now, Nooshin?",
    body: "Add the book you’re in, or the one waiting beside it.",
  },
  film: {
    heading: "What story should play next?",
    body: "Keep films and series for the nights you choose for yourself.",
  },
  game: {
    heading: "Which world are you disappearing into?",
    body: "Keep the games you love and the ones you’re about to make yours.",
  },
  rabbit_hole: {
    heading: "Show me where your mind went.",
    body: "Connect the song, idea, character, or story that led to the next one.",
  },
  movie_night: {
    heading: "What should we watch tonight?",
    body: "Plan a film or a few episodes, on your own or beside me.",
  },
  adventure: {
    heading: "Adventure is out there.",
    body: "Little plans and moments worth keeping.",
  },
  lyric: {
    heading: "Which words stayed?",
    body: "Pin the lines that sound like you when you say them.",
  },
  music: {
    heading: "Send me the song.",
    body: "Save the music that found you at exactly the right time.",
  },
  wish: {
    heading: "What did you stop to look at twice?",
    body: "Leave a picture, a link, and the details I should remember.",
  },
  request: {
    heading: "Give me something to learn.",
    body: "Tell me the song you want to hear in my hands.",
  },
  note: {
    heading: "Something I wanted you to have.",
    body: "Save a photo, a thought, or a small piece of your day.",
  },
};

export function Collection({
  kind: initialKind,
  onAdd,
  onEdit,
}: { kind: Kind } & Actions) {
  const { entries } = useRoom();
  const kind = initialKind;
  const [query, setQuery] = useState("");
  const [bookView, setBookView] = useState<"shelf" | "covers">("shelf");
  const [filter, setFilter] = useState("All");
  const [collectionPage, setCollectionPage] = useState(0);
  const [mediaFilter, setMediaFilter] = useState<"all" | ScreenType>("all");
  const library = ["book", "film", "game"].includes(initialKind);
  const group = entries
    .filter((entry) => entry.kind === kind)
    .sort(kind === "music" ? compareSpotifyEntries : undefined);
  const visible = group.filter(
    (entry) =>
      (filter === "All" || entry.status === filter) &&
      (kind !== "film" ||
        mediaFilter === "all" ||
        screenType(entry.format) === mediaFilter) &&
      `${entry.title} ${entry.creator} ${entry.note}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const paged = kind === "film" || kind === "music";
  const collectionPages = Math.max(1, Math.ceil(visible.length / 48));
  const currentCollectionPage = Math.min(collectionPage, collectionPages - 1);
  const shown = paged
    ? visible.slice(
        currentCollectionPage * 48,
        (currentCollectionPage + 1) * 48,
      )
    : visible;
  const title =
    kind === "book" ? (
      <>
        The shelf of <em>your worlds.</em>
      </>
    ) : kind === "music" ? (
      <>
        Songs that <em>found you.</em>
      </>
    ) : kind === "wish" ? (
      <>
        Things you <em>might choose.</em>
      </>
    ) : kind === "request" ? (
      <>
        Songs for <em>my hands.</em>
      </>
    ) : kind === "note" ? (
      <>
        Things worth <em>keeping.</em>
      </>
    ) : kind === "film" ? (
      <>
        Films & <em>series you chose.</em>
      </>
    ) : (
      <>
        Your <em>other worlds.</em>
      </>
    );
  const addLabel =
    kind === "book"
      ? "Add a book"
      : kind === "music"
        ? "Save a song"
        : kind === "wish"
          ? "Add a wish"
          : kind === "request"
            ? "Request a song"
            : kind === "note"
              ? "Leave a note"
              : kind === "film"
                ? "Add a film or series"
                : "Add a game";
  return (
    <div className={`collection collection-${kind}`}>
      <div className="page-title">
        <div>
          <span className="eyebrow">
            {kind === "wish"
              ? "THINGS YOU’D LOVE"
              : kind === "request"
                ? "THE VIOLIN SETLIST"
                : kind === "note"
                  ? "LITTLE THINGS THAT MATTER"
                  : kind === "film"
                    ? "NOOSHIN’S WATCHLIST"
                    : "THE THINGS YOU CHOOSE"}
          </span>
          <h1>{title}</h1>
          <p>
            {group.length
              ? kind === "film"
                ? `${group.length} saved ${group.length === 1 ? "title" : "titles"}. For evenings to yourself, or a night with me.`
                : `${group.length} saved ${kind === "book" ? (group.length === 1 ? "book" : "books") : kind === "music" ? (group.length === 1 ? "song" : "songs") : group.length === 1 ? "item" : "items"}.`
              : emptyCopy[kind].body}
          </p>
        </div>
        <button className="button primary" onClick={() => onAdd(kind)}>
          <Plus size={18} />
          {addLabel}
        </button>
      </div>
      {library && (
        <div className="collection-tabs">
          {(["book", "film", "game"] as const).map((type) => (
            <a
              key={type}
              aria-current={kind === type ? "page" : undefined}
              className={kind === type ? "active" : ""}
              href={routeHref(
                type === "book"
                  ? "library"
                  : type === "film"
                    ? "films"
                    : "games",
              )}
            >
              {type === "book"
                ? "Books & audiobooks"
                : type === "film"
                  ? "Films & series"
                  : "Games"}
            </a>
          ))}
        </div>
      )}
      {kind === "film" && (
        <section className="imdb-collection-strip">
          <div>
            <span className="imdb-mark">IMDb</span>
            <p>
              Your IMDb Watchlist
              <small>
                Link your public Watchlist, or import an IMDb export.
              </small>
            </p>
          </div>
          <div className="imdb-connection-actions">
            <ImdbConnectionButton />
            <ImdbImportButton className="text-button" />
          </div>
        </section>
      )}
      {kind === "film" && (
        <div className="screen-library-tools">
          <div className="filter-chips" role="group" aria-label="Title type">
            {(
              [
                ["all", "All titles"],
                ["film", "Films"],
                ["series", "Series"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={mediaFilter === value ? "active" : ""}
                aria-pressed={mediaFilter === value}
                onClick={() => {
                  setMediaFilter(value);
                  setCollectionPage(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <a className="text-button" href={routeHref("movie-night")}>
            Plan an evening <ArrowUpRight size={16} />
          </a>
        </div>
      )}
      {kind === "music" && <SpotifyListening />}
      {kind === "music" && <SpotifyStats entries={group} />}
      {group.length > 0 && (
        <div className="collection-toolbar">
          <label className="search-input">
            <Search size={18} />
            <input
              type="search"
              aria-label="Search this collection"
              placeholder="Search titles, names, or notes…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCollectionPage(0);
              }}
            />
          </label>
          <div className="filter-chips">
            {["All", ...new Set(group.map((entry) => entry.status))].map(
              (status) => (
                <button
                  key={status}
                  aria-pressed={filter === status}
                  className={filter === status ? "active" : ""}
                  onClick={() => {
                    setFilter(status);
                    setCollectionPage(0);
                  }}
                >
                  {status}
                </button>
              ),
            )}
          </div>
        </div>
      )}
      {kind === "book" && (
        <div className="book-view-tools">
          <div
            className="book-view-switch"
            role="group"
            aria-label="Book display"
          >
            <button
              aria-pressed={bookView === "shelf"}
              onClick={() => setBookView("shelf")}
            >
              <Library size={16} /> Library
            </button>
            <button
              aria-pressed={bookView === "covers"}
              onClick={() => setBookView("covers")}
            >
              <LayoutGrid size={16} /> Covers
            </button>
          </div>
          <span>
            {visible.length} {visible.length === 1 ? "book" : "books"}
            {filter !== "All" ? ` · ${filter}` : ""}
          </span>
        </div>
      )}
      {kind === "book" && bookView === "shelf" ? (
        <Bookcase
          allEntries={group}
          entries={shown}
          onEdit={onEdit}
          onAdd={() => onAdd("book")}
          filtered={group.length > 0 && !visible.length}
          onClear={() => {
            setQuery("");
            setFilter("All");
          }}
        />
      ) : !visible.length ? (
        <div className="empty-collection">
          <div className="empty-emblem">
            {kind === "music" ? (
              <Headphones />
            ) : kind === "request" ? (
              <Ticket />
            ) : kind === "wish" ? (
              <Sparkles />
            ) : kind === "note" ? (
              <Feather />
            ) : (
              <BookOpen />
            )}
          </div>
          <h2>
            {group.length
              ? "Nothing matches just yet."
              : emptyCopy[kind].heading}
          </h2>
          <p>
            {group.length
              ? "Try another title or clear the filters."
              : emptyCopy[kind].body}
          </p>
          {!group.length && (
            <button className="text-button" onClick={() => onAdd(kind)}>
              {addLabel}
              <Plus size={17} />
            </button>
          )}
        </div>
      ) : (
        <div className="collection-grid">
          {shown.map((entry) => (
            <article
              key={entry.id}
              className={`collection-item item-${entry.kind}`}
            >
              <button
                className="entry-open"
                onClick={() => onEdit(entry)}
                aria-label={`Open ${entry.title}`}
              >
                <Artwork entry={entry} />
                <div className="entry-copy">
                  <span className="entry-status">
                    {entry.status}
                    {entry.format && ` · ${entry.format}`}
                  </span>
                  <h2 dir="auto">{entry.title}</h2>
                  {entry.creator && <p dir="auto">{entry.creator}</p>}
                  {entry.note && (
                    <p className="entry-note" dir="auto">
                      {entry.note}
                    </p>
                  )}
                  {entry.progress > 0 &&
                    ["book", "film", "game"].includes(kind) && (
                      <div
                        className="reading-progress"
                        aria-label={`${entry.progress}% finished`}
                      >
                        <span style={{ width: `${entry.progress}%` }} />
                      </div>
                    )}
                  {entry.rating > 0 && (
                    <span
                      className="entry-rating"
                      aria-label={`${entry.rating} out of 5 stars`}
                    >
                      {Array.from({ length: entry.rating }, (_, index) => (
                        <Star size={12} key={index} fill="currentColor" />
                      ))}
                    </span>
                  )}
                </div>
              </button>
              {entry.recording_path && <Recording entry={entry} />}
              {entry.link && (
                <a
                  href={entry.link}
                  className="text-button entry-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {kind === "wish"
                    ? "Visit link"
                    : kind === "music" || kind === "request"
                      ? "Open listening link"
                      : "Open link"}
                  <ArrowUpRight size={16} />
                </a>
              )}
            </article>
          ))}
        </div>
      )}
      {paged && collectionPages > 1 && (
        <nav
          className="collection-pagination"
          aria-label={`${kind === "music" ? "Song" : "Film and series"} collection pages`}
        >
          <button
            className="button secondary"
            disabled={currentCollectionPage === 0}
            onClick={() => setCollectionPage(currentCollectionPage - 1)}
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <span aria-live="polite">
            Page {currentCollectionPage + 1} of {collectionPages} ·{" "}
            {visible.length.toLocaleString()}{" "}
            {kind === "music" ? "songs" : "titles"}
          </span>
          <button
            className="button secondary"
            disabled={currentCollectionPage === collectionPages - 1}
            onClick={() => setCollectionPage(currentCollectionPage + 1)}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

function SpotifyListening() {
  const spotify = useSpotify();
  const librarySync = useSpotifyLibrarySyncState();
  const [listening, setListening] = useState<Listening | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setListening(await spotifyRequest<Listening>("listening"));
    } catch {
      setError("Could not load your listening. Try again.");
      setListening(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (spotify.status.connected) void load();
    else setListening(null);
  }, [spotify.status.connected]);
  return (
    <section className="spotify-strip">
      <div className="spotify-strip-heading">
        <Headphones size={22} />
        <div>
          <h2>
            {spotify.status.connected
              ? "The songs you’ve been living with"
              : "The songs you bring with you"}
          </h2>
          <p>
            {spotify.busy
              ? "Checking your connection…"
              : spotify.error
                ? "Spotify is temporarily unavailable."
                : spotify.status.connected
                  ? `Connected to ${spotify.status.name || "your Spotify"}`
                  : !spotify.status.configured
                    ? "Spotify isn’t set up for this site yet."
                    : "Connect to see what you’ve been listening to."}
          </p>
        </div>
        {spotify.status.connected ? (
          <button
            className="button secondary"
            disabled={loading || librarySync.phase === "syncing"}
            onClick={() => {
              requestSpotifyLibrarySync();
              void load();
            }}
          >
            {loading || librarySync.phase === "syncing"
              ? "Refreshing…"
              : "Refresh"}
          </button>
        ) : (
          <SpotifyConnectButton spotify={spotify} />
        )}
      </div>
      {(spotify.error || error) && (
        <p className="form-error" role="status">
          {spotify.error || error}
        </p>
      )}
      {spotify.status.connected && librarySync.phase !== "idle" && (
        <p
          className={librarySync.phase === "error" ? "form-error" : "helper"}
          role={librarySync.phase === "error" ? "alert" : "status"}
        >
          {librarySync.phase === "syncing"
            ? `Adding every liked song… ${librarySync.added.toLocaleString()} added${librarySync.total ? ` · ${librarySync.total.toLocaleString()} in Spotify` : ""}`
            : librarySync.message}
        </p>
      )}
      {listening && (
        <div className="spotify-items">
          {listening.current && (
            <a
              href={listening.current.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Playing now</span>
              <strong>{listening.current.title}</strong>
              <small>{listening.current.creator}</small>
              <ArrowUpRight size={16} />
            </a>
          )}
          {listening.recent.slice(0, 3).map((track, index) => (
            <a
              key={`${track.id}-${index}`}
              href={track.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Recently played</span>
              <strong>{track.title}</strong>
              <small>{track.creator}</small>
              <ArrowUpRight size={16} />
            </a>
          ))}
          {!listening.current && !listening.recent.length && (
            <p>No recent listening to show.</p>
          )}
        </div>
      )}
    </section>
  );
}

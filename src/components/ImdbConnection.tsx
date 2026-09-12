import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Link2,
  LoaderCircle,
  RefreshCw,
  Unplug,
  X,
} from "lucide-react";
import { imdbErrors } from "../../shared/imdb-watchlist";
import { useWatchlistConnection } from "../lib/imdb-connection";
import { ImdbImportButton } from "./ImdbImportButton";

const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not verified yet";
export function ImdbConnectionButton({
  className = "button secondary",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        <Link2 size={16} />
        IMDb connection
      </button>
      {open && <WatchlistDialog onClose={() => setOpen(false)} />}
    </>
  );
}
export function ImdbConnectionCard() {
  const { status, error } = useWatchlistConnection();
  const description = error
    ? "Could not check the connection. Saved films remain in the room."
    : !status
      ? "Checking your Watchlist connection…"
      : status.phase === "refreshing"
        ? "Reading the complete Watchlist…"
        : status.phase === "connected"
          ? `${status.titleCount.toLocaleString()} titles in the last verified Watchlist.`
          : status.phase === "needs_attention"
            ? "The saved link needs attention. Your previous films are still here."
            : !status.available
              ? "Public linking is not available here yet. You can still import your IMDb export."
              : "Link a public Watchlist to bring new films into the room automatically.";
  return (
    <section className="setting-row imdb-setting">
      <span className="imdb-mark">IMDb</span>
      <div>
        <h2>Your IMDb Watchlist</h2>
        <p>{description}</p>
        {status?.lastSuccessAt && (
          <small>Last verified: {dateLabel(status.lastSuccessAt)}</small>
        )}
        <small>
          Public link connection · CSV import also available for private lists
        </small>
      </div>
      <div className="imdb-connection-actions">
        <ImdbConnectionButton />
        <ImdbImportButton className="text-button" />
      </div>
    </section>
  );
}
function WatchlistDialog({ onClose }: { onClose: () => void }) {
  const { status, error, pending, check, run } = useWatchlistConnection();
  const [url, setUrl] = useState("");
  const opener = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const coolingDown = Boolean(
    status?.retryAfter && Date.parse(status.retryAfter) > Date.now(),
  );
  const refreshing =
    pending === "connect" ||
    pending === "refresh" ||
    status?.phase === "refreshing";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run("connect", url);
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content imdb-connect-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            else document.getElementById("main-content")?.focus();
          }}
        >
          <div className="dialog-heading">
            <div>
              <span className="eyebrow">
                <span className="imdb-mark">IMDb</span>A LINK TO YOUR NEXT MOVIE
                NIGHT
              </span>
              <Dialog.Title>Keep your Watchlist close.</Dialog.Title>
              <Dialog.Description>
                Paste a public IMDb Watchlist link. The room checks for new
                titles and keeps your own notes, ratings, and pictures.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              aria-label="Close IMDb connection"
            >
              <X size={21} />
            </Dialog.Close>
          </div>
          {!status && !error ? (
            <p role="status" className="helper">
              Checking the connection…
            </p>
          ) : status?.sourceUrl ? (
            <div className="watchlist-connection">
              <span
                className={`watchlist-phase phase-${status.phase}`}
                role="status"
              >
                {refreshing ? (
                  <LoaderCircle size={16} className="spin" />
                ) : status.phase === "connected" ? (
                  <Check size={16} />
                ) : (
                  <Clock3 size={16} />
                )}
                {refreshing
                  ? "Reading the complete Watchlist…"
                  : status.phase === "connected"
                    ? "Public Watchlist verified"
                    : "Link saved · needs attention"}
              </span>
              <a
                className="watchlist-source"
                href={status.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {status.sourceUrl}
                <ArrowUpRight size={15} />
              </a>
              <dl className="watchlist-facts">
                <div>
                  <dt>Last successful refresh</dt>
                  <dd>{dateLabel(status.lastSuccessAt)}</dd>
                </div>
                <div>
                  <dt>Titles in that list</dt>
                  <dd>
                    {status.lastSuccessAt
                      ? status.titleCount.toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>New films at last refresh</dt>
                  <dd>
                    {status.lastSuccessAt
                      ? status.lastAdded.toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Automatic updates</dt>
                  <dd>
                    {!status.available
                      ? "Paused until the reader is available"
                      : status.automatic === "background"
                        ? "Scheduled every 6 hours, even when the room is closed"
                        : status.automatic === "while_open"
                          ? "Every 6 hours while the room is open"
                          : "Manual refresh"}
                  </dd>
                </div>
              </dl>
              {status.errorCode && (
                <p className="form-error" role="status">
                  {imdbErrors[status.errorCode]}
                </p>
              )}
              {!status.available && (
                <p className="helper">
                  The room’s IMDb reader is unavailable. Your saved list is
                  kept.
                </p>
              )}
              <div className="watchlist-controls">
                <button
                  className="button primary"
                  disabled={
                    !status.available ||
                    Boolean(pending) ||
                    refreshing ||
                    coolingDown
                  }
                  onClick={() => void run("refresh")}
                >
                  <RefreshCw size={16} />
                  Refresh now
                </button>
                <button
                  className="text-button"
                  disabled={pending === "disconnect"}
                  onClick={() => void run("disconnect")}
                >
                  <Unplug size={15} />
                  {pending === "disconnect"
                    ? "Disconnecting…"
                    : "Disconnect link"}
                </button>
              </div>
              {coolingDown && !refreshing && (
                <p className="helper">
                  You can check again at {dateLabel(status.retryAfter)}.
                </p>
              )}
              <p className="helper watchlist-kept-note">
                Disconnecting stops updates. It keeps the films already in your
                room.
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label>
                Public IMDb Watchlist link
                <input
                  type="url"
                  required
                  maxLength={512}
                  placeholder="https://www.imdb.com/user/…/watchlist/"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  autoComplete="off"
                  autoFocus
                  disabled={Boolean(pending)}
                />
              </label>
              <p className="helper">
                Copy the full link from the Watchlist’s share option. It must
                contain /user/…/watchlist/. Your IMDb password is never needed.
              </p>
              {status && !status.available && (
                <p className="form-error" role="status">
                  Public linking is not available in this room yet. You can
                  still import your IMDb export.
                </p>
              )}
              <button
                className="button primary watchlist-connect-submit"
                disabled={!status?.available || Boolean(pending)}
              >
                {refreshing ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Link2 size={17} />
                )}
                {refreshing ? "Verifying Watchlist…" : "Connect Watchlist"}
              </button>
            </form>
          )}
          {error && (
            <div className="form-error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="text-button"
                onClick={() => void check()}
              >
                Check connection status
              </button>
            </div>
          )}
          <p className="helper watchlist-explanation">
            This reads a publicly visible list through IMDb’s website interface.
            It never changes list privacy, removes your saved films, or reads a
            private list. If IMDb changes or blocks the interface, the last
            successful list stays here.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

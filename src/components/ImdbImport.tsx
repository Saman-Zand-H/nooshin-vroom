import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileUp,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { useRoom } from "../lib/room-context";
import { routeHref } from "../lib/routes";
import { IMDb, existingImdbIds, type ImdbImportResult } from "../lib/imdb";
import { readImdbFile, type ImdbPreview } from "../lib/imdb-csv";

const pageSize = 25;
export default function ImdbImport({ onClose }: { onClose: () => void }) {
  const { entries, store, local, reload } = useRoom();
  const [preview, setPreview] = useState<ImdbPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImdbImportResult | null>(null);
  const [progress, setProgress] = useState({ confirmed: 0, total: 0 });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const operation = useRef(false);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const opener = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const existing = useMemo(() => existingImdbIds(entries), [entries]);
  const available =
    preview?.rows.filter((row) => !existing.has(row.film.imdbId)) ?? [];
  const selectedCount = available.filter((row) =>
    selected.has(row.film.imdbId),
  ).length;
  const matching =
    preview?.rows.filter((row) =>
      `${row.film.title} ${row.film.creator} ${row.film.format}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    ) ?? [];
  const pages = Math.max(1, Math.ceil(matching.length / pageSize));
  const activePage = Math.min(page, pages - 1);
  const visible = matching.slice(
    activePage * pageSize,
    (activePage + 1) * pageSize,
  );
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || operation.current) return;
    const id = ++generation.current;
    setReading(true);
    setError("");
    setPreview(null);
    setResult(null);
    setQuery("");
    setPage(0);
    setFileName(file.name);
    try {
      const parsed = await readImdbFile(file);
      if (id !== generation.current) return;
      setPreview(parsed);
      setSelected(
        new Set(
          parsed.rows
            .filter((row) => !existing.has(row.film.imdbId))
            .map((row) => row.film.imdbId),
        ),
      );
    } catch (failure) {
      if (id === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not read this CSV. Try another IMDb export.",
        );
    } finally {
      if (id === generation.current) setReading(false);
    }
  }
  async function importSelected() {
    if (operation.current || !selectedCount) return;
    const films = available
      .filter((row) => selected.has(row.film.imdbId))
      .map((row) => row.film);
    operation.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    setProgress({ confirmed: 0, total: films.length });
    const count = { added: 0, skipped: 0 };
    try {
      for (let offset = 0; offset < films.length; offset += IMDb.batchSize) {
        const batch = films.slice(offset, offset + IMDb.batchSize);
        const receipt = await store.importImdb(batch);
        count.added += receipt.added;
        count.skipped += receipt.skipped;
        setProgress({
          confirmed: Math.min(offset + batch.length, films.length),
          total: films.length,
        });
      }
      setResult(count);
    } catch (failure) {
      setError(
        `${failure instanceof Error ? failure.message : "The import stopped."} ${count.added ? `${count.added} new titles were confirmed saved. ` : ""}Reopen this file to resume; any titles already saved will be skipped.`,
      );
    } finally {
      await reload();
      operation.current = false;
      setBusy(false);
    }
  }
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !operation.current) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content imdb-import"
          onEscapeKeyDown={(event) => {
            if (operation.current) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            else document.getElementById("main-content")?.focus();
          }}
        >
          <div className="dialog-heading">
            <div>
              <span className="eyebrow">
                <span className="imdb-mark">IMDb</span>YOUR NEXT FILM IS ALREADY
                ON THE LIST
              </span>
              <Dialog.Title>Bring your Watchlist.</Dialog.Title>
              <Dialog.Description>
                Import the films and series you’ve saved on IMDb into your room.
                They’ll be waiting for you in Films & series.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              disabled={busy}
              aria-label="Close IMDb import"
            >
              <X size={21} />
            </Dialog.Close>
          </div>
          {result ? (
            <div className="imdb-complete" role="status">
              <span className="imdb-complete-icon">
                <CheckCheck size={28} />
              </span>
              <h3>
                {result.added
                  ? `${result.added.toLocaleString()} ${result.added === 1 ? "new title" : "new titles"} in your room.`
                  : "Those titles are already here."}
              </h3>
              <p>
                {result.skipped > 0 &&
                  `${result.skipped.toLocaleString()} already saved ${result.skipped === 1 ? "title was" : "titles were"} skipped. `}
                Your ratings, notes, pictures, and watched status stay as you
                left them.
              </p>
              <div className="imdb-complete-actions">
                <a
                  href={routeHref("films")}
                  className="button primary"
                  onClick={onClose}
                >
                  Open Films & series
                  <ArrowRight size={17} />
                </a>
                <a
                  href={routeHref("movie-night")}
                  className="text-button"
                  onClick={onClose}
                >
                  Plan an evening
                  <ArrowUpRight size={16} />
                </a>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setResult(null);
                  setPreview(null);
                  setFileName("");
                }}
              >
                Import another export
              </button>
            </div>
          ) : (
            <>
              <details className="imdb-instructions" open={!preview}>
                <summary>How to get your IMDb export</summary>
                <ol>
                  <li>
                    Open{" "}
                    <a
                      href={IMDb.watchlistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      your IMDb Watchlist <ArrowUpRight size={12} />
                    </a>{" "}
                    in the browser while signed in.
                  </li>
                  <li>
                    Choose <strong>Export</strong>. If IMDb prepares it first,
                    download the CSV from your Exports page when it is ready.
                  </li>
                  <li>
                    Choose that <strong>.csv</strong> file below. On a phone, it
                    is usually in Downloads.
                  </li>
                </ol>
                <a
                  className="text-button"
                  href={IMDb.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  IMDb’s export help
                  <ArrowUpRight size={14} />
                </a>
              </details>
              <div className="imdb-file-picker">
                <FileUp size={25} strokeWidth={1.3} />
                <div>
                  <strong>{fileName || "Choose your Watchlist CSV"}</strong>
                  <small>
                    {reading
                      ? "Reading your export…"
                      : "IMDb title-list export · up to 16 MB / 12,000 rows"}
                  </small>
                </div>
                <input
                  ref={fileInput}
                  className="sr-only"
                  type="file"
                  accept=".csv,text/csv"
                  aria-label="IMDb Watchlist CSV"
                  disabled={busy || reading}
                  onChange={(event) => void chooseFile(event)}
                />
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy || reading}
                >
                  {reading ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    "Choose file"
                  )}
                </button>
              </div>
              {preview && (
                <>
                  <div className="imdb-preview-counts" aria-live="polite">
                    <span>
                      <strong>{available.length.toLocaleString()}</strong> new
                    </span>
                    <span>
                      <strong>
                        {(
                          preview.rows.length - available.length
                        ).toLocaleString()}
                      </strong>{" "}
                      already in your room
                    </span>
                    {preview.duplicates > 0 && (
                      <span>
                        <strong>{preview.duplicates}</strong> repeated rows
                      </span>
                    )}
                    {preview.invalid.length > 0 && (
                      <span>
                        <strong>{preview.invalid.length}</strong> rows to skip
                      </span>
                    )}
                  </div>
                  {preview.invalid.length > 0 && (
                    <details className="imdb-row-issues">
                      <summary>
                        {preview.invalid.length}{" "}
                        {preview.invalid.length === 1
                          ? "row could"
                          : "rows could"}{" "}
                        not be imported
                      </summary>
                      <ul>
                        {preview.invalid.slice(0, 30).map((issue) => (
                          <li key={issue.line}>
                            Row {issue.line}: {issue.reason}
                          </li>
                        ))}
                      </ul>
                      {preview.invalid.length > 30 && (
                        <p>
                          {preview.invalid.length - 30} more invalid rows.
                          Correct the export to include them.
                        </p>
                      )}
                    </details>
                  )}
                  {preview.rows.length ? (
                    <>
                      <div className="imdb-selection-tools">
                        <label className="search-input">
                          <Search size={17} />
                          <input
                            type="search"
                            aria-label="Search IMDb export"
                            placeholder="Find a title…"
                            value={query}
                            disabled={busy}
                            onChange={(event) => {
                              setQuery(event.target.value);
                              setPage(0);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy || !available.length}
                          onClick={() =>
                            setSelected(
                              selectedCount === available.length
                                ? new Set()
                                : new Set(
                                    available.map((row) => row.film.imdbId),
                                  ),
                            )
                          }
                        >
                          {selectedCount === available.length
                            ? "Select none"
                            : "Select all new"}
                        </button>
                      </div>
                      <div className="imdb-preview-list">
                        {visible.map(({ film }) => {
                          const exists = existing.has(film.imdbId);
                          return (
                            <label
                              className={`imdb-preview-row ${exists ? "already-saved" : ""}`}
                              key={film.imdbId}
                            >
                              <input
                                type="checkbox"
                                disabled={busy || exists}
                                checked={!exists && selected.has(film.imdbId)}
                                onChange={() => toggle(film.imdbId)}
                                aria-label={`Import ${film.title}`}
                              />
                              <span>
                                <strong dir="auto">{film.title}</strong>
                                <small dir="auto">
                                  {[film.format, film.creator]
                                    .filter(Boolean)
                                    .join(" · ") || film.imdbId}
                                </small>
                              </span>
                              {exists && (
                                <span className="imdb-saved-label">
                                  <Check size={13} />
                                  Saved
                                </span>
                              )}
                            </label>
                          );
                        })}
                        {!visible.length && (
                          <p className="helper">No titles match this search.</p>
                        )}
                      </div>
                      {pages > 1 && (
                        <div className="imdb-pagination">
                          <button
                            className="icon-button"
                            disabled={activePage === 0 || busy}
                            aria-label="Previous import page"
                            onClick={() => setPage(activePage - 1)}
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <span>
                            Page {activePage + 1} of {pages}
                          </span>
                          <button
                            className="icon-button"
                            disabled={activePage === pages - 1 || busy}
                            aria-label="Next import page"
                            onClick={() => setPage(activePage + 1)}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      )}
                      {!available.length && (
                        <p className="helper">
                          Every valid title in this export is already in your
                          room.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="helper">
                      No valid titles to import. Check the rows above or choose
                      another export.
                    </p>
                  )}
                </>
              )}
              <p className="helper imdb-import-boundary">
                This adds a copy of the list, without automatic syncing.{" "}
                {local
                  ? "The file is read on this device."
                  : "Only selected title details are saved to your shared room."}{" "}
                You can keep your IMDb Watchlist private. Export again whenever
                you want to bring over new additions.
              </p>
              {busy && (
                <div className="imdb-progress" role="status">
                  <progress
                    value={progress.confirmed}
                    max={progress.total}
                    aria-label="IMDb import progress"
                  />
                  <span>
                    {progress.confirmed.toLocaleString()} of{" "}
                    {progress.total.toLocaleString()} titles confirmed. Keep
                    this tab open.
                  </span>
                </div>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {preview && (
                <button
                  type="button"
                  className="button primary imdb-import-submit"
                  disabled={busy || !selectedCount}
                  onClick={() => void importSelected()}
                >
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                  {busy
                    ? "Importing…"
                    : `Import ${selectedCount.toLocaleString()} ${selectedCount === 1 ? "title" : "titles"}`}
                </button>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

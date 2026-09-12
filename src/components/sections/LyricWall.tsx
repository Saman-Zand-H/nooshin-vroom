import { useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  GripVertical,
  Pencil,
  Plus,
  Quote,
} from "lucide-react";
import { useRoom } from "../../lib/room-context";
import { newLyric } from "../../lib/section-details";
import type { Entry } from "../../lib/model";
import { Artwork } from "../Artwork";
import type { SectionActions } from "./section-actions";

const position = (entry: Entry) =>
  entry.details?.type === "lyric"
    ? entry.details.position
    : Date.parse(entry.created_at);
const tilt = (id: string) =>
  ((id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9) - 4) *
  0.55;

export function LyricWall({ onAdd, onEdit }: SectionActions) {
  const { entries, save } = useRoom();
  const [arranging, setArranging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const lyrics = entries
    .filter((entry) => entry.kind === "lyric")
    .sort((a, b) => position(a) - position(b) || a.id.localeCompare(b.id));
  async function move(entry: Entry, target: number) {
    if (busy || target < 0 || target >= lyrics.length) return;
    const from = lyrics.findIndex((item) => item.id === entry.id);
    if (from === target) return;
    const others = lyrics.filter((item) => item.id !== entry.id);
    const before = others[target - 1];
    const after = others[target];
    const nextPosition =
      before && after
        ? (position(before) + position(after)) / 2
        : before
          ? position(before) + 1024
          : after
            ? position(after) - 1024
            : Date.now();
    const details =
      entry.details?.type === "lyric" ? entry.details : newLyric();
    setBusy(true);
    setError("");
    try {
      await save(
        { ...entry, details: { ...details, position: nextPosition } },
        {},
        entry,
      );
      setMessage("Wall arrangement saved.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not move that slip. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="lyrics-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">NOOSHIN’S WALL</span>
          <h1>
            A wall of <em>lyrics.</em>
          </h1>
          <p>
            I wanted you to have your wall here, too. Add the lyrics from home
            and any new ones you fall in love with.
          </p>
        </div>
        <button className="button primary" onClick={() => onAdd("lyric")}>
          <Plus size={17} />
          Pin some lyrics
        </button>
      </div>
      <div className="wall-toolbar">
        <span className="handwritten">
          your handwriting would make this perfect.
        </span>
        {lyrics.length > 1 && (
          <button
            className="text-button"
            aria-pressed={arranging}
            onClick={() => setArranging(!arranging)}
          >
            {arranging ? <Check size={16} /> : <GripVertical size={16} />}
            {arranging ? "Done arranging" : "Arrange the wall"}
          </button>
        )}
      </div>
      {arranging && (
        <p className="helper wall-arrange-help">
          Drag a slip, or use the arrows to move it earlier or later. Every move
          is saved.
        </p>
      )}
      <p className="helper wall-save-status" role="status">
        {busy ? "Saving the arrangement…" : message}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section
        className={`lyric-wall ${arranging ? "arranging" : ""}`}
        aria-label="Your lyric wall"
        aria-busy={busy}
      >
        {!lyrics.length ? (
          <div className="empty-lyric-wall">
            <div className="empty-wall-pin" />
            <Quote size={38} strokeWidth={1} />
            <h2 className="handwritten">Which words go up first?</h2>
            <p>
              Type or paste a line you love. Choose its paper and lettering; add
              a photo from your real wall, too.
            </p>
            <button className="text-button" onClick={() => onAdd("lyric")}>
              Pin the first one
              <Plus size={16} />
            </button>
          </div>
        ) : (
          lyrics.map((entry, index) => {
            const details =
              entry.details?.type === "lyric" ? entry.details : newLyric();
            return (
              <article
                key={entry.id}
                className={`lyric-slip paper-${details.paper} lettering-${details.lettering} slip-${details.size}`}
                style={{ "--tilt": `${tilt(entry.id)}deg` } as CSSProperties}
                draggable={arranging && !busy}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", entry.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (arranging && !busy) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const moving = lyrics.find(
                    (item) =>
                      item.id === event.dataTransfer.getData("text/plain"),
                  );
                  if (arranging && moving) void move(moving, index);
                }}
              >
                <span className="slip-tape" aria-hidden="true" />
                <button
                  className="lyric-open"
                  onClick={() => onEdit(entry)}
                  aria-label={`Edit lyrics from ${entry.title}`}
                >
                  <blockquote dir="auto">{entry.note}</blockquote>
                  {entry.image_path || entry.image_url ? (
                    <Artwork entry={entry} />
                  ) : null}
                  <span className="lyric-attribution" dir="auto">
                    <strong>{entry.title}</strong>
                    {entry.creator && <span>{entry.creator}</span>}
                  </span>
                </button>
                <div className="slip-actions">
                  {arranging ? (
                    <>
                      <button
                        className="icon-button"
                        disabled={busy || index === 0}
                        aria-label={`Move ${entry.title} earlier`}
                        onClick={() => void move(entry, index - 1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <span>
                        {index + 1} / {lyrics.length}
                      </span>
                      <button
                        className="icon-button"
                        disabled={busy || index === lyrics.length - 1}
                        aria-label={`Move ${entry.title} later`}
                        onClick={() => void move(entry, index + 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${entry.title}`}
                        onClick={() => onEdit(entry)}
                      >
                        <Pencil size={15} />
                      </button>
                      {entry.link && (
                        <a
                          className="text-button"
                          href={entry.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Hear the song
                          <ArrowUpRight size={14} />
                        </a>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

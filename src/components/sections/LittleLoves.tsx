import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Heart,
  Pencil,
  Plus,
} from "lucide-react";
import { useRoom } from "../../lib/room-context";
import { newLove, readableDate } from "../../lib/section-details";
import type { Entry } from "../../lib/model";
import { Artwork } from "../Artwork";
import type { SectionActions } from "./section-actions";

export function LittleLoves({ onAdd, onEdit }: SectionActions) {
  const { entries } = useRoom();
  const [selected, setSelected] = useState<string | null>(null);
  const loves = entries.filter((entry) => entry.kind === "love");
  const love = loves.find((entry) => entry.id === selected);
  return (
    <div className="loves-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">THE LITTLE THINGS</span>
          <h1>
            Little <em>loves.</em>
          </h1>
          <p>
            The small things that are simply yours — too small for their own
            room, too dear to leave out. Give each one its story, and let the
            little lines add up.
          </p>
        </div>
        <button className="button primary" onClick={() => onAdd("love")}>
          <Plus size={17} />
          Add a little love
        </button>
      </div>
      {love ? (
        <>
          <button className="text-button" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} />
            All little loves
          </button>
          <LoveView key={love.id} love={love} onEdit={onEdit} />
        </>
      ) : !loves.length ? (
        <div className="empty-loves">
          <div className="empty-love-heart" aria-hidden="true">
            <Heart size={30} strokeWidth={1.2} />
          </div>
          <h2>Nothing here yet.</h2>
          <p>
            Start with one small love — anything the room didn’t have a place
            for yet. Name it, tell its story, and let the little lines add up.
          </p>
          <button className="text-button" onClick={() => onAdd("love")}>
            Add the first love
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="loves-list">
          {loves.map((entry) => {
            const details =
              entry.details?.type === "love" ? entry.details : newLove();
            return (
              <button
                key={entry.id}
                className="love-card"
                onClick={() => setSelected(entry.id)}
              >
                <span className="love-photo">
                  {entry.image_path || entry.image_url ? (
                    <Artwork entry={entry} />
                  ) : (
                    <span className="love-photo-empty" aria-hidden="true">
                      <Heart size={34} strokeWidth={1} />
                    </span>
                  )}
                </span>
                <span className="love-card-heading">
                  <h2 dir="auto">{entry.title}</h2>
                  <small>
                    {details.lines.length}{" "}
                    {details.lines.length === 1 ? "LINE" : "LINES"}
                  </small>
                </span>
                <p dir="auto">
                  {details.why ||
                    entry.note ||
                    "A small love, waiting for its story."}
                </p>
                {details.lines.length > 0 && (
                  <span className="love-card-lines">
                    {details.lines.slice(-2).map((line) => (
                      <span key={line.id} className="handwritten" dir="auto">
                        {line.text}
                      </span>
                    ))}
                  </span>
                )}
                <span className="love-card-link">
                  Sit with this one
                  <ArrowUpRight size={16} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoveView({
  love,
  onEdit,
}: {
  love: Entry;
  onEdit: (entry: Entry) => void;
}) {
  const details = love.details?.type === "love" ? love.details : newLove();
  return (
    <article className="love-view">
      <div className="love-title">
        {love.image_path || love.image_url ? (
          <Artwork entry={love} />
        ) : (
          <span className="love-glyph" aria-hidden="true">
            <Heart size={36} strokeWidth={1.1} />
          </span>
        )}
        <div>
          <span className="eyebrow">SIMPLY HERS</span>
          <h2 dir="auto">{love.title}</h2>
          {details.why && <p dir="auto">{details.why}</p>}
          {!details.why && love.note && <p dir="auto">{love.note}</p>}
        </div>
        <button
          className="icon-button"
          aria-label={`Edit ${love.title}`}
          onClick={() => onEdit(love)}
        >
          <Pencil size={17} />
        </button>
      </div>
      {details.lines.length ? (
        <ul className="love-lines">
          {details.lines.map((line) => (
            <li key={line.id}>
              <p className="handwritten" dir="auto">
                {line.text}
              </p>
              {line.when && <small>{readableDate(line.when)}</small>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="love-lines-empty">
          No little lines yet. Edit this love to add the first one — a memory, a
          word, a tiny thing.
        </p>
      )}
    </article>
  );
}

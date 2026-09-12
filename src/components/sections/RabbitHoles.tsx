import { useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clapperboard,
  Gamepad2,
  Lightbulb,
  MapPin,
  Music2,
  Orbit,
  Pencil,
  Plus,
  Quote,
  UserRound,
} from "lucide-react";
import { useRoom } from "../../lib/room-context";
import { newTrail, type TrailStep } from "../../lib/section-details";
import type { Entry } from "../../lib/model";
import { Artwork } from "../Artwork";
import type { SectionActions } from "./section-actions";

const icons = {
  music: Music2,
  book: BookOpen,
  film: Clapperboard,
  game: Gamepad2,
  character: UserRound,
  quote: Quote,
  place: MapPin,
  idea: Lightbulb,
};
export function RabbitHoles({ onAdd, onEdit }: SectionActions) {
  const { entries } = useRoom();
  const [selected, setSelected] = useState<string | null>(null);
  const trails = entries.filter((entry) => entry.kind === "rabbit_hole");
  const trail = trails.find((entry) => entry.id === selected);
  return (
    <div className="rabbit-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">TELL ME EVERYTHING</span>
          <h1>
            Down the <em>rabbit hole.</em>
          </h1>
          <p>
            I love listening to you talk about something you’re into. Show me
            where it started and what you found next.
          </p>
        </div>
        <button className="button primary" onClick={() => onAdd("rabbit_hole")}>
          <Plus size={17} />
          Make a rabbit hole
        </button>
      </div>
      {trail ? (
        <>
          <button className="text-button" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} />
            All rabbit holes
          </button>
          <Trail
            key={trail.id}
            trail={trail}
            entries={entries}
            onEdit={onEdit}
          />
        </>
      ) : !trails.length ? (
        <div className="empty-rabbit">
          <div className="empty-orbit" aria-hidden="true">
            <Music2 />
            <span />
            <BookOpen />
            <span />
            <Clapperboard />
          </div>
          <h2>Show me how your mind connects things.</h2>
          <p>
            Start with two things and the thread between them. Link saved books
            and songs, or write in a character, a quote, or a passing idea.
          </p>
          <button className="text-button" onClick={() => onAdd("rabbit_hole")}>
            Follow the first thread
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="rabbit-list">
          {trails.map((entry) => {
            const details =
              entry.details?.type === "rabbit_hole"
                ? entry.details
                : newTrail();
            return (
              <button
                key={entry.id}
                className="rabbit-card"
                onClick={() => setSelected(entry.id)}
              >
                <div className="rabbit-card-top">
                  <Orbit size={24} strokeWidth={1} />
                  <span>{details.steps.length} STOPS</span>
                </div>
                <h2 dir="auto">{entry.title}</h2>
                <p dir="auto">
                  {entry.note || "Pull a thread and see where it takes you."}
                </p>
                <div className="trail-preview">
                  {details.steps.slice(0, 5).map((step, index) => {
                    const Icon = icons[step.kind];
                    return (
                      <span key={step.id}>
                        <Icon size={18} />
                        {index < Math.min(details.steps.length, 5) - 1 && <i />}
                      </span>
                    );
                  })}
                </div>
                <span className="rabbit-card-link">
                  Go down this rabbit hole
                  <ArrowUpRight size={17} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Trail({
  trail,
  entries,
  onEdit,
}: {
  trail: Entry;
  entries: Entry[];
  onEdit: (entry: Entry) => void;
}) {
  const details =
    trail.details?.type === "rabbit_hole" ? trail.details : newTrail();
  const [currentId, setCurrentId] = useState(details.steps[0]?.id);
  const currentIndex = Math.max(
    0,
    details.steps.findIndex((step) => step.id === currentId),
  );
  const current = details.steps[currentIndex];
  const source = entries.find((entry) => entry.id === current?.entryId);
  const rows = Math.ceil(details.steps.length / 3);
  const points = details.steps.map((_, index) => {
    const row = Math.floor(index / 3);
    const column = row % 2 ? 2 - (index % 3) : index % 3;
    return { x: 16 + column * 34, y: row * 154 + 70 };
  });
  const path = points
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  if (!current) return <p>No stops have been added to this trail.</p>;
  const Icon = icons[current.kind];
  const label = (step: TrailStep) =>
    entries.find((entry) => entry.id === step.entryId)?.title || step.title;
  return (
    <article className="trail-view">
      <div className="trail-title">
        <div>
          <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
          <h2 dir="auto">{trail.title}</h2>
          {trail.note && <p dir="auto">{trail.note}</p>}
        </div>
        <button
          className="icon-button"
          aria-label={`Edit ${trail.title}`}
          onClick={() => onEdit(trail)}
        >
          <Pencil size={17} />
        </button>
      </div>
      <div
        className="trail-chart"
        style={{ "--chart-height": `${rows * 154}px` } as CSSProperties}
      >
        <svg
          viewBox={`0 0 100 ${rows * 154}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={path} />
        </svg>
        {details.steps.map((step, index) => {
          const Glyph = icons[step.kind];
          return (
            <button
              key={step.id}
              className={`trail-node ${current.id === step.id ? "active" : ""}`}
              style={
                {
                  "--node-x": `${points[index].x}%`,
                  "--node-y": `${points[index].y}px`,
                } as CSSProperties
              }
              aria-pressed={current.id === step.id}
              onClick={() => setCurrentId(step.id)}
            >
              <span className="trail-node-icon">
                <Glyph size={23} strokeWidth={1.3} />
                <small>{index + 1}</small>
              </span>
              <span className="trail-node-label" dir="auto">
                {label(step)}
              </span>
              <span className="trail-node-kind">{step.kind}</span>
            </button>
          );
        })}
      </div>
      <div className="trail-detail" aria-live="polite">
        {source ? (
          <Artwork entry={source} />
        ) : (
          <span className="trail-detail-glyph">
            <Icon size={40} strokeWidth={1} />
          </span>
        )}
        <div>
          <span className="eyebrow">
            STOP {currentIndex + 1} · {current.kind.toUpperCase()}
          </span>
          <h3 dir="auto">{label(current)}</h3>
          <p dir="auto">
            {current.reason || "A connection waiting for your words."}
          </p>
          {source ? (
            <button className="text-button" onClick={() => onEdit(source)}>
              Open it in the room
              <ArrowUpRight size={16} />
            </button>
          ) : (
            current.entryId && (
              <small>
                The original item was removed. This stop keeps its title.
              </small>
            )
          )}
        </div>
      </div>
      <div className="trail-controls">
        <button
          className="button secondary"
          disabled={currentIndex === 0}
          onClick={() => setCurrentId(details.steps[currentIndex - 1].id)}
        >
          <ArrowLeft size={16} />
          Back a step
        </button>
        <button
          className="button secondary"
          disabled={currentIndex === details.steps.length - 1}
          onClick={() => setCurrentId(details.steps[currentIndex + 1].id)}
        >
          Follow the thread
          <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}

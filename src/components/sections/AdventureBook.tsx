import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Compass,
  MapPin,
  Pencil,
  PlaneTakeoff,
  Plus,
  Sparkle,
} from "lucide-react";
import { useRoom } from "../../lib/room-context";
import { newAdventure, readableDate } from "../../lib/section-details";
import { Artwork } from "../Artwork";
import type { Entry } from "../../lib/model";
import type { SectionActions } from "./section-actions";

type Decorative = { id: string; mark: string; label: string; tone: string };
const defaultDecoratives: Decorative[] = [
  { id: "pressed-leaf", mark: "❧", label: "Pressed leaf", tone: "sage" },
  { id: "postcard", mark: "▧", label: "Postcard", tone: "paper" },
  { id: "ticket", mark: "✦", label: "Old ticket", tone: "rose" },
  { id: "map-pin", mark: "⌖", label: "Map pin", tone: "ochre" },
];
const decorativeSets: Record<string, Decorative[]> = {
  "Pressed garden": defaultDecoratives,
  "Postcard drawer": [
    { id: "stamp", mark: "▣", label: "Postage stamp", tone: "rose" },
    { id: "ticket", mark: "✦", label: "Old ticket", tone: "ochre" },
    { id: "postcard", mark: "▧", label: "Postcard", tone: "paper" },
  ],
  "Little field notes": [
    { id: "pressed-leaf", mark: "❧", label: "Pressed leaf", tone: "sage" },
    { id: "map-pin", mark: "⌖", label: "Map pin", tone: "ochre" },
    { id: "flower", mark: "✿", label: "Wildflower", tone: "rose" },
  ],
};
const decorativeKey = "control-room-adventure-decoratives";

export function AdventureBook({ onAdd, onEdit }: SectionActions) {
  const { entries } = useRoom();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("All pages");
  const [pageIndex, setPageIndex] = useState(0);
  const [decoratives, setDecoratives] =
    useState<Decorative[]>(defaultDecoratives);
  const [showDecoratives, setShowDecoratives] = useState(false);
  const [decorativeSet, setDecorativeSet] = useState("Pressed garden");
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const spreadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(decorativeKey) || "null");
      if (Array.isArray(saved) && saved.every((item) => item?.id && item?.mark))
        setDecoratives(saved);
    } catch {
      /* Keep the hand-curated defaults. */
    }
  }, []);
  const saveDecoratives = (next: Decorative[]) => {
    setDecoratives(next);
    localStorage.setItem(decorativeKey, JSON.stringify(next));
  };
  const chapterOf = (entry: Entry): "before" | "after" =>
    entry.details?.type === "adventure" && entry.details.chapter === "before"
      ? "before"
      : "after";
  const pages = entries
    .filter(
      (entry) =>
        entry.kind === "adventure" &&
        (filter === "All pages" || entry.status === filter),
    )
    .sort((a, b) => {
      const era = chapterOf(a) === "before" ? 0 : 1;
      const other = chapterOf(b) === "before" ? 0 : 1;
      return (
        era - other ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id)
      );
    });
  // The book opens in two parts around the move: pages marked "Before the
  // move" flip first, then this divider, then everything from the new life.
  type SpreadSlot =
    { divider: true } | { divider: false; entry: Entry; page: number };
  const spread: SpreadSlot[] = [];
  let dividerPlaced = false;
  pages.forEach((entry, pageNumber) => {
    if (
      filter === "All pages" &&
      !dividerPlaced &&
      chapterOf(entry) === "after"
    ) {
      spread.push({ divider: true });
      dividerPlaced = true;
    }
    spread.push({ divider: false, entry, page: pageNumber + 1 });
  });
  if (filter === "All pages" && !dividerPlaced) spread.push({ divider: true });
  const go = (direction: -1 | 1) =>
    setPageIndex((current) =>
      Math.max(
        0,
        Math.min(Math.max(0, spread.length - 1), current + direction),
      ),
    );
  const index = Math.min(pageIndex, Math.max(0, spread.length - 1));
  const slot = spread[index];
  const page = slot && !slot.divider ? slot.entry : undefined;
  const details =
    page?.details?.type === "adventure" ? page.details : newAdventure();
  return (
    <div className="adventure-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">NOOSHIN’S BOOK</span>
          <h1>
            My <em>Adventure Book.</em>
          </h1>
          <p>So much is waiting for you. Start filling these pages.</p>
        </div>
        <button className="button primary" onClick={() => onAdd("adventure")}>
          <Plus size={17} />
          Add a page
        </button>
      </div>
      {!open ? (
        <div className="adventure-cover-scene">
          <button
            className="adventure-cover"
            onClick={() => setOpen(true)}
            aria-label="Open My Adventure Book"
          >
            <span className="book-binding" aria-hidden="true" />
            <span className="cover-small">MY</span>
            <span className="patchwork-title" aria-hidden="true">
              {"ADVENTURE".split("").map((letter, i) => (
                <span key={i}>{letter}</span>
              ))}
            </span>
            <span className="cover-book-word">BOOK</span>
            <span className="cover-compass">
              <Compass size={70} strokeWidth={1} />
            </span>
            <span className="adventure-cover-note handwritten">
              my favourite adventures have you in them.
            </span>
            <span className="cover-open-hint">
              Open the book
              <ArrowRight size={18} />
            </span>
          </button>
          <div className="balloon-cluster" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <p className="handwritten cover-scene-caption">
            anywhere you want to go.
          </p>
        </div>
      ) : (
        <>
          <div className="adventure-toolbar">
            <button className="text-button" onClick={() => setOpen(false)}>
              <ArrowLeft size={16} />
              Book cover
            </button>
            <div className="filter-chips">
              {["All pages", "Someday", "A memory"].map((tab) => (
                <button
                  key={tab}
                  aria-pressed={filter === tab}
                  className={filter === tab ? "active" : ""}
                  onClick={() => {
                    setFilter(tab);
                    setPageIndex(0);
                  }}
                >
                  {tab === "A memory" ? "Your memories" : tab}
                </button>
              ))}
            </div>
            <button
              className="text-button adventure-decoratives-toggle"
              aria-expanded={showDecoratives}
              onClick={() => setShowDecoratives((open) => !open)}
            >
              <Sparkle size={16} />
              Decoratives
            </button>
          </div>
          {showDecoratives && (
            <div
              className="adventure-decoratives"
              aria-label="Adventure book decoratives"
            >
              <div>
                <strong>Make the pages feel like yours.</strong>
                <small>Choose a little detail, or add your own mark.</small>
              </div>
              <div
                className="adventure-decorative-sets"
                role="group"
                aria-label="Decorative sets"
              >
                {Object.keys(decorativeSets).map((set) => (
                  <button
                    key={set}
                    className={decorativeSet === set ? "active" : ""}
                    aria-pressed={decorativeSet === set}
                    onClick={() => {
                      setDecorativeSet(set);
                      saveDecoratives(decorativeSets[set]);
                    }}
                  >
                    {set}
                  </button>
                ))}
              </div>
              <div className="adventure-decorative-list">
                {decoratives.map((item) => (
                  <button
                    key={item.id}
                    className={`adventure-decorative adventure-decorative-${item.tone}`}
                    onClick={() => {
                      const next = decoratives.filter(
                        (entry) => entry.id !== item.id,
                      );
                      saveDecoratives(next);
                    }}
                    title={`Remove ${item.label}`}
                  >
                    <span>{item.mark}</span>
                    <small>{item.label}</small>
                  </button>
                ))}
                <button
                  className="adventure-decorative adventure-decorative-add"
                  onClick={() => {
                    const mark = window
                      .prompt("Add a small decorative mark", "✿")
                      ?.trim();
                    if (!mark) return;
                    const label =
                      window
                        .prompt("Name this decorative", "A little flower")
                        ?.trim() || "Custom mark";
                    saveDecoratives([
                      ...decoratives,
                      {
                        id: `custom-${Date.now()}`,
                        mark: mark.slice(0, 3),
                        label: label.slice(0, 40),
                        tone: "custom",
                      },
                    ]);
                  }}
                  title="Add a decorative"
                >
                  <span>＋</span>
                  <small>Add one</small>
                </button>
              </div>
            </div>
          )}
          <div
            className="adventure-spread"
            ref={spreadRef}
            onTouchStart={(event) => {
              setTouchStart(event.touches[0].clientX);
              setTouchDelta(0);
            }}
            onTouchMove={(event) => {
              if (touchStart !== null)
                setTouchDelta(event.touches[0].clientX - touchStart);
            }}
            onTouchEnd={() => {
              if (Math.abs(touchDelta) > 45) go(touchDelta < 0 ? 1 : -1);
              setTouchStart(null);
              setTouchDelta(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") go(-1);
              if (event.key === "ArrowRight") go(1);
            }}
            tabIndex={0}
            aria-label="Adventure book pages. Swipe or use arrow keys to turn pages."
          >
            {decoratives.map((item, index) => (
              <span
                key={item.id}
                className={`adventure-floating-decor adventure-floating-${index % 4} adventure-decorative-${item.tone}`}
                aria-hidden="true"
              >
                {item.mark}
              </span>
            ))}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={slot?.divider ? "divider" : page?.id || "empty"}
                className="spread-content"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                {slot?.divider ? (
                  <div className="adventure-divider">
                    <span className="adventure-divider-icon" aria-hidden="true">
                      <PlaneTakeoff size={56} strokeWidth={1} />
                    </span>
                    <span className="eyebrow">THE MOVE</span>
                    <h2>Everything before this page was there.</h2>
                    <p className="handwritten">everything after it is here.</p>
                    <span
                      className="adventure-divider-rule"
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  <>
                    <div className="scrapbook-left">
                      <div className="scrapbook-photo">
                        <span className="photo-tape" aria-hidden="true" />
                        {page?.image_path || page?.image_url ? (
                          <Artwork entry={page} />
                        ) : (
                          <div className="scrapbook-photo-empty">
                            <Camera size={42} strokeWidth={1} />
                            <span className="handwritten">
                              a picture belongs here
                            </span>
                          </div>
                        )}
                        <span className="photo-caption handwritten" dir="auto">
                          {details.place || "Somewhere in your story"}
                        </span>
                      </div>
                      <span className="scrapbook-stamp">
                        <Compass size={24} />
                        <span>
                          YOUR OWN
                          <br />
                          LITTLE WORLD
                        </span>
                      </span>
                    </div>
                    <div className="scrapbook-right">
                      <span className="eyebrow">
                        {page
                          ? page.status === "A memory"
                            ? "REMEMBER THIS?"
                            : "THINGS I WANT TO DO"
                          : "THE FIRST BLANK PAGE"}
                      </span>
                      {page && (
                        <span className="scrapbook-era">
                          {chapterOf(page) === "before"
                            ? "From before the move"
                            : "From after the move"}
                        </span>
                      )}
                      <h2 dir="auto">
                        {page?.title || "There’s a whole story ahead of you."}
                      </h2>
                      {details.place && (
                        <span className="scrapbook-location">
                          <MapPin size={15} />
                          <span dir="auto">{details.place}</span>
                        </span>
                      )}
                      {details.date && (
                        <time dateTime={details.date}>
                          {readableDate(details.date)}
                        </time>
                      )}
                      <p className="scrapbook-story" dir="auto">
                        {page?.note ||
                          "A road trip. A rainy afternoon. Trying something new together. You get to decide what counts as an adventure."}
                      </p>
                      <button
                        className="text-button"
                        onClick={() =>
                          page ? onEdit(page) : onAdd("adventure")
                        }
                      >
                        {page ? <Pencil size={15} /> : <Plus size={15} />}
                        {page ? "Keep writing this page" : "Start this page"}
                      </button>
                      <span className="page-number">
                        {slot
                          ? `${String(slot.page).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`
                          : "01"}
                      </span>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="adventure-pagination">
            <button
              className="button secondary"
              disabled={index === 0 || !pages.length}
              onClick={() => go(-1)}
            >
              <ArrowLeft size={16} />
              Previous page
            </button>
            <span aria-live="polite">
              {spread.length
                ? slot && !slot.divider
                  ? `Page ${slot.page} of ${pages.length}`
                  : "The move"
                : "Your story starts here"}
            </span>
            <button
              className="button secondary"
              disabled={index >= spread.length - 1}
              onClick={() => go(1)}
            >
              Next page
              <ArrowRight size={16} />
            </button>
          </div>
          {spread.length > 0 && (
            <div className="adventure-index">
              {spread.map((item, slotIndex) =>
                item.divider ? (
                  <span key="divider" className="adventure-index-divider">
                    <PlaneTakeoff size={13} aria-hidden="true" />
                    The move
                  </span>
                ) : (
                  <button
                    key={item.entry.id}
                    aria-current={index === slotIndex ? "page" : undefined}
                    onClick={() => setPageIndex(slotIndex)}
                  >
                    <span>{String(item.page).padStart(2, "0")}</span>
                    <span dir="auto">{item.entry.title}</span>
                    <small>{item.entry.status}</small>
                  </button>
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

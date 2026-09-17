import { useState } from "react";
import {
  CalendarDays,
  Check,
  Clapperboard,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Popcorn,
  Shuffle,
  Sofa,
} from "lucide-react";
import { useRoom } from "../../lib/room-context";
import { newMovie, readableDate, placeLabels } from "../../lib/section-details";
import type { Entry } from "../../lib/model";
import type { SectionActions } from "./section-actions";
import { Artwork } from "../Artwork";
import { ImdbImportButton } from "../ImdbImportButton";
import { ImdbConnectionButton } from "../ImdbConnection";
import { routeHref } from "../../lib/routes";

export function MovieNight({ onAdd, onEdit }: SectionActions) {
  const { entries, save } = useRoom();
  const [filter, setFilter] = useState("Coming up");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const nights = entries.filter(
    (entry) =>
      entry.kind === "movie_night" &&
      (filter === "Watched"
        ? entry.status === "Watched"
        : entry.status !== "Watched"),
  );
  async function change(entry: Entry, choose: boolean) {
    const details =
      entry.details?.type === "movie_night" ? entry.details : newMovie();
    if (choose && !details.films.length) return;
    setBusy(entry.id);
    setError("");
    try {
      const choice = choose
        ? details.films[Math.floor(Math.random() * details.films.length)].id
        : details.chosenId;
      await save(
        {
          ...entry,
          status: choose ? entry.status : "Watched",
          details: { ...details, chosenId: choice },
        },
        {},
        entry,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update this evening.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="movie-night-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">FILMS & SERIES · ALONE OR TOGETHER</span>
          <h1>
            What’s on <em>tonight?</em>
          </h1>
          <p>
            A film to yourself, or another episode with me. Pick what you want
            to watch and where you’ll be.
          </p>
        </div>
        <button className="button primary" onClick={() => onAdd("movie_night")}>
          <Plus size={17} />
          Plan an evening
        </button>
      </div>
      <div className="movie-marquee" aria-hidden="true">
        <span>YOUR FILMS. YOUR FAVOURITE SERIES.</span>
        <Sofa size={50} strokeWidth={1} />
        <span>AT HOME · AT THE CINEMA</span>
      </div>
      <div className="movie-imdb-import">
        <p>
          Choose from your <a href={routeHref("films")}>Films & series</a>, or
          bring in your IMDb Watchlist.
        </p>
        <div className="imdb-connection-actions">
          <ImdbConnectionButton className="text-button" />
          <ImdbImportButton className="text-button" />
        </div>
      </div>
      <div className="collection-tabs">
        {["Coming up", "Watched"].map((tab) => (
          <button
            key={tab}
            aria-pressed={filter === tab}
            className={filter === tab ? "active" : ""}
            onClick={() => setFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!nights.length ? (
        <div className="empty-collection movie-empty">
          <Clapperboard size={32} strokeWidth={1.2} />
          <h2>
            {filter === "Watched"
              ? "Nothing watched here yet."
              : "Anything you’ve been wanting to watch?"}
          </h2>
          <p>
            {filter === "Watched"
              ? "Finished evenings are saved here, whether you watched alone or together."
              : "Add a film or series. You can pick now or choose from your shortlist later."}
          </p>
          <button className="text-button" onClick={() => onAdd("movie_night")}>
            Plan an evening
            <Plus size={16} />
          </button>
        </div>
      ) : (
        <div className="movie-night-list">
          {nights.map((night) => {
            const details =
              night.details?.type === "movie_night"
                ? night.details
                : newMovie();
            const choice = details.films.find(
              (film) => film.id === details.chosenId,
            );
            const solo = details.audience === "solo";
            return (
              <article key={night.id} className="screening-ticket">
                <div className="screening-perforation" aria-hidden="true" />
                <div className="screening-main">
                  <div className="screening-top">
                    <span className="eyebrow">
                      {night.status === "Watched"
                        ? solo
                          ? "WATCHED ON YOUR OWN"
                          : "WATCHED WITH SAMAN"
                        : solo
                          ? "JUST YOU"
                          : "WITH SAMAN"}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${night.title}`}
                      onClick={() => onEdit(night)}
                    >
                      <Pencil size={17} />
                    </button>
                  </div>
                  <div className="screening-heading">
                    {night.image_path || night.image_url ? (
                      <Artwork entry={night} />
                    ) : (
                      <Clapperboard
                        className="screening-glyph"
                        size={34}
                        strokeWidth={1.1}
                      />
                    )}
                    <div>
                      <h2 dir="auto">{night.title}</h2>
                      <span className="screening-state">{night.status}</span>
                    </div>
                  </div>
                  <div className="screening-details">
                    <span>
                      <MapPin size={15} />
                      {placeLabels[details.place]}
                    </span>
                    <span>
                      <CalendarDays size={15} />
                      {readableDate(details.date)}
                    </span>
                    {details.time && (
                      <span>
                        <Clock3 size={15} />
                        {details.time}
                      </span>
                    )}
                    {details.snacks && (
                      <span>
                        <Popcorn size={16} />
                        <span dir="auto">{details.snacks}</span>
                      </span>
                    )}
                  </div>
                  {night.note && (
                    <p className="screening-note" dir="auto">
                      {night.note}
                    </p>
                  )}
                  <div className="screening-picks">
                    <span className="eyebrow">THE SHORTLIST</span>
                    {details.films.length ? (
                      <ul>
                        {details.films.map((film) => (
                          <li
                            key={film.id}
                            className={
                              film.id === details.chosenId ? "picked" : ""
                            }
                          >
                            <span dir="auto">{film.title}</span>
                            {film.id === details.chosenId && (
                              <span>
                                <Check size={14} />
                                Tonight’s pick
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <button
                        className="text-button"
                        onClick={() => onEdit(night)}
                      >
                        Add a film or series
                        <Plus size={15} />
                      </button>
                    )}
                  </div>
                  <div className="screening-actions">
                    {night.status !== "Watched" && (
                      <>
                        <button
                          className="button secondary"
                          disabled={busy !== null || !details.films.length}
                          onClick={() => void change(night, true)}
                        >
                          <Shuffle size={16} />
                          {busy === night.id ? "Saving…" : "Choose for me"}
                        </button>
                        <button
                          className="text-button"
                          disabled={busy !== null || !choice}
                          onClick={() => void change(night, false)}
                        >
                          <Check size={16} />
                          {solo ? "I watched it" : "Watched it together"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <aside className="ticket-stub">
                  <span className="stub-seats">
                    {solo ? "01" : "02"}
                    <span>{solo ? "SEAT" : "SEATS"}</span>
                  </span>
                  <Sofa size={33} strokeWidth={1} />
                  <span className="stub-caption">
                    {choice
                      ? choice.title
                      : solo
                        ? "An evening to yourself."
                        : "Save me the seat beside you."}
                  </span>
                  <div className="ticket-barcode" aria-hidden="true" />
                </aside>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

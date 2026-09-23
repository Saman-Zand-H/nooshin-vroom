import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { Draft } from "../../lib/model";
import { useRoom } from "../../lib/room-context";
import {
  flows,
  letterings,
  newAdventure,
  newBody,
  newCycle,
  newLove,
  newLyric,
  newMovie,
  papers,
  places,
  placeLabels,
  slipSizes,
  type FilmPick,
  type LoveLine,
  type SectionDetails,
} from "../../lib/section-details";

export function SectionFields({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (details: SectionDetails) => void;
}) {
  const { entries } = useRoom();
  if (draft.kind === "adventure") {
    const details =
      draft.details?.type === "adventure" ? draft.details : newAdventure();
    return (
      <div className="form-grid section-fields">
        <label>
          Where?
          <input
            value={details.place}
            maxLength={180}
            placeholder="A faraway place, or the café down the street"
            onChange={(event) =>
              onChange({ ...details, place: event.target.value })
            }
          />
        </label>
        <label>
          {draft.status === "A memory"
            ? "When was it?"
            : "A date, if you have one"}
          <input
            type="date"
            value={details.date}
            onChange={(event) =>
              onChange({ ...details, date: event.target.value })
            }
          />
        </label>
        <fieldset className="chapter-picker">
          <legend>Which part of the book?</legend>
          <div className="chapter-options" role="group">
            {(["before", "after"] as const).map((chapter) => (
              <button
                key={chapter}
                type="button"
                aria-pressed={(details.chapter ?? "after") === chapter}
                className={
                  (details.chapter ?? "after") === chapter ? "active" : ""
                }
                onClick={() => onChange({ ...details, chapter })}
              >
                {chapter === "before" ? "Before the move" : "After the move"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    );
  }
  if (draft.kind === "lyric") {
    const details =
      draft.details?.type === "lyric" ? draft.details : newLyric();
    return (
      <fieldset className="lyric-style-fields">
        <legend>Make it look like your wall</legend>
        <div className="paper-swatches" aria-label="Paper colour">
          {papers.map((paper) => (
            <button
              key={paper}
              type="button"
              className={`paper-swatch paper-${paper}`}
              aria-label={`${paper} paper`}
              aria-pressed={details.paper === paper}
              onClick={() => onChange({ ...details, paper })}
            >
              <span>{paper}</span>
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>
            Lettering
            <select
              value={details.lettering}
              onChange={(event) =>
                onChange({
                  ...details,
                  lettering: event.target.value as typeof details.lettering,
                })
              }
            >
              {letterings.map((type) => (
                <option key={type} value={type}>
                  {type[0].toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Size
            <select
              value={details.size}
              onChange={(event) =>
                onChange({
                  ...details,
                  size: event.target.value as typeof details.size,
                })
              }
            >
              {slipSizes.map((size) => (
                <option key={size} value={size}>
                  {size[0].toUpperCase() + size.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className={`lyric-preview paper-${details.paper} lettering-${details.lettering} slip-${details.size}`}
        >
          <p dir="auto">{draft.note || "Your words will go here."}</p>
          <small dir="auto">
            {draft.title || "Song title"}
            {draft.creator && ` — ${draft.creator}`}
          </small>
        </div>
      </fieldset>
    );
  }
  if (draft.kind === "movie_night") {
    const details =
      draft.details?.type === "movie_night" ? draft.details : newMovie();
    const films = entries.filter((entry) => entry.kind === "film");
    const changeFilms = (next: FilmPick[]) =>
      onChange({
        ...details,
        films: next,
        chosenId: next.some((film) => film.id === details.chosenId)
          ? details.chosenId
          : null,
      });
    return (
      <div className="section-fields">
        <label className="watching-company">
          Watching
          <select
            value={details.audience ?? "together"}
            onChange={(event) =>
              onChange({
                ...details,
                audience: event.target.value as "solo" | "together",
              })
            }
          >
            <option value="solo">On my own</option>
            <option value="together">With Saman</option>
          </select>
        </label>
        <div className="form-grid">
          <label>
            Where?
            <select
              value={details.place}
              onChange={(event) =>
                onChange({
                  ...details,
                  place: event.target.value as typeof details.place,
                })
              }
            >
              {places.map((place) => (
                <option key={place} value={place}>
                  {placeLabels[place]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              value={details.date}
              onChange={(event) =>
                onChange({ ...details, date: event.target.value })
              }
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Time
            <input
              type="time"
              value={details.time}
              onChange={(event) =>
                onChange({ ...details, time: event.target.value })
              }
            />
          </label>
          <label>
            Snacks & little extras
            <input
              maxLength={500}
              value={details.snacks}
              placeholder="Popcorn, something sweet, your favourite blanket"
              onChange={(event) =>
                onChange({ ...details, snacks: event.target.value })
              }
            />
          </label>
        </div>
        <fieldset className="pick-list">
          <legend>
            Films & series <span className="optional">up to 8 choices</span>
          </legend>
          {details.films.map((film, index) => (
            <div className="pick-row" key={film.id}>
              <label className="sr-only" htmlFor={`film-${film.id}`}>
                Film or series {index + 1}
              </label>
              <input
                id={`film-${film.id}`}
                value={film.title}
                placeholder="A title to consider"
                required
                maxLength={240}
                onChange={(event) =>
                  changeFilms(
                    details.films.map((pick) =>
                      pick.id === film.id
                        ? { ...pick, title: event.target.value, entryId: null }
                        : pick,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove title ${index + 1}`}
                onClick={() =>
                  changeFilms(
                    details.films.filter((pick) => pick.id !== film.id),
                  )
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {details.films.length < 8 && (
            <div className="pick-add">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  changeFilms([
                    ...details.films,
                    { id: crypto.randomUUID(), title: "", entryId: null },
                  ])
                }
              >
                <Plus size={16} />
                Add a film or series
              </button>
              {films.length > 0 && (
                <label className="saved-film-picker">
                  <span className="sr-only">Add from Films & series</span>
                  <select
                    value=""
                    onChange={(event) => {
                      const film = films.find(
                        (item) => item.id === event.target.value,
                      );
                      if (film)
                        changeFilms([
                          ...details.films,
                          {
                            id: crypto.randomUUID(),
                            title: film.title,
                            entryId: film.id,
                          },
                        ]);
                    }}
                  >
                    <option value="">From Films & series…</option>
                    {films
                      .filter(
                        (film) =>
                          !details.films.some(
                            (pick) => pick.entryId === film.id,
                          ),
                      )
                      .map((film) => (
                        <option key={film.id} value={film.id}>
                          {film.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {details.films.length > 0 && (
            <label>
              Tonight’s choice
              <select
                value={details.chosenId || ""}
                onChange={(event) =>
                  onChange({ ...details, chosenId: event.target.value || null })
                }
              >
                <option value="">Decide later</option>
                {details.films.map((film, index) => (
                  <option value={film.id} key={film.id}>
                    {film.title || `Title ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
      </div>
    );
  }
  if (draft.kind === "cycle") {
    const details =
      draft.details?.type === "cycle" ? draft.details : newCycle();
    return (
      <fieldset className="cycle-fields">
        <legend>
          These days <span className="optional">the room counts the rest</span>
        </legend>
        <div className="form-grid">
          <label>
            First day
            <input
              type="date"
              required
              value={details.started}
              onChange={(event) =>
                onChange({ ...details, started: event.target.value })
              }
            />
          </label>
          <label>
            Last day
            <input
              type="date"
              value={details.ended}
              onChange={(event) =>
                onChange({ ...details, ended: event.target.value })
              }
            />
          </label>
        </div>
        <fieldset className="chapter-picker flow-picker">
          <legend>How heavy was it?</legend>
          <div className="chapter-options" role="group">
            {flows.map((flow) => (
              <button
                key={flow}
                type="button"
                aria-pressed={details.flow === flow}
                className={details.flow === flow ? "active" : ""}
                onClick={() =>
                  onChange({
                    ...details,
                    flow: details.flow === flow ? "" : flow,
                  })
                }
              >
                {flow[0].toUpperCase() + flow.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
      </fieldset>
    );
  }
  if (draft.kind === "body") {
    const details = draft.details?.type === "body" ? draft.details : newBody();
    return (
      <fieldset className="cycle-fields">
        <legend>
          On the scale <span className="optional">one number, kept simply</span>
        </legend>
        <div className="form-grid">
          <label>
            Weight (kg)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="25"
              max="250"
              required
              value={details.weight}
              placeholder="67.7"
              onChange={(event) =>
                onChange({ ...details, weight: event.target.value })
              }
            />
          </label>
          <label>
            Day
            <input
              type="date"
              value={details.measured_on}
              onChange={(event) =>
                onChange({ ...details, measured_on: event.target.value })
              }
            />
          </label>
        </div>
      </fieldset>
    );
  }
  if (draft.kind === "love") {
    const details = draft.details?.type === "love" ? draft.details : newLove();
    const changeLines = (lines: LoveLine[]) => onChange({ ...details, lines });
    const move = (index: number, direction: number) => {
      const lines = [...details.lines];
      [lines[index], lines[index + direction]] = [
        lines[index + direction],
        lines[index],
      ];
      changeLines(lines);
    };
    return (
      <fieldset className="love-fields">
        <legend>
          The little lines <span className="optional">up to 60</span>
        </legend>
        <p className="helper">
          Memories, words, tiny things — whatever this love collects over time.
          Either of you can add them.
        </p>
        <label className="love-why">
          Why it’s yours
          <textarea
            rows={2}
            maxLength={700}
            value={details.why}
            dir="auto"
            placeholder="Where this love comes from…"
            onChange={(event) =>
              onChange({ ...details, why: event.target.value })
            }
          />
        </label>
        {details.lines.map((line, index) => (
          <div className="love-line-editor" key={line.id}>
            <div className="step-editor-top">
              <span>LINE {String(index + 1).padStart(2, "0")}</span>
              <div>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === 0}
                  aria-label={`Move line ${index + 1} earlier`}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === details.lines.length - 1}
                  aria-label={`Move line ${index + 1} later`}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove line ${index + 1}`}
                  onClick={() =>
                    changeLines(
                      details.lines.filter((item) => item.id !== line.id),
                    )
                  }
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <label>
              A memory, a word, a tiny thing
              <textarea
                rows={2}
                required
                maxLength={400}
                dir="auto"
                value={line.text}
                placeholder="Something small worth keeping…"
                onChange={(event) =>
                  changeLines(
                    details.lines.map((item) =>
                      item.id === line.id
                        ? { ...item, text: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              A date, if it has one
              <input
                type="date"
                value={line.when}
                onChange={(event) =>
                  changeLines(
                    details.lines.map((item) =>
                      item.id === line.id
                        ? { ...item, when: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          disabled={details.lines.length >= 60}
          onClick={() =>
            changeLines([
              ...details.lines,
              { id: crypto.randomUUID(), text: "", when: "" },
            ])
          }
        >
          <Plus size={16} />
          Add a little line
        </button>
      </fieldset>
    );
  }
}

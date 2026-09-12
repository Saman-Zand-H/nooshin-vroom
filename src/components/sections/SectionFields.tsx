import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { Draft } from "../../lib/model";
import { useRoom } from "../../lib/room-context";
import {
  letterings,
  newAdventure,
  newLyric,
  newMovie,
  newTrail,
  papers,
  places,
  placeLabels,
  slipSizes,
  stepKinds,
  type FilmPick,
  type SectionDetails,
  type TrailStep,
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
  if (draft.kind !== "rabbit_hole") return null;
  const details =
    draft.details?.type === "rabbit_hole" ? draft.details : newTrail();
  const sourceEntries = entries.filter((entry) =>
    ["book", "film", "game", "music", "note", "lyric"].includes(entry.kind),
  );
  const changeSteps = (steps: TrailStep[]) => onChange({ ...details, steps });
  const changeStep = (id: string, patch: Partial<TrailStep>) =>
    changeSteps(
      details.steps.map((step) =>
        step.id === id ? { ...step, ...patch } : step,
      ),
    );
  const move = (index: number, direction: number) => {
    const steps = [...details.steps];
    [steps[index], steps[index + direction]] = [
      steps[index + direction],
      steps[index],
    ];
    changeSteps(steps);
  };
  return (
    <fieldset className="trail-fields">
      <legend>
        Follow the connections <span className="optional">2–12 stops</span>
      </legend>
      <p className="helper">
        Start with a song, a book, a character. Explain what takes you to the
        next one.
      </p>
      {details.steps.map((step, index) => (
        <div className="trail-editor-step" key={step.id}>
          <div className="step-editor-top">
            <span>STOP {String(index + 1).padStart(2, "0")}</span>
            <div>
              <button
                type="button"
                className="icon-button"
                disabled={index === 0}
                aria-label={`Move stop ${index + 1} earlier`}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={index === details.steps.length - 1}
                aria-label={`Move stop ${index + 1} later`}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove stop ${index + 1}`}
                onClick={() =>
                  changeSteps(
                    details.steps.filter((item) => item.id !== step.id),
                  )
                }
              >
                <X size={16} />
              </button>
            </div>
          </div>
          {sourceEntries.length > 0 && (
            <label>
              Something already in the room
              <select
                value={step.entryId || ""}
                onChange={(event) => {
                  const entry = sourceEntries.find(
                    (item) => item.id === event.target.value,
                  );
                  changeStep(
                    step.id,
                    entry
                      ? {
                          entryId: entry.id,
                          title: entry.title,
                          kind: stepKinds.includes(
                            entry.kind as TrailStep["kind"],
                          )
                            ? (entry.kind as TrailStep["kind"])
                            : "quote",
                        }
                      : { entryId: null },
                  );
                }}
              >
                <option value="">Write your own stop</option>
                {sourceEntries.map((entry) => (
                  <option value={entry.id} key={entry.id}>
                    {entry.title} · {entry.kind}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="form-grid">
            <label>
              Stop {index + 1} title
              <input
                value={step.title}
                required
                maxLength={240}
                dir="auto"
                placeholder="A thing that leads somewhere"
                onChange={(event) =>
                  changeStep(step.id, {
                    title: event.target.value,
                    entryId: null,
                  })
                }
              />
            </label>
            <label>
              Kind
              <select
                value={step.kind}
                onChange={(event) =>
                  changeStep(step.id, {
                    kind: event.target.value as TrailStep["kind"],
                  })
                }
              >
                {stepKinds.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {index === 0
              ? "What starts the trail?"
              : "Why does this follow the previous stop?"}
            <textarea
              rows={2}
              maxLength={700}
              value={step.reason}
              dir="auto"
              onChange={(event) =>
                changeStep(step.id, { reason: event.target.value })
              }
              placeholder="The connection only you would make…"
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        disabled={details.steps.length >= 12}
        onClick={() =>
          changeSteps([
            ...details.steps,
            {
              id: crypto.randomUUID(),
              title: "",
              kind: "idea",
              reason: "",
              entryId: null,
            },
          ])
        }
      >
        <Plus size={16} />
        Add a stop
      </button>
    </fieldset>
  );
}

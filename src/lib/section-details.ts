export const places = [
  "My place",
  "Her place",
  "Cinema",
  "Somewhere else",
] as const;
export const placeLabels: Record<(typeof places)[number], string> = {
  "My place": "Saman’s place",
  "Her place": "Nooshin’s place",
  Cinema: "Cinema",
  "Somewhere else": "Somewhere else",
};
export const papers = ["parchment", "rose", "lavender", "midnight"] as const;
export const letterings = ["handwritten", "serif", "typewriter"] as const;
export const slipSizes = ["small", "medium", "large"] as const;

export interface FilmPick {
  id: string;
  title: string;
  entryId: string | null;
}
export interface MovieDetails {
  type: "movie_night";
  audience?: "solo" | "together";
  place: (typeof places)[number];
  date: string;
  time: string;
  snacks: string;
  films: FilmPick[];
  chosenId: string | null;
}
export interface AdventureDetails {
  type: "adventure";
  place: string;
  date: string;
  chapter?: "before" | "after";
}
export interface LyricDetails {
  type: "lyric";
  paper: (typeof papers)[number];
  lettering: (typeof letterings)[number];
  size: (typeof slipSizes)[number];
  position: number;
}
export interface LoveLine {
  id: string;
  text: string;
  when: string;
}
export interface LoveDetails {
  type: "love";
  why: string;
  lines: LoveLine[];
}
export const flows = ["light", "medium", "heavy"] as const;
export interface CycleDetails {
  type: "cycle";
  started: string;
  ended: string;
  flow: (typeof flows)[number] | "";
}
export interface BodyDetails {
  type: "body";
  weight: string;
  measured_on: string;
}
export type SectionDetails =
  | MovieDetails
  | AdventureDetails
  | LyricDetails
  | LoveDetails
  | CycleDetails
  | BodyDetails;
export type SectionKind = SectionDetails["type"];
export function isSectionKind(kind: string): kind is SectionKind {
  return [
    "movie_night",
    "adventure",
    "lyric",
    "love",
    "cycle",
    "body",
  ].includes(kind);
}
export const newMovie = (): MovieDetails => ({
  type: "movie_night",
  audience: "solo",
  place: "Her place",
  date: "",
  time: "",
  snacks: "",
  films: [],
  chosenId: null,
});
export const newAdventure = (): AdventureDetails => ({
  type: "adventure",
  place: "",
  date: "",
  chapter: "after",
});
export const newLyric = (): LyricDetails => ({
  type: "lyric",
  paper: "parchment",
  lettering: "handwritten",
  size: "medium",
  position: Date.now(),
});
export const newLove = (): LoveDetails => ({
  type: "love",
  why: "",
  lines: [],
});
export const newCycle = (): CycleDetails => ({
  type: "cycle",
  started: new Date().toLocaleDateString("en-CA"),
  ended: "",
  flow: "",
});
export const newBody = (): BodyDetails => ({
  type: "body",
  weight: "",
  measured_on: new Date().toLocaleDateString("en-CA"),
});
export function newDetails(kind: string): SectionDetails | null {
  return kind === "movie_night"
    ? newMovie()
    : kind === "adventure"
      ? newAdventure()
      : kind === "lyric"
        ? newLyric()
        : kind === "love"
          ? newLove()
          : kind === "cycle"
            ? newCycle()
            : kind === "body"
              ? newBody()
              : null;
}
function text(value: unknown, limit: number, required = false): string {
  if (
    typeof value !== "string" ||
    value.length > limit ||
    (required && !value.trim())
  )
    throw new Error(
      "Check the section details: a field is missing or too long.",
    );
  return value.trim();
}
function option<T extends string>(value: unknown, options: readonly T[]): T {
  if (!options.includes(value as T))
    throw new Error("Choose one of the available options.");
  return value as T;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The section details could not be read.");
  return value as Record<string, unknown>;
}
function identifier(value: unknown): string {
  const id = text(value, 36, true);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
    throw new Error("An item reference is invalid.");
  return id;
}
function date(value: unknown): string {
  const result = text(value, 10);
  if (
    result &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(result) ||
      Number.isNaN(Date.parse(`${result}T12:00:00Z`)) ||
      new Date(`${result}T12:00:00Z`).toISOString().slice(0, 10) !== result)
  )
    throw new Error("Choose a valid date.");
  return result;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error(`Keep this collection to ${max} items.`);
  return value;
}
export function validateDetails(
  kind: string,
  value: unknown,
): SectionDetails | null {
  if (!isSectionKind(kind)) return null;
  const data = object(value);
  if (data.type !== kind)
    throw new Error("The section details do not match this item.");
  if (kind === "movie_night") {
    const films = list(data.films, 8).map((item) => {
      const pick = object(item);
      return {
        id: identifier(pick.id),
        title: text(pick.title, 240, true),
        entryId: pick.entryId === null ? null : identifier(pick.entryId),
      };
    });
    if (new Set(films.map((film) => film.id)).size !== films.length)
      throw new Error("Each shortlist pick needs its own identity.");
    const chosenId = data.chosenId === null ? null : identifier(data.chosenId);
    if (chosenId && !films.some((film) => film.id === chosenId))
      throw new Error("Choose a film or series from this shortlist.");
    const time = text(data.time, 5);
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      throw new Error("Choose a valid time.");
    return {
      type: kind,
      // Existing plans predate the solo option and were made for two.
      audience:
        data.audience === undefined
          ? "together"
          : option(data.audience, ["solo", "together"] as const),
      place: option(data.place, places),
      date: date(data.date),
      time,
      snacks: text(data.snacks, 500),
      films,
      chosenId,
    };
  }
  if (kind === "adventure")
    return {
      type: kind,
      date: date(data.date),
      place: text(data.place, 180),
      // Existing pages predate the chapter field and belong to the new life.
      chapter:
        data.chapter === undefined
          ? "after"
          : option(data.chapter, ["before", "after"] as const),
    };
  if (kind === "love") {
    const lines = list(data.lines, 60).map((item) => {
      const line = object(item);
      return {
        id: identifier(line.id),
        text: text(line.text, 400, true),
        when: date(line.when),
      };
    });
    if (new Set(lines.map((line) => line.id)).size !== lines.length)
      throw new Error("Each little line needs its own identity.");
    return {
      type: kind,
      why: text(data.why, 700),
      lines,
    };
  }
  if (kind === "cycle") {
    const started = date(data.started);
    if (!started) throw new Error("Choose the day this period started.");
    const ended = date(data.ended);
    if (ended && ended < started)
      throw new Error("The last day cannot come before the first.");
    return {
      type: kind,
      started,
      ended,
      flow:
        data.flow === undefined || data.flow === ""
          ? ""
          : option(data.flow, flows),
    };
  }
  if (kind === "body") {
    const weight = text(data.weight, 6);
    if (!weight) throw new Error("Add the weight in kilograms.");
    if (!/^\d{2,3}(\.\d)?$/.test(weight) || +weight < 25 || +weight > 250)
      throw new Error("Give the weight in kilograms, like 67.7.");
    return {
      type: kind,
      weight,
      measured_on:
        date(data.measured_on) || new Date().toLocaleDateString("en-CA"),
    };
  }
  if (
    typeof data.position !== "number" ||
    !Number.isFinite(data.position) ||
    Math.abs(data.position) > 1e15
  )
    throw new Error("This wall position is invalid.");
  return {
    type: "lyric",
    paper: option(data.paper, papers),
    lettering: option(data.lettering, letterings),
    size: option(data.size, slipSizes),
    position: data.position,
  };
}

export function readableDate(value: string) {
  return value
    ? new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "No date chosen";
}

// A period names itself after its days, so the composer never asks for one.
export function periodTitle(details: CycleDetails): string {
  if (!details.started) return "";
  const short = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  });
  const start = short.format(new Date(`${details.started}T12:00:00`));
  return details.ended
    ? `${start} – ${short.format(new Date(`${details.ended}T12:00:00`))}`
    : start;
}

// A weigh-in is named by its number, with its day when there is one.
export function bodyTitle(details: BodyDetails): string {
  if (!details.weight) return "";
  return details.measured_on
    ? `${details.weight} kg · ${new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
      }).format(new Date(`${details.measured_on}T12:00:00`))}`
    : `${details.weight} kg`;
}

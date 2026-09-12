import { emptyDraft, validateDraft, type Draft, type Entry } from "./model";

export const IMDb = {
  maxBytes: 16 * 1024 * 1024,
  maxRows: 12_000,
  batchSize: 250,
  watchlistUrl: "https://www.imdb.com/watchlist/",
  helpUrl:
    "https://help.imdb.com/article/imdb/track-movies-tv/lists-faq/GNQMN47VZSE7KW38",
} as const;

export interface ImdbFilm {
  imdbId: string;
  title: string;
  creator: string;
  format: string;
  note: string;
}
export interface ImdbImportResult {
  added: number;
  skipped: number;
}
export function imdbIdFromLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !["imdb.com", "www.imdb.com", "m.imdb.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    return (
      url.pathname
        .match(/^\/title\/(tt\d{7,12})(?:\/|$)/i)?.[1]
        .toLowerCase() ?? null
    );
  } catch {
    return null;
  }
}
export function existingImdbIds(entries: Entry[]): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== "film") continue;
    const source = entry.source_id
      ?.match(/^imdb:(tt\d{7,12})$/i)?.[1]
      .toLowerCase();
    if (source) ids.add(source);
    const link = imdbIdFromLink(entry.link);
    if (link) ids.add(link);
  }
  return ids;
}
export function imdbDraft(film: ImdbFilm): Draft {
  if (!/^tt\d{7,12}$/.test(film.imdbId))
    throw new Error("An IMDb title identifier is invalid.");
  return validateDraft({
    ...emptyDraft("film"),
    title: film.title,
    creator: film.creator,
    format: film.format,
    note: film.note,
    source_id: `imdb:${film.imdbId}`,
    link: `https://www.imdb.com/title/${film.imdbId}/`,
  });
}
export function validateImdbBatch(films: ImdbFilm[]): Draft[] {
  if (!Array.isArray(films) || !films.length || films.length > IMDb.batchSize)
    throw new Error(`Import from 1 to ${IMDb.batchSize} titles at a time.`);
  return films.map(imdbDraft);
}

import Papa from "papaparse";
import { IMDb, imdbDraft, imdbIdFromLink, type ImdbFilm } from "./imdb";

export interface ImdbRow {
  line: number;
  film: ImdbFilm;
}
export interface ImdbIssue {
  line: number;
  reason: string;
}
export interface ImdbPreview {
  rows: ImdbRow[];
  invalid: ImdbIssue[];
  duplicates: number;
  total: number;
}
const normalize = (header: string) =>
  header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
const clean = (value: string) => value.replace(/\r\n?/g, "\n").trim();

/** Parses the user's exported snapshot only; no network or IMDb session access. */
export function parseImdbCsv(csv: string): ImdbPreview {
  if (!csv.trim())
    throw new Error("This file is empty. Choose the CSV downloaded from IMDb.");
  if (csv.includes("\u0000"))
    throw new Error(
      "This file is not a UTF-8 CSV. Use a fresh export downloaded from IMDb.",
    );
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ""), {
    header: false,
    delimiter: ",",
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    preview: IMDb.maxRows + 2,
  });
  if (parsed.errors.length)
    throw new Error(
      "The CSV has broken quoting or incomplete rows. Download a fresh export from IMDb.",
    );
  const [headers, ...records] = parsed.data;
  if (!headers?.length)
    throw new Error(
      "This file has no column headings. Choose the original IMDb CSV export.",
    );
  if (records.length > IMDb.maxRows || parsed.meta.truncated)
    throw new Error(
      `Choose an export with no more than ${IMDb.maxRows.toLocaleString()} rows.`,
    );
  const columns = headers.map(normalize);
  if (new Set(columns).size !== columns.length)
    throw new Error(
      "This CSV has duplicate column headings. Choose the original IMDb export.",
    );
  const titleColumn = columns.indexOf("title");
  const idColumn = columns.findIndex((column) =>
    ["const", "tconst", "imdb id"].includes(column),
  );
  const urlColumn = columns.findIndex((column) =>
    ["url", "title url"].includes(column),
  );
  if (titleColumn < 0 || (idColumn < 0 && urlColumn < 0))
    throw new Error(
      "Choose an IMDb title-list CSV with Title and Const (or URL) columns. A list link or downloaded webpage cannot be imported.",
    );
  const at = (record: string[], name: string) =>
    clean(record[columns.indexOf(name)] ?? "");
  const preview: ImdbPreview = {
    rows: [],
    invalid: [],
    duplicates: 0,
    total: records.length,
  };
  const ids = new Set<string>();
  records.forEach((record, index) => {
    const line = index + 2;
    if (record.length !== headers.length) {
      preview.invalid.push({
        line,
        reason: "The number of columns does not match the header.",
      });
      return;
    }
    const title = clean(record[titleColumn] ?? "");
    const rawId = clean(record[idColumn] ?? "").toLowerCase();
    const rawUrl = clean(record[urlColumn] ?? "");
    const fromUrl = rawUrl ? imdbIdFromLink(rawUrl) : null;
    if (
      (rawId && !/^tt\d{7,12}$/.test(rawId)) ||
      (rawUrl && !fromUrl) ||
      (rawId && fromUrl && rawId !== fromUrl)
    ) {
      preview.invalid.push({
        line,
        reason: "The IMDb title ID or link is invalid or does not match.",
      });
      return;
    }
    const imdbId = rawId || fromUrl;
    if (!imdbId) {
      preview.invalid.push({ line, reason: "Missing IMDb title ID." });
      return;
    }
    const year = at(record, "year");
    if (year && !/^\d{4}$/.test(year)) {
      preview.invalid.push({
        line,
        reason: "The release year is not a four-digit year.",
      });
      return;
    }
    const film = {
      imdbId,
      title,
      creator: at(record, "directors"),
      format: [at(record, "title type"), year].filter(Boolean).join(" · "),
      note: at(record, "description"),
    };
    try {
      imdbDraft(film);
    } catch (error) {
      preview.invalid.push({
        line,
        reason:
          error instanceof Error ? error.message : "Invalid title details.",
      });
      return;
    }
    if (ids.has(imdbId)) {
      preview.duplicates++;
      return;
    }
    ids.add(imdbId);
    preview.rows.push({ line, film });
  });
  return preview;
}

export async function readImdbFile(file: File): Promise<ImdbPreview> {
  if (!/\.csv$/i.test(file.name))
    throw new Error("Choose the .csv file exported from IMDb.");
  if (file.size > IMDb.maxBytes)
    throw new Error("Choose an IMDb export smaller than 16 MB.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error(
      "Could not read this file as UTF-8. Download a fresh IMDb CSV export.",
    );
  }
  return parseImdbCsv(text);
}

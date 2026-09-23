import { emptyDraft, validateDraft, type Draft, type Entry } from "./model";

export const SPOTIFY_IMPORT_BATCH = 250;
export const SPOTIFY_LIBRARY_LIMIT = 50_000;

export interface SpotifySong {
  id: string;
  title: string;
  creator: string;
  url: string;
  addedAt: string;
  album: string;
  releaseYear: number | null;
  durationMs: number | null;
  image?: string | null;
}

export interface SpotifyImportResult {
  added: number;
  skipped: number;
}

export function spotifyIdFromLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "open.spotify.com" ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    return url.pathname.match(/^\/track\/([A-Za-z0-9]{22})\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function existingSpotifyIds(entries: Entry[]): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== "music") continue;
    const source = entry.source_id?.match(/^spotify:([A-Za-z0-9]{22})$/)?.[1];
    if (source) ids.add(source);
    const linked = spotifyIdFromLink(entry.link);
    if (linked) ids.add(linked);
  }
  return ids;
}

export function spotifyDraft(song: SpotifySong): Draft {
  if (!/^[A-Za-z0-9]{22}$/.test(song.id))
    throw new Error("A Spotify track identifier is invalid.");
  const canonicalUrl = `https://open.spotify.com/track/${song.id}`;
  if (spotifyIdFromLink(song.url) !== song.id)
    throw new Error("A Spotify track link is invalid.");
  if (!Number.isFinite(Date.parse(song.addedAt)))
    throw new Error("A Spotify save date is invalid.");
  if (
    typeof song.album !== "string" ||
    song.album.length > 240 ||
    (song.releaseYear !== null &&
      (!Number.isInteger(song.releaseYear) ||
        song.releaseYear < 1000 ||
        song.releaseYear > 9999)) ||
    (song.durationMs !== null &&
      (!Number.isInteger(song.durationMs) ||
        song.durationMs < 1 ||
        song.durationMs > 3_600_000))
  )
    throw new Error("Spotify album metadata is invalid.");
  return validateDraft({
    ...emptyDraft("music"),
    title: song.title,
    creator: song.creator,
    status: "Saved",
    format: "Spotify liked song",
    source_id: `spotify:${song.id}`,
    link: canonicalUrl,
  });
}

export function compareSpotifyEntries(a: Entry, b: Entry): number {
  const aAdded = a.provider_added_at ? Date.parse(a.provider_added_at) : NaN;
  const bAdded = b.provider_added_at ? Date.parse(b.provider_added_at) : NaN;
  if (Number.isFinite(aAdded) && Number.isFinite(bAdded) && aAdded !== bAdded)
    return bAdded - aAdded;
  if (Number.isFinite(aAdded) !== Number.isFinite(bAdded))
    return Number.isFinite(bAdded) ? 1 : -1;
  return b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id);
}

export function validateSpotifyBatch(songs: SpotifySong[]): Draft[] {
  if (
    !Array.isArray(songs) ||
    !songs.length ||
    songs.length > SPOTIFY_IMPORT_BATCH
  )
    throw new Error(
      `Import from 1 to ${SPOTIFY_IMPORT_BATCH} Spotify songs at a time.`,
    );
  const ids = new Set<string>();
  return songs.map((song) => {
    if (ids.has(song.id)) throw new Error("This Spotify batch has duplicates.");
    ids.add(song.id);
    return spotifyDraft(song);
  });
}

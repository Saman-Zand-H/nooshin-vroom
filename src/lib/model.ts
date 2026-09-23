import {
  newDetails,
  validateDetails,
  type SectionDetails,
} from "./section-details";
import type { ImdbFilm, ImdbImportResult } from "./imdb";
import type { SpotifyImportResult, SpotifySong } from "./spotify-library";

export const kinds = [
  "book",
  "music",
  "wish",
  "request",
  "note",
  "film",
  "game",
  "movie_night",
  "adventure",
  "lyric",
  "love",
  "cycle",
  "body",
] as const;
export type Kind = (typeof kinds)[number];

export const statusOptions: Record<Kind, readonly string[]> = {
  book: ["Want to read", "Reading", "Finished"],
  music: ["Saved", "On repeat"],
  wish: ["Someday", "Would love", "Favourite"],
  request: ["Requested", "Practicing", "Recorded", "Delivered"],
  note: ["Saved"],
  film: ["Watchlist", "Watching", "Finished"],
  game: ["Want to play", "Playing", "Finished"],
  movie_night: ["Idea", "Planned", "Watched"],
  adventure: ["Someday", "A memory"],
  lyric: ["On the wall"],
  love: ["Hers"],
  cycle: ["Tracked"],
  body: ["Kept"],
};

export interface Entry {
  id: string;
  kind: Kind;
  title: string;
  creator: string;
  note: string;
  status: string;
  progress: number;
  rating: number;
  format: string;
  link: string;
  image_path: string | null;
  image_url: string | null;
  recording_path: string | null;
  recording_type: string | null;
  source_id: string | null;
  /** Provider metadata is populated for imported Spotify songs only. */
  provider_added_at?: string | null;
  provider_album?: string | null;
  provider_release_year?: number | null;
  provider_duration_ms?: number | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  version: number;
  shelf_cubby?: number;
  shelf_position?: number;
  shelf_orientation?: "vertical" | "horizontal";
  shelf_stack?: string | null;
  details?: SectionDetails | null;
}

export type Draft = Pick<
  Entry,
  | "kind"
  | "title"
  | "creator"
  | "note"
  | "status"
  | "progress"
  | "rating"
  | "format"
  | "link"
  | "image_url"
  | "source_id"
  | "details"
>;
export type Uploads = {
  image?: Blob | null;
  recording?: File | null;
};
export interface RoomMember {
  user_id: string;
  display_name: string;
  role: "owner" | "member";
}
export interface RoomEvent {
  id: string;
  title: string;
  kind: Kind;
  action: string;
  created_at: string;
}
export interface RoomSnapshot {
  entries: Entry[];
  events: RoomEvent[];
}
export interface RoomStore {
  load(): Promise<RoomSnapshot>;
  save(draft: Draft, uploads: Uploads, existing?: Entry): Promise<Entry>;
  remove(entry: Entry): Promise<void>;
  importImdb(films: ImdbFilm[]): Promise<ImdbImportResult>;
  importSpotify(songs: SpotifySong[]): Promise<SpotifyImportResult>;
  mediaUrl(path: string): Promise<string>;
  subscribe(onChange: () => void): () => void;
  bookshelf?: BookshelfStore;
}

export interface ShelfBookLayout {
  id: string;
  cubby: number;
  position: number;
  orientation: "vertical" | "horizontal";
  stack: string | null;
}
export interface ShelfDecoration {
  id: string;
  kind: string;
  label: string;
  cubby: number;
  position: number;
  image_path: string | null;
}
export interface BookshelfLayout {
  revision: number;
  books: ShelfBookLayout[];
  decorations: ShelfDecoration[];
}
export interface BookshelfStore {
  load(): Promise<BookshelfLayout>;
  save(
    layout: Omit<BookshelfLayout, "revision"> & { revision: number },
  ): Promise<BookshelfLayout>;
  createDecoration(input: {
    kind: string;
    label: string;
    cubby: number;
    position: number;
    image?: Blob;
  }): Promise<ShelfDecoration>;
}

export function emptyDraft(kind: Kind): Draft {
  return {
    kind,
    title: "",
    creator: "",
    note: "",
    status: statusOptions[kind][0],
    progress: 0,
    rating: 0,
    format: kind === "book" ? "Book" : kind === "film" ? "Film" : "",
    link: "",
    image_url: null,
    source_id: null,
    details: newDetails(kind),
  };
}

export function safeLink(value: string): string {
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use a complete http or https link.");
  return url.href;
}

export function validateDraft(draft: Draft): Draft {
  const clean: Draft = {
    kind: draft.kind,
    title: draft.title.trim(),
    creator: draft.creator.trim(),
    note: draft.note.trim(),
    status: draft.status,
    progress: draft.progress,
    rating: draft.rating,
    format: draft.format,
    link: safeLink(draft.link),
    image_url: draft.image_url,
    source_id: draft.source_id,
    details: validateDetails(draft.kind, draft.details),
  };
  if (
    !kinds.includes(clean.kind) ||
    !statusOptions[clean.kind].includes(clean.status)
  )
    throw new Error("Choose a valid collection and status.");
  if (!clean.title || clean.title.length > 240)
    throw new Error("Add a title, up to 240 characters.");
  if (
    clean.creator.length > 180 ||
    clean.note.length > 4000 ||
    clean.format.length > 80 ||
    clean.link.length > 2000
  )
    throw new Error("One of the fields is too long.");
  if (
    !Number.isInteger(clean.progress) ||
    clean.progress < 0 ||
    clean.progress > 100
  )
    throw new Error("Progress must be from 0 to 100.");
  if (!Number.isInteger(clean.rating) || clean.rating < 0 || clean.rating > 5)
    throw new Error("Rating must be from 0 to 5.");
  if (
    clean.image_url &&
    !/^https:\/\/(books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org)\//.test(
      clean.image_url,
    )
  )
    throw new Error("Use a catalogue cover or upload your own image.");
  if (clean.status === "Finished") clean.progress = 100;
  if (clean.kind === "lyric" && !clean.note)
    throw new Error("Write the words you want on your wall.");
  if (
    clean.kind === "movie_night" &&
    clean.status === "Watched" &&
    clean.details?.type === "movie_night" &&
    !clean.details.chosenId
  )
    throw new Error(
      "Choose the film or series you watched before saving this evening.",
    );
  return clean;
}

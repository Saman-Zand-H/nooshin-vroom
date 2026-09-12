import { djangoApiBase, djangoRequest } from "./django";
import {
  validateDraft,
  type Draft,
  type Entry,
  type RoomEvent,
  type RoomSnapshot,
  type RoomStore,
  type Uploads,
  type BookshelfStore,
} from "./model";
import { validateImdbBatch } from "./imdb";
import { validateSpotifyBatch, type SpotifySong } from "./spotify-library";
import type { ImdbFilm } from "./imdb";

const mediaPath = (path: string) =>
  `${djangoApiBase}${path.startsWith("/api/") ? path : `/api/media/${path}/`}`;

function fileName(file: Blob, fallback: string) {
  if (file instanceof File && file.name) return file.name;
  return fallback;
}

export const djangoStore: RoomStore = {
  async load(): Promise<RoomSnapshot> {
    return djangoRequest<RoomSnapshot>("/api/room/");
  },

  async save(draft: Draft, uploads: Uploads, existing?: Entry) {
    const clean = validateDraft(draft);
    const form = new FormData();
    form.append(
      "data",
      JSON.stringify({ ...clean, version: existing?.version }),
    );
    if (uploads.image !== undefined) {
      form.append("clear_image", uploads.image ? "false" : "true");
      if (uploads.image)
        form.append(
          "image",
          uploads.image,
          fileName(uploads.image, "image.webp"),
        );
    }
    if (uploads.recording !== undefined) {
      form.append("clear_recording", uploads.recording ? "false" : "true");
      if (uploads.recording)
        form.append(
          "recording",
          uploads.recording,
          fileName(uploads.recording, "recording.media"),
        );
    }
    const path = existing ? `/api/entries/${existing.id}/` : "/api/entries/";
    return djangoRequest<Entry>(path, {
      method: existing ? "PATCH" : "POST",
      body: form,
      headers: existing
        ? { "X-Entry-Version": String(existing.version) }
        : undefined,
    });
  },

  async remove(entry: Entry) {
    await djangoRequest(`/api/entries/${entry.id}/`, {
      method: "DELETE",
      headers: { "X-Entry-Version": String(entry.version) },
    });
  },

  async importImdb(films: ImdbFilm[]) {
    validateImdbBatch(films);
    return djangoRequest<{ added: number; skipped: number }>(
      "/api/import/imdb/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          films: films.map((film) => ({
            imdb_id: film.imdbId,
            title: film.title,
            creator: film.creator,
            format: film.format,
            note: film.note,
          })),
        }),
      },
    );
  },

  async importSpotify(songs: SpotifySong[]) {
    validateSpotifyBatch(songs);
    return djangoRequest<{ added: number; skipped: number }>(
      "/api/import/spotify/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songs: songs.map((song) => ({
            spotify_id: song.id,
            title: song.title,
            creator: song.creator,
            added_at: song.addedAt,
            album: song.album,
            release_year: song.releaseYear,
          })),
        }),
      },
    );
  },

  async mediaUrl(path: string) {
    return mediaPath(path);
  },

  subscribe(onChange) {
    let active = true;
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (active && !document.hidden) onChange();
      }, 250);
    };
    const interval = window.setInterval(() => {
      if (!document.hidden) onChange();
    }, 15_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  },
};

const djangoBookshelf: BookshelfStore = {
  load: () => djangoRequest("/api/bookshelf/"),
  save: (layout) =>
    djangoRequest("/api/bookshelf/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    }),
  createDecoration: async (input) => {
    const form = new FormData();
    form.append(
      "data",
      JSON.stringify({
        kind: input.kind,
        label: input.label,
        cubby: input.cubby,
        position: input.position,
      }),
    );
    if (input.image) form.append("image", input.image, "decoration.webp");
    return djangoRequest("/api/bookshelf/decorations/", {
      method: "POST",
      body: form,
    });
  },
};
djangoStore.bookshelf = djangoBookshelf;

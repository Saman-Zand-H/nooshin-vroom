import { openDB, type DBSchema } from "idb";
import {
  validateDraft,
  type Entry,
  type RoomEvent,
  type RoomStore,
  type BookshelfStore,
  type BookshelfLayout,
} from "./model";
import { existingImdbIds, validateImdbBatch } from "./imdb";
import type { WatchlistConnection } from "../../shared/imdb-watchlist";
import { existingSpotifyIds, validateSpotifyBatch } from "./spotify-library";

interface RoomDatabase extends DBSchema {
  entries: { key: string; value: Entry };
  media: { key: string; value: Blob };
  events: { key: string; value: RoomEvent };
  meta: { key: string; value: boolean };
  imdbConnection: { key: string; value: WatchlistConnection };
  bookshelf: { key: string; value: BookshelfLayout };
}
const db = () =>
  openDB<RoomDatabase>("control-room-v2", 4, {
    upgrade(database, version) {
      if (version < 1) {
        database.createObjectStore("entries", { keyPath: "id" });
        database.createObjectStore("media");
        database.createObjectStore("events", { keyPath: "id" });
      }
      if (version < 2) database.createObjectStore("meta");
      if (version < 3) database.createObjectStore("imdbConnection");
      if (version < 4) database.createObjectStore("bookshelf");
    },
  });
export const openLocalDatabase = db;
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("control-room-changes")
    : null;
const listeners = new Set<() => void>();
let seedPromise: Promise<void> | null = null;
channel?.addEventListener("message", () =>
  listeners.forEach((listener) => listener()),
);
const changed = () => {
  listeners.forEach((listener) => listener());
  channel?.postMessage("updated");
};

const bookshelfBooks = [
  ["Six of Crows", "Leigh Bardugo", "Finished", 100],
  ["Rock Paper Scissors", "Alice Feeney", "Finished", 100],
  ["کوری", "ژوزه ساراماگو", "Finished", 100],
  ["بیمار خاموش", "الکس مایکلایدس", "Want to read", 0],
  ["زنی در کابین ۱۰", "روث ور", "Want to read", 0],
  ["دروغگو بودیم", "ای. لاکهارت", "Want to read", 0],
  ["هر دو در نهایت می‌میرند", "آدام سیلورا", "Want to read", 0],
  ["راز بین دو نفر", "کلر مکینتاش", "Want to read", 0],
  ["در ژرفای آب", "پائولا هاوکینز", "Want to read", 0],
  ["ساعت قصه‌گویی", "سالی پیج", "Want to read", 0],
] as const;
export const notifyLocalChanges = changed;

export const localStore: RoomStore = {
  async load() {
    const database = await db();
    if (!(await database.get("meta", "seeded"))) {
      if (seedPromise) await seedPromise;
      else
        seedPromise = (async () => {
          const seededAt = new Date().toISOString();
          const seeds: Entry[] = [
            ...bookshelfBooks.map(
              ([title, creator, status, progress], index) => ({
                id: crypto.randomUUID(),
                kind: "book" as const,
                title,
                creator,
                note: "A book that belongs on her shelf.",
                status,
                progress,
                rating: 0,
                format: "Book",
                link: "",
                image_path: null,
                image_url: null,
                recording_path: null,
                recording_type: null,
                source_id: null,
                created_at: seededAt,
                updated_at: seededAt,
                created_by: "this-device",
                version: 1,
                shelf_cubby: [0, 0, 2, 2, 3, 4, 4, 5, 7, 8][index],
                shelf_position: [0, 1, 0, 1, 0, 0, 1, 0, 0, 0][index],
                shelf_orientation:
                  index === 5 || index === 6
                    ? ("horizontal" as const)
                    : ("vertical" as const),
                shelf_stack: index === 5 || index === 6 ? "stack-4-0" : null,
              }),
            ),
            {
              id: crypto.randomUUID(),
              kind: "music",
              title: "Jigsaw Falling Into Place",
              creator: "Radiohead",
              note: "for the part where everything clicks",
              status: "Saved",
              progress: 0,
              rating: 0,
              format: "",
              link: "https://open.spotify.com/search/Radiohead%20Jigsaw%20Falling%20Into%20Place",
              image_path: null,
              image_url: null,
              recording_path: null,
              recording_type: null,
              source_id: null,
              created_at: seededAt,
              updated_at: seededAt,
              created_by: "this-device",
              version: 1,
            },
            {
              id: crypto.randomUUID(),
              kind: "request",
              title: "Motion Picture Soundtrack",
              creator: "Radiohead",
              note: "Something that hurts a little.",
              status: "Practicing",
              progress: 0,
              rating: 0,
              format: "Violin",
              link: "",
              image_path: null,
              image_url: null,
              recording_path: null,
              recording_type: null,
              source_id: null,
              created_at: seededAt,
              updated_at: seededAt,
              created_by: "this-device",
              version: 1,
            },
            {
              id: crypto.randomUUID(),
              kind: "wish",
              title: "Something green",
              creator: "",
              note: "",
              status: "Would love",
              progress: 0,
              rating: 0,
              format: "",
              link: "",
              image_path: null,
              image_url: null,
              recording_path: null,
              recording_type: null,
              source_id: null,
              created_at: seededAt,
              updated_at: seededAt,
              created_by: "this-device",
              version: 1,
            },
            {
              id: crypto.randomUUID(),
              kind: "note",
              title: "Leave a light on",
              creator: "",
              note: "A little corner for the things that make a day feel like yours.",
              status: "Saved",
              progress: 0,
              rating: 0,
              format: "",
              link: "",
              image_path: null,
              image_url: null,
              recording_path: null,
              recording_type: null,
              source_id: null,
              created_at: seededAt,
              updated_at: seededAt,
              created_by: "this-device",
              version: 1,
            },
          ];
          const transaction = database.transaction(
            ["entries", "meta"],
            "readwrite",
          );
          try {
            // `add`, rather than `put`, makes two tabs race safely: only one
            // gets the seed marker and therefore writes starter entries.
            await transaction.objectStore("meta").add(true, "seeded");
            await Promise.all(
              seeds.map((seed) => transaction.objectStore("entries").put(seed)),
            );
            await transaction.done;
          } catch (failure) {
            if (
              !(failure instanceof DOMException) ||
              failure.name !== "ConstraintError"
            )
              throw failure;
          }
        })().finally(() => {
          seedPromise = null;
        });
      await seedPromise;
    }
    if (!(await database.get("meta", "bookshelf-seeded-v2"))) {
      const existing = await database.getAll("entries");
      const titles = new Set(
        existing
          .filter((entry) => entry.kind === "book")
          .map((entry) => entry.title),
      );
      const now = new Date().toISOString();
      const tx = database.transaction(["entries", "meta"], "readwrite");
      for (const [title, creator, status, progress] of bookshelfBooks) {
        if (titles.has(title)) continue;
        await tx.objectStore("entries").put({
          id: crypto.randomUUID(),
          kind: "book",
          title,
          creator,
          note: "A book that belongs on her shelf.",
          status,
          progress,
          rating: 0,
          format: "Book",
          link: "",
          image_path: null,
          image_url: null,
          recording_path: null,
          recording_type: null,
          source_id: null,
          created_at: now,
          updated_at: now,
          created_by: "this-device",
          version: 1,
          shelf_cubby: [0, 0, 2, 2, 3, 4, 4, 5, 7, 8][
            bookshelfBooks.findIndex((book) => book[0] === title)
          ],
          shelf_position: [0, 1, 0, 1, 0, 0, 1, 0, 0, 0][
            bookshelfBooks.findIndex((book) => book[0] === title)
          ],
        });
      }
      for (const entry of existing) {
        if (
          entry.kind === "book" &&
          entry.title === "The Vicious and the Vengeful" &&
          entry.created_by === "this-device" &&
          entry.note === "The unreliable kind of quiet."
        )
          await tx.objectStore("entries").delete(entry.id);
      }
      await tx.objectStore("meta").put(true, "bookshelf-seeded-v2");
      await tx.done;
    }
    const [entries, events] = await Promise.all([
      database.getAll("entries"),
      database.getAll("events"),
    ]);
    return {
      entries: entries.sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      events: events
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 30),
    };
  },
  async save(draft, uploads, existing) {
    const data = validateDraft(draft);
    const database = await db();
    const tx = database.transaction(
      ["entries", "media", "events"],
      "readwrite",
    );
    void tx.done.catch(() => undefined);
    if (data.source_id) {
      const duplicate = (await tx.objectStore("entries").getAll()).some(
        (item) =>
          item.kind === data.kind &&
          item.source_id === data.source_id &&
          item.id !== existing?.id,
      );
      if (duplicate) {
        tx.abort();
        throw new Error("That catalogue item is already in the room.");
      }
    }
    if (existing) {
      const current = await tx.objectStore("entries").get(existing.id);
      if (!current || current.version !== existing.version) {
        tx.abort();
        throw new Error(
          "This item changed in another tab. Reopen it before saving.",
        );
      }
    }
    const entry: Entry = {
      ...data,
      id: existing?.id ?? crypto.randomUUID(),
      image_path: existing?.image_path ?? null,
      recording_path: existing?.recording_path ?? null,
      recording_type: existing?.recording_type ?? null,
      created_by: "this-device",
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: (existing?.version ?? 0) + 1,
    };
    for (const [key, field] of [
      ["image", "image_path"],
      ["recording", "recording_path"],
    ] as const) {
      if (uploads[key] === undefined) continue;
      if (entry[field]) await tx.objectStore("media").delete(entry[field]!);
      entry[field] = uploads[key] ? crypto.randomUUID() : null;
      if (uploads[key])
        await tx.objectStore("media").put(uploads[key]!, entry[field]!);
      if (key === "image") entry.image_url = null;
      if (key === "recording")
        entry.recording_type = uploads.recording?.type ?? null;
    }
    await tx.objectStore("entries").put(entry);
    await tx.objectStore("events").put({
      id: crypto.randomUUID(),
      title: entry.title,
      kind: entry.kind,
      action: existing ? "Updated" : "Added",
      created_at: entry.updated_at,
    });
    await tx.done;
    changed();
    return entry;
  },
  async remove(entry) {
    const database = await db();
    const tx = database.transaction(
      ["entries", "media", "events"],
      "readwrite",
    );
    void tx.done.catch(() => undefined);
    const current = await tx.objectStore("entries").get(entry.id);
    if (!current || current.version !== entry.version) {
      tx.abort();
      throw new Error("This item changed. Reopen it before removing it.");
    }
    await tx.objectStore("entries").delete(entry.id);
    for (const path of [entry.image_path, entry.recording_path])
      if (path) await tx.objectStore("media").delete(path);
    await tx.objectStore("events").put({
      id: crypto.randomUUID(),
      title: entry.title,
      kind: entry.kind,
      action: "Removed",
      created_at: new Date().toISOString(),
    });
    await tx.done;
    changed();
  },
  async importImdb(films) {
    const drafts = validateImdbBatch(films);
    const database = await db();
    const tx = database.transaction(["entries", "events"], "readwrite");
    void tx.done.catch(() => undefined);
    const existing = existingImdbIds(await tx.objectStore("entries").getAll());
    let added = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    try {
      for (const draft of drafts) {
        const id = draft.source_id!.slice(5);
        if (existing.has(id)) {
          skipped++;
          continue;
        }
        const entry: Entry = {
          ...draft,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
          created_by: "this-device",
          version: 1,
          image_path: null,
          recording_path: null,
          recording_type: null,
        };
        await tx.objectStore("entries").add(entry);
        await tx.objectStore("events").add({
          id: crypto.randomUUID(),
          title: entry.title,
          kind: "film",
          action: "Added",
          created_at: now,
        });
        existing.add(id);
        added++;
      }
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* The transaction may already have aborted. */
      }
      throw error;
    }
    if (added) changed();
    return { added, skipped };
  },
  async importSpotify(songs) {
    const drafts = validateSpotifyBatch(songs);
    const database = await db();
    const tx = database.transaction(["entries", "events"], "readwrite");
    void tx.done.catch(() => undefined);
    const allEntries = await tx.objectStore("entries").getAll();
    const existing = existingSpotifyIds(allEntries);
    let added = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    try {
      for (const [index, draft] of drafts.entries()) {
        const song = songs[index];
        const spotifyId = draft.source_id!.slice("spotify:".length);
        if (existing.has(spotifyId)) {
          const current = allEntries.find(
            (entry) =>
              entry.kind === "music" &&
              (entry.source_id === `spotify:${spotifyId}` ||
                entry.link === `https://open.spotify.com/track/${spotifyId}` ||
                entry.link.startsWith(
                  `https://open.spotify.com/track/${spotifyId}?`,
                )),
          );
          if (
            current &&
            (!current.provider_added_at ||
              !current.provider_album ||
              (current.provider_release_year == null &&
                song.releaseYear != null))
          ) {
            await tx.objectStore("entries").put({
              ...current,
              provider_added_at:
                current.provider_added_at ||
                new Date(song.addedAt).toISOString(),
              provider_album: current.provider_album || song.album,
              provider_release_year:
                current.provider_release_year ?? song.releaseYear,
              provider_duration_ms:
                current.provider_duration_ms ?? song.durationMs,
              image_url: current.image_url ?? song.image ?? null,
            });
          }
          skipped++;
          continue;
        }
        const entry: Entry = {
          ...draft,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
          created_by: "this-device",
          version: 1,
          image_path: null,
          recording_path: null,
          recording_type: null,
          provider_added_at: new Date(song.addedAt).toISOString(),
          provider_album: song.album,
          provider_release_year: song.releaseYear,
          provider_duration_ms: song.durationMs,
          image_url: song.image ?? null,
        };
        await tx.objectStore("entries").add(entry);
        await tx.objectStore("events").add({
          id: crypto.randomUUID(),
          title: entry.title,
          kind: "music",
          action: "Added from Spotify",
          created_at: now,
        });
        existing.add(spotifyId);
        added++;
      }
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* The transaction may already have aborted. */
      }
      throw error;
    }
    if (added) changed();
    return { added, skipped };
  },
  async mediaUrl(path) {
    const media = await (await db()).get("media", path);
    if (!media) throw new Error("This attachment is missing.");
    return URL.createObjectURL(media);
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

const localBookshelf: BookshelfStore = {
  async load() {
    const database = await db();
    const saved = await database.get("bookshelf", "layout");
    if (!(await database.get("meta", "decorations-cleared-v1"))) {
      const tx = database.transaction(["bookshelf", "meta"], "readwrite");
      if (saved) {
        saved.decorations = [];
        await tx.objectStore("bookshelf").put(saved, "layout");
      }
      await tx.objectStore("meta").put(true, "decorations-cleared-v1");
      await tx.done;
    }
    if (!saved) return { revision: 1, books: [], decorations: [] };
    return {
      ...saved,
      // An existing layout is authoritative. In particular, [] means the
      // user deliberately removed every starter decoration; never merge the
      // defaults back into that saved state on reload.
      decorations: saved.decorations,
    };
  },
  async save(layout) {
    const database = await db();
    const next: BookshelfLayout = {
      revision: layout.revision + 1,
      books: layout.books,
      decorations: layout.decorations,
    };
    await database.put("bookshelf", next, "layout");
    changed();
    return next;
  },
  async createDecoration(input) {
    const current = await this.load();
    const decoration = {
      id: crypto.randomUUID(),
      kind: input.kind,
      label: input.label,
      cubby: input.cubby,
      position: input.position,
      image_path: null,
    };
    await this.save({
      revision: current.revision,
      books: current.books,
      decorations: [...current.decorations, decoration],
    });
    return decoration;
  },
};
localStore.bookshelf = localBookshelf;

export async function exportLocalRoom() {
  const database = await db();
  const snapshot = await localStore.load();
  const paths = new Set(
    snapshot.entries
      .flatMap((entry) => [entry.image_path, entry.recording_path])
      .filter((path): path is string => Boolean(path)),
  );
  const attachments = await Promise.all(
    [...paths].map(async (path) => {
      const blob = await database.get("media", path);
      if (!blob) return { path, data: null };
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return { path, data };
    }),
  );
  return new Blob(
    [
      JSON.stringify({
        version: 1,
        exported_at: new Date().toISOString(),
        ...snapshot,
        attachments,
      }),
    ],
    { type: "application/json" },
  );
}

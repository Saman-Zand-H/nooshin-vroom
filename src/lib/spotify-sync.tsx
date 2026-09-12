import { useEffect, useState } from "react";
import { useRoom } from "./room-context";
import { localPreview } from "./runtime-mode";
import {
  spotifyRequest,
  type SpotifyLikedPage,
  type SpotifyStatus,
} from "./spotify";
import { SPOTIFY_LIBRARY_LIMIT } from "./spotify-library";

type SyncState = {
  phase: "idle" | "syncing" | "done" | "error";
  added: number;
  total: number;
  message: string;
};

const eventName = "nooshin-spotify-library";
let state: SyncState = { phase: "idle", added: 0, total: 0, message: "" };
let running: Promise<void> | null = null;
const completedKey = "nooshin-spotify-library-synced-at";
let lastCompletedAt = (() => {
  try {
    const value = Number(window.localStorage.getItem(completedKey));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
})();

function publish(next: SyncState) {
  state = next;
  window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
}

function validPage(
  value: unknown,
  expectedOffset: number,
): value is SpotifyLikedPage {
  if (!value || typeof value !== "object") return false;
  const page = value as SpotifyLikedPage;
  return (
    page.offset === expectedOffset &&
    Number.isInteger(page.total) &&
    page.total >= 0 &&
    page.total <= SPOTIFY_LIBRARY_LIMIT &&
    Array.isArray(page.songs) &&
    page.songs.length <= 50 &&
    (page.nextOffset === null ||
      (Number.isInteger(page.nextOffset) &&
        page.nextOffset > expectedOffset &&
        page.nextOffset <= page.total))
  );
}

export function requestSpotifyLibrarySync() {
  window.dispatchEvent(new CustomEvent(eventName, { detail: { force: true } }));
}

export function useSpotifyLibrarySyncState() {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.phase) setCurrent(detail as SyncState);
    };
    window.addEventListener(eventName, update);
    return () => window.removeEventListener(eventName, update);
  }, []);
  return current;
}

export function SpotifyLibrarySync() {
  const { store, reload } = useRoom();
  useEffect(() => {
    if (localPreview) return;
    const sync = (force = false) => {
      if (running) return running;
      if (!force && Date.now() - lastCompletedAt < 5 * 60_000)
        return Promise.resolve();
      running = (async () => {
        try {
          const status = await spotifyRequest<SpotifyStatus>("status");
          if (!status.connected) return;
          publish({ phase: "syncing", added: 0, total: 0, message: "" });
          let offset = 0;
          let total = 0;
          let added = 0;
          const seenOffsets = new Set<number>();
          for (;;) {
            if (seenOffsets.has(offset))
              throw new Error("Spotify repeated a page.");
            seenOffsets.add(offset);
            const page = await spotifyRequest<SpotifyLikedPage>("liked", {
              offset,
            });
            if (!validPage(page, offset))
              throw new Error("Spotify returned an incomplete library page.");
            total = page.total;
            if (page.songs.length) {
              const result = await store.importSpotify(page.songs);
              added += result.added;
            }
            publish({ phase: "syncing", added, total, message: "" });
            if (page.nextOffset === null) break;
            offset = page.nextOffset;
          }
          lastCompletedAt = Date.now();
          try {
            window.localStorage.setItem(completedKey, String(lastCompletedAt));
          } catch {
            /* The in-memory cooldown still prevents duplicate work this visit. */
          }
          await reload();
          publish({
            phase: "done",
            added,
            total,
            message: added
              ? `${added.toLocaleString()} liked ${added === 1 ? "song" : "songs"} added.`
              : `All ${total.toLocaleString()} liked songs are already here.`,
          });
        } catch {
          publish({
            phase: "error",
            added: 0,
            total: 0,
            message:
              "Spotify could not finish adding every liked song. Songs already saved are safe; refresh to continue.",
          });
        } finally {
          running = null;
        }
      })();
      return running;
    };
    const update = (event: Event) => {
      const force = Boolean((event as CustomEvent).detail?.force);
      void sync(force);
    };
    void sync();
    window.addEventListener("focus", update);
    window.addEventListener(eventName, update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener(eventName, update);
    };
  }, [reload, store]);
  return null;
}

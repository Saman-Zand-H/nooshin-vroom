import { useCallback, useEffect, useRef, useState } from "react";
import {
  IMDB_ERROR_CODES,
  normalizeWatchlistUrl,
  type WatchlistStatus,
} from "../../shared/imdb-watchlist";
import { djangoRequest } from "./django";
import { useRoom } from "./room-context";
import { localPreview } from "./runtime-mode";

type Action = "status" | "connect" | "refresh" | "refresh_due" | "disconnect";
function validStatus(value: unknown): value is WatchlistStatus {
  if (!value || typeof value !== "object") return false;
  const state = value as WatchlistStatus;
  if (
    typeof state.available !== "boolean" ||
    !["background", "while_open", "manual"].includes(state.automatic) ||
    !["disconnected", "refreshing", "connected", "needs_attention"].includes(
      state.phase,
    ) ||
    !Number.isInteger(state.titleCount) ||
    state.titleCount < 0 ||
    state.titleCount > 12000 ||
    !Number.isInteger(state.lastAdded) ||
    state.lastAdded < 0 ||
    state.lastAdded > 12000 ||
    (state.errorCode !== null && !IMDB_ERROR_CODES.includes(state.errorCode))
  )
    return false;
  for (const timestamp of [
    state.lastAttemptAt,
    state.lastSuccessAt,
    state.nextRefreshAt,
    state.retryAfter,
  ])
    if (
      timestamp !== null &&
      (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp)))
    )
      return false;
  if (state.sourceUrl !== null) {
    try {
      if (normalizeWatchlistUrl(state.sourceUrl).sourceUrl !== state.sourceUrl)
        return false;
    } catch {
      return false;
    }
  }
  return state.phase === "disconnected"
    ? state.sourceUrl === null
    : state.sourceUrl !== null &&
        (state.phase !== "connected" || state.lastSuccessAt !== null);
}
export async function requestWatchlist(
  action: Action,
  url?: string,
): Promise<WatchlistStatus> {
  if (action === "connect") url = normalizeWatchlistUrl(url || "").sourceUrl;
  const routes: Record<Action, string> = {
    status: "/api/imdb/status/",
    connect: "/api/imdb/connect/",
    refresh: "/api/imdb/refresh/",
    refresh_due: "/api/imdb/refresh/",
    disconnect: "/api/imdb/disconnect/",
  };
  const data = await djangoRequest<WatchlistStatus>(routes[action], {
    method: action === "status" ? "GET" : "POST",
    ...(url
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }
      : {}),
    signal: AbortSignal.timeout(110_000),
  });
  if (!validStatus(data))
    throw new Error(
      "The IMDb connection returned an unrecognised status. Try again later.",
    );
  return data;
}
const changeEvent = "control-room-imdb-status";
export function useWatchlistConnection() {
  const { store, reload } = useRoom();
  const [status, setStatus] = useState<WatchlistStatus | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const sequence = useRef(0);
  const actionVersion = useRef(0);
  const check = useCallback(async () => {
    const serial = ++sequence.current;
    try {
      const current = await requestWatchlist("status");
      if (serial === sequence.current) {
        setStatus(current);
        setError("");
      }
    } catch (failure) {
      if (serial === sequence.current) setError((failure as Error).message);
    }
  }, []);
  useEffect(() => {
    if (localPreview) return;
    void check();
    const update = () => {
      if (!document.hidden) void check();
    };
    window.addEventListener("focus", update);
    window.addEventListener(changeEvent, update);
    document.addEventListener("visibilitychange", update);
    // RoomProvider owns the cloud Realtime channel. Local notifications also
    // carry connection-only changes from other tabs.
    const unsubscribe = store.subscribe(update);
    return () => {
      sequence.current++;
      actionVersion.current++;
      unsubscribe();
      window.removeEventListener("focus", update);
      window.removeEventListener(changeEvent, update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [check, store]);
  const pollQuickly = Boolean(
    pending ||
    status?.phase === "refreshing" ||
    (status?.retryAfter && Date.parse(status.retryAfter) > Date.now()),
  );
  useEffect(() => {
    if (localPreview) return;
    const interval = window.setInterval(
      () => {
        if (!document.hidden) void check();
      },
      pollQuickly ? 5000 : 60_000,
    );
    return () => clearInterval(interval);
  }, [check, pollQuickly]);
  const run = async (
    action: Exclude<Action, "status" | "refresh_due">,
    url?: string,
  ) => {
    const version = ++actionVersion.current;
    sequence.current++;
    setPending(action);
    setError("");
    try {
      const current = await requestWatchlist(action, url);
      if (version !== actionVersion.current) return;
      sequence.current++;
      setStatus(current);
      window.dispatchEvent(new Event(changeEvent));
      await reload();
    } catch (failure) {
      if (version === actionVersion.current)
        setError((failure as Error).message);
    } finally {
      if (version === actionVersion.current) setPending(null);
    }
  };
  return { status, error, pending, check, run };
}

export function ImdbAutoRefresh() {
  const { reload } = useRoom();
  useEffect(() => {
    if (localPreview) return;
    let active = true,
      processing = false;
    const due = async () => {
      if (!active || processing || document.hidden) return;
      processing = true;
      try {
        const status = await requestWatchlist("status");
        if (
          status.available &&
          status.sourceUrl &&
          status.phase !== "refreshing" &&
          Date.parse(status.nextRefreshAt || "") <= Date.now()
        ) {
          await requestWatchlist("refresh_due");
          if (active) {
            window.dispatchEvent(new Event(changeEvent));
            await reload();
          }
        }
      } catch {
        /* Explicit connection UI reports errors; the existing room remains usable. */
      } finally {
        processing = false;
      }
    };
    void due();
    const update = () => {
      void due();
    };
    const interval = window.setInterval(update, 60_000);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [reload]);
  return null;
}

export const IMDB_REFRESH_MS = 6 * 60 * 60 * 1000;
export const IMDB_RETRY_MS = 60 * 60 * 1000;
export const IMDB_COOLDOWN_MS = 60 * 1000;
export const IMDB_LEASE_MS = 2 * 60 * 1000;
export const IMDB_MAX_TITLES = 12_000;
export const IMDB_ERROR_CODES = [
  "private_or_missing",
  "rate_limited",
  "unavailable",
  "response_changed",
  "too_large",
  "timed_out",
  "interrupted",
] as const;
export type ImdbErrorCode = (typeof IMDB_ERROR_CODES)[number];
export const imdbErrors: Record<ImdbErrorCode, string> = {
  private_or_missing:
    "IMDb did not return a public Watchlist. Check the link and its visibility on IMDb.",
  rate_limited:
    "IMDb is limiting requests. Your saved films are safe; try again later.",
  unavailable:
    "IMDb could not be reached. Your last successful list has been kept.",
  response_changed:
    "IMDb’s response could not be verified. Your saved films have not been changed.",
  too_large:
    "This Watchlist is too large to refresh in one visit. You can still use the CSV importer.",
  timed_out:
    "IMDb took too long to return the complete list. Your previous list has been kept.",
  interrupted:
    "The last refresh did not finish. Your previous list has been kept.",
};
export class WatchlistError extends Error {
  constructor(public code: ImdbErrorCode) {
    super(imdbErrors[code]);
  }
}
export interface PublicImdbFilm {
  imdbId: string;
  title: string;
  creator: string;
  format: string;
  note: string;
}
export interface WatchlistSnapshot {
  sourceUrl: string;
  profileId: string;
  films: PublicImdbFilm[];
}
export interface WatchlistConnection {
  source_url: string;
  profile_id: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  next_refresh_at: string;
  title_count: number;
  last_added: number;
  last_error: ImdbErrorCode | null;
  lease_id: string | null;
  lease_expires_at: string | null;
  snapshot_ids: string[];
}
export interface WatchlistStatus {
  available: boolean;
  automatic: "background" | "while_open" | "manual";
  phase: "disconnected" | "refreshing" | "connected" | "needs_attention";
  sourceUrl: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextRefreshAt: string | null;
  retryAfter: string | null;
  titleCount: number;
  lastAdded: number;
  errorCode: ImdbErrorCode | null;
}
export function normalizeWatchlistUrl(raw: string): {
  sourceUrl: string;
  profileId: string;
} {
  if (typeof raw !== "string" || raw.trim().length > 512)
    throw new Error("Paste a complete public IMDb Watchlist link.");
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(
      "Paste a complete link, like https://www.imdb.com/user/ur12345678/watchlist/",
    );
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !["www.imdb.com", "imdb.com", "m.imdb.com"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Use a Watchlist link from imdb.com.");
  const profileId = url.pathname.match(
    /^\/user\/(ur[0-9]{1,20}|p\.[A-Za-z0-9_-]{1,128})\/watchlist\/?$/,
  )?.[1];
  if (!profileId)
    throw new Error(
      "Use the public link containing /user/…/watchlist/. The personal /watchlist page and custom lists are different links.",
    );
  return {
    profileId,
    sourceUrl: `https://www.imdb.com/user/${profileId}/watchlist/`,
  };
}
export function connectionStatus(
  record: WatchlistConnection | null,
  automatic: WatchlistStatus["automatic"],
  available = true,
  now = Date.now(),
): WatchlistStatus {
  const refreshing = Boolean(
    record?.lease_id &&
    record.lease_expires_at &&
    Date.parse(record.lease_expires_at) > now,
  );
  const errorCode =
    record?.last_error ??
    (record?.lease_id && !refreshing ? "interrupted" : null);
  return {
    available,
    automatic,
    phase: !record
      ? "disconnected"
      : refreshing
        ? "refreshing"
        : errorCode || !record.last_success_at
          ? "needs_attention"
          : "connected",
    sourceUrl: record?.source_url ?? null,
    lastAttemptAt: record?.last_attempt_at ?? null,
    lastSuccessAt: record?.last_success_at ?? null,
    nextRefreshAt: record?.next_refresh_at ?? null,
    retryAfter: refreshing
      ? record!.lease_expires_at
      : record?.last_attempt_at
        ? new Date(
            Date.parse(record.last_attempt_at) + IMDB_COOLDOWN_MS,
          ).toISOString()
        : null,
    titleCount: record?.title_count ?? 0,
    lastAdded: record?.last_added ?? 0,
    errorCode,
  };
}

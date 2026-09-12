import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import {
  connectionStatus,
  normalizeWatchlistUrl,
  WatchlistError,
  type WatchlistConnection,
} from "../../../shared/imdb-watchlist.ts";
import { readPublicWatchlist } from "../../../server/imdb-reader.ts";

const env = (key: string) => Deno.env.get(key) || "";
const appOrigin = env("APP_URL") ? new URL(env("APP_URL")).origin : "";
const enabled = env("IMDB_WATCHLIST_ENABLED") !== "false";
const cronSecret = env("IMDB_CRON_SECRET");
const admin = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const headers = {
  "Access-Control-Allow-Origin": appOrigin,
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  Vary: "Origin",
  "X-Content-Type-Options": "nosniff",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

async function statusFor(userId: string) {
  const result = await admin
    .from("imdb_watchlist_connections")
    .select(
      "source_url, profile_id, last_attempt_at, last_success_at, next_refresh_at, title_count, last_added, last_error, lease_id, lease_expires_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error("Connection state unavailable");
  const schedule =
    cronSecret.length >= 32 ? await admin.rpc("imdb_background_ready") : null;
  return connectionStatus(
    result.data
      ? ({ ...result.data, snapshot_ids: [] } as WatchlistConnection)
      : null,
    !schedule?.error && schedule?.data === true ? "background" : "while_open",
    enabled,
  );
}
async function sync(userId: string, sourceUrl: string | null, manual: boolean) {
  const claimed = await admin.rpc("begin_imdb_refresh", {
    actor: userId,
    requested_url: sourceUrl,
    manual,
  });
  if (claimed.error) throw new Error("Could not start refresh");
  if (claimed.data?.state !== "claimed") return claimed.data?.state;
  const lease = String(claimed.data.lease_id);
  try {
    const snapshot = await readPublicWatchlist(claimed.data.source_url, {
      queryHash: env("IMDB_WATCHLIST_QUERY_HASH") || undefined,
    });
    const completed = await admin.rpc("finish_imdb_refresh", {
      actor: userId,
      token: lease,
      films: snapshot.films.map((film) => ({
        imdb_id: film.imdbId,
        title: film.title,
        creator: film.creator,
        format: film.format,
      })),
    });
    if (completed.error) throw new Error("Could not commit refresh");
    return completed.data?.applied ? "completed" : "cancelled";
  } catch (error) {
    const code = error instanceof WatchlistError ? error.code : "unavailable";
    // Fencing prevents a stale failure from overwriting a newer success or a disconnect.
    const failed = await admin.rpc("fail_imdb_refresh", {
      actor: userId,
      token: lease,
      failure: code,
    });
    if (failed.error) throw new Error("Could not record refresh state");
    return "failed";
  }
}
async function secretMatches(value: string) {
  if (cronSecret.length < 32 || !value || value.length > 512) return false;
  const digest = (value: string) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [one, two] = await Promise.all([digest(value), digest(cronSecret)]);
  const a = new Uint8Array(one),
    b = new Uint8Array(two);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
async function readBody(request: Request) {
  if (!request.body) throw new Error("No body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 4096) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

Deno.serve(async (request) => {
  // Cron has no browser Origin/JWT. Its separate secret can only run due refreshes.
  if (new URL(request.url).pathname.endsWith("/scheduled")) {
    if (
      request.method !== "POST" ||
      !(await secretMatches(request.headers.get("x-room-scheduler") || ""))
    )
      return json({ error: "Not authorized" }, 401);
    if (!enabled) return json({ refreshed: 0, paused: true });
    try {
      const due = await admin
        .from("imdb_watchlist_connections")
        .select("user_id")
        .lte("next_refresh_at", new Date().toISOString())
        .order("next_refresh_at")
        .limit(2);
      if (due.error) throw new Error("Could not find due lists");
      // At most two members; concurrent reads remain inside the function deadline.
      const results = await Promise.allSettled(
        (due.data ?? []).map((row) => sync(row.user_id, null, false)),
      );
      return json({
        checked: results.length,
        completed: results.filter(
          (result) =>
            result.status === "fulfilled" && result.value === "completed",
        ).length,
        failed: results.filter(
          (result) => result.status === "rejected" || result.value === "failed",
        ).length,
      });
    } catch {
      return json({ error: "Scheduled refresh could not run" }, 503);
    }
  }
  if (!appOrigin || request.headers.get("Origin") !== appOrigin)
    return json({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const bearer = request.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer "))
    return json({ error: "Sign in required" }, 401);
  try {
    const user = await admin.auth.getUser(bearer.slice(7));
    if (user.error || !user.data.user)
      return json({ error: "Sign in required" }, 401);
    const userId = user.data.user.id;
    const membership = await admin
      .from("room_members")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (membership.error || !membership.data)
      return json({ error: "Room invitation required" }, 403);
    let body: { action?: unknown; url?: unknown };
    try {
      body = await readBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error();
    } catch {
      return json({ error: "Invalid request" }, 400);
    }
    if (body.action === "status") return json(await statusFor(userId));
    if (body.action === "disconnect") {
      const result = await admin
        .from("imdb_watchlist_connections")
        .delete()
        .eq("user_id", userId);
      if (result.error) throw new Error("Disconnect failed");
      return json(await statusFor(userId));
    }
    if (!enabled)
      return json({ error: "IMDb refreshes are paused for this room." }, 503);
    if (!["connect", "refresh", "refresh_due"].includes(String(body.action)))
      return json({ error: "Unknown action" }, 400);
    let url: string | null = null;
    if (body.action === "connect") {
      try {
        url = normalizeWatchlistUrl(
          typeof body.url === "string" ? body.url : "",
        ).sourceUrl;
      } catch (error) {
        return json({ error: (error as Error).message }, 400);
      }
    }
    const state = await sync(userId, url, body.action !== "refresh_due");
    if (state === "different_link")
      return json(
        {
          error: "Disconnect the current link before adding another Watchlist.",
        },
        409,
      );
    return json(await statusFor(userId));
  } catch {
    return json(
      {
        error:
          "The Watchlist connection could not be checked. Your saved films have not been removed.",
      },
      503,
    );
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const env = (name: string) => Deno.env.get(name) || "";
const appUrl = env("APP_URL");
const clientId = env("SPOTIFY_CLIENT_ID");
const clientSecret = env("SPOTIFY_CLIENT_SECRET");
const redirectUri = env("SPOTIFY_REDIRECT_URI");
const encryptionKey = env("SPOTIFY_TOKEN_KEY");
const configured = Boolean(
  clientId && clientSecret && redirectUri && encryptionKey && appUrl,
);
const origin = appUrl ? new URL(appUrl).origin : "";
const admin = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const encoder = new TextEncoder();
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unbase64 = (text: string) =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
const random = () =>
  base64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
const sha256 = async (value: string) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
const hash = async (value: string) => base64(await sha256(value));

async function seal(value: unknown) {
  const key = await crypto.subtle.importKey(
    "raw",
    unbase64(encryptionKey),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return `${base64(iv)}.${base64(new Uint8Array(ciphertext))}`;
}
async function open<T>(box: string): Promise<T> {
  const [iv, data] = box.split(".");
  const key = await crypto.subtle.importKey(
    "raw",
    unbase64(encryptionKey),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unbase64(iv) },
    key,
    unbase64(data),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

const headers = {
  "Access-Control-Allow-Origin": origin,
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

class ProviderError extends Error {
  constructor(public status: number) {
    super("Spotify request failed");
  }
}
async function spotify(path: string, accessToken: string) {
  const response = await fetch(`https://api.spotify.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(12000),
    redirect: "error",
  });
  if (!response.ok) throw new ProviderError(response.status);
  return response.status === 204 ? null : await response.json();
}
async function exchange(params: URLSearchParams) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(12000),
    redirect: "error",
  });
  if (!response.ok) throw new ProviderError(response.status);
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}
interface Tokens {
  access: string;
  refresh: string;
  expires: number;
}
async function account(userId: string) {
  const result = await admin
    .from("spotify_accounts")
    .select("token_box, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error("Account lookup failed");
  if (!result.data) return null;
  let tokens = await open<Tokens>(result.data.token_box);
  if (tokens.expires < Date.now() + 60_000) {
    const fresh = await exchange(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh,
        client_id: clientId,
      }),
    );
    tokens = {
      access: fresh.access_token,
      refresh: fresh.refresh_token || tokens.refresh,
      expires: Date.now() + fresh.expires_in * 1000,
    };
    const saved = await admin
      .from("spotify_accounts")
      .update({
        token_box: await seal(tokens),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (saved.error) throw new Error("Token refresh could not be saved");
  }
  return { tokens, name: result.data.display_name };
}
const isMember = async (userId: string) => {
  const { data, error } = await admin
    .from("room_members")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Membership lookup failed");
  return Boolean(data);
};
const track = (item: any) =>
  item?.id &&
  item?.name &&
  item?.external_urls?.spotify?.startsWith("https://open.spotify.com/")
    ? {
        id: item.id,
        title: item.name,
        creator: (item.artists ?? [])
          .map((artist: { name: string }) => artist.name)
          .join(", "),
        url: item.external_urls.spotify,
        image: item.album?.images?.[0]?.url,
      }
    : null;
const savedSong = (item: any) => {
  const base = track(item?.track || item?.item);
  const addedAt = item?.added_at;
  const album = item?.track?.album?.name || item?.item?.album?.name;
  const releaseDate =
    item?.track?.album?.release_date || item?.item?.album?.release_date;
  const releaseYear =
    typeof releaseDate === "string" && /^\d{4}/.test(releaseDate)
      ? Number(releaseDate.slice(0, 4))
      : null;
  if (
    !base ||
    typeof addedAt !== "string" ||
    !Number.isFinite(Date.parse(addedAt)) ||
    typeof album !== "string" ||
    album.length > 240 ||
    (releaseYear !== null &&
      (!Number.isInteger(releaseYear) ||
        releaseYear < 1000 ||
        releaseYear > 9999))
  )
    return null;
  return {
    ...base,
    addedAt: new Date(addedAt).toISOString(),
    album,
    releaseYear,
  };
};
const escaped = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const callbackPage = (ok: boolean) =>
  new Response(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>For Nooshin · Spotify</title><body style="background:#1b1320;color:#f1e7dc;font-family:Georgia,serif;padding:40px;line-height:1.7"><h1>${ok ? "Your Spotify is connected." : "That connection didn’t finish."}</h1><p>${ok ? "You can close this tab and return to your music." : "No new connection was saved. Close this tab and try again from your music page."}</p><a style="color:#e2c5bd" href="${escaped(appUrl)}">Back to For Nooshin</a></body></html>`,
    {
      status: ok ? 200 : 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );

async function callback(url: URL) {
  if (!configured) return callbackPage(false);
  const state = url.searchParams.get("state");
  if (!state || state.length > 200) return callbackPage(false);
  // Claim once before exchange. Keep the row so disconnect can cancel it before commit.
  const stateKey = await hash(state);
  const stored = await admin
    .from("spotify_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("state_hash", stateKey)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("user_id, verifier_box")
    .maybeSingle();
  if (stored.error || !stored.data) return callbackPage(false);
  const code = url.searchParams.get("code");
  if (
    !code ||
    code.length > 2000 ||
    url.searchParams.has("error") ||
    !(await isMember(stored.data.user_id))
  )
    return callbackPage(false);
  const verifier = await open<string>(stored.data.verifier_box);
  const token = await exchange(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }),
  );
  if (!token.refresh_token || !token.access_token) return callbackPage(false);
  const profile = await spotify("me", token.access_token);
  if (!profile?.id) return callbackPage(false);
  // The profile is fetched from Spotify, never supplied by the browser.
  const result = await admin.rpc("complete_spotify_link", {
    state_key: stateKey,
    provider_id: profile.id,
    provider_name: profile.display_name || profile.id,
    encrypted_tokens: await seal({
      access: token.access_token,
      refresh: token.refresh_token,
      expires: Date.now() + token.expires_in * 1000,
    }),
  });
  return callbackPage(!result.error && result.data === true);
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname.endsWith("/callback")) {
    try {
      return await callback(url);
    } catch {
      return callbackPage(false);
    }
  }
  if (!origin || request.headers.get("Origin") !== origin)
    return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer "))
    return json({ error: "Sign in required" }, 401);
  let userId = "";
  try {
    const verified = await admin.auth.getUser(authorization.slice(7));
    if (verified.error || !verified.data.user)
      return json({ error: "Sign in required" }, 401);
    userId = verified.data.user.id;
    if (!(await isMember(userId)))
      return json({ error: "Room invitation required" }, 403);
    if (Number(request.headers.get("content-length") || "0") > 4096)
      return json({ error: "Request too large" }, 413);
    const payload = await request.text();
    if (payload.length > 4096) return json({ error: "Request too large" }, 413);
    const body = JSON.parse(payload);
    const { action } = body;
    if (action === "status" && !configured)
      return json({ configured: false, connected: false });
    if (!configured) return json({ error: "Spotify setup needed" }, 503);
    if (action === "authorize") {
      await admin
        .from("spotify_states")
        .delete()
        .lt("expires_at", new Date().toISOString());
      const recent = await admin
        .from("spotify_states")
        .select("state_hash", { count: "exact", head: true })
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString());
      if (recent.error) throw new Error("Could not start authorization");
      if ((recent.count || 0) >= 5)
        return json({ error: "Please wait before trying again" }, 429);
      const state = random();
      const verifier = random();
      const result = await admin.from("spotify_states").insert({
        state_hash: await hash(state),
        user_id: userId,
        verifier_box: await seal(verifier),
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      });
      if (result.error) throw new Error("Could not save authorization state");
      const authorize = new URL("https://accounts.spotify.com/authorize");
      authorize.search = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        code_challenge_method: "S256",
        code_challenge: base64(await sha256(verifier))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, ""),
        scope:
          "user-read-currently-playing user-read-recently-played user-library-read playlist-read-private user-read-private",
      }).toString();
      return json({ url: authorize.href });
    }
    if (action === "disconnect") {
      const states = await admin
        .from("spotify_states")
        .delete()
        .eq("user_id", userId);
      if (states.error) throw new Error("Disconnect failed");
      const account = await admin
        .from("spotify_accounts")
        .delete()
        .eq("user_id", userId);
      if (account.error) throw new Error("Disconnect failed");
      return json({ connected: false });
    }
    if (!["status", "listening", "liked"].includes(action))
      return json({ error: "Unknown action" }, 400);
    const linked = await account(userId);
    if (!linked)
      return action === "status"
        ? json({ configured: true, connected: false })
        : json({ error: "Connect Spotify first" }, 409);
    if (action === "status") {
      const profile = await spotify("me", linked.tokens.access);
      return json({
        configured: true,
        connected: Boolean(profile?.id),
        name: profile?.display_name || profile?.id,
      });
    }
    if (action === "liked") {
      const offset = Number(body.offset ?? 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 50_000)
        return json({ error: "Invalid Spotify page" }, 400);
      // Saved Tracks supports limit/offset and caps pages at 50.
      // Source: https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks
      const page = await spotify(
        `me/tracks?limit=50&offset=${offset}`,
        linked.tokens.access,
      );
      const total = Number(page?.total);
      if (
        !Number.isInteger(total) ||
        total < 0 ||
        total > 50_000 ||
        !Array.isArray(page?.items) ||
        page.items.length > 50
      )
        return json({ error: "Spotify library is too large or changed" }, 502);
      const songs = page.items
        .map((item: any) => savedSong(item))
        .filter(Boolean);
      if (songs.length !== page.items.length)
        return json({ error: "Spotify returned an unreadable song" }, 502);
      const nextOffset = page.next ? offset + page.items.length : null;
      if (page.next && (!page.items.length || nextOffset! > total))
        return json({ error: "Spotify pagination changed" }, 502);
      return json({ songs, offset, total, nextOffset });
    }
    const [current, recent, liked, playlists] = await Promise.all([
      spotify("me/player/currently-playing", linked.tokens.access),
      spotify("me/player/recently-played?limit=10", linked.tokens.access),
      spotify("me/tracks?limit=10", linked.tokens.access),
      spotify("me/playlists?limit=10", linked.tokens.access),
    ]);
    return json({
      current: current?.is_playing ? track(current.item) : null,
      recent: (recent?.items ?? [])
        .map((item: any) => track(item.track))
        .filter(Boolean),
      liked: (liked?.items ?? [])
        .map((item: any) => track(item.track || item.item))
        .filter(Boolean),
      playlists: (playlists?.items ?? [])
        .filter((item: any) =>
          item?.external_urls?.spotify?.startsWith("https://open.spotify.com/"),
        )
        .map((item: any) => ({
          id: item.id,
          title: item.name,
          url: item.external_urls.spotify,
          image: item.images?.[0]?.url,
        })),
    });
  } catch (error) {
    if (
      error instanceof ProviderError &&
      [400, 401].includes(error.status) &&
      userId
    ) {
      await admin.from("spotify_accounts").delete().eq("user_id", userId);
      return json(
        {
          configured: true,
          connected: false,
          error: "Reconnect Spotify to continue",
        },
        401,
      );
    }
    // Never return or log request headers, codes, tokens, or provider error bodies.
    return json({ error: "Spotify is temporarily unavailable" }, 502);
  }
});

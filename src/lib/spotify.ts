import { useCallback, useEffect, useState } from "react";
import { djangoRequest } from "./django";
import type { SpotifySong } from "./spotify-library";

export interface SpotifyStatus {
  configured: boolean;
  connected: boolean;
  name?: string;
  /** Non-secret setup details, returned only to the room owner. */
  setupIssues?: string[];
  redirectUris?: string[];
}
export interface Track {
  id: string;
  title: string;
  creator: string;
  url: string;
  image?: string;
}
export interface Listening {
  current: Track | null;
  recent: Track[];
  liked: Track[];
  playlists: { id: string; title: string; url: string; image?: string }[];
}
export interface SpotifyLikedPage {
  songs: SpotifySong[];
  offset: number;
  total: number;
  nextOffset: number | null;
}
export async function spotifyRequest<T>(
  action: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const routes: Record<string, string> = {
    status: "/api/spotify/status/",
    authorize: "/api/spotify/authorize/",
    disconnect: "/api/spotify/disconnect/",
    listening: "/api/spotify/listening/",
    liked: "/api/spotify/liked/",
  };
  const route = routes[action];
  if (!route) throw new Error("Spotify action is not available.");
  const query =
    action === "liked" && Number.isInteger(input.offset)
      ? `?offset=${input.offset}`
      : action === "authorize"
        ? `?host=${encodeURIComponent(location.host)}`
        : "";
  return djangoRequest<T>(`${route}${query}`, {
    method: ["disconnect"].includes(action) ? "POST" : "GET",
    headers:
      action === "authorize" ? { "X-Spotify-Host": location.host } : undefined,
  });
}
export function useSpotify() {
  const [status, setStatus] = useState<SpotifyStatus>({
    configured: false,
    connected: false,
  });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await spotifyRequest<SpotifyStatus>("status"));
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  const connect = async () => {
    if (!status.configured) {
      setError(
        "Spotify needs to be set up for this site before you can sign in.",
      );
      return;
    }
    const popup = window.open(
      "about:blank",
      "control-room-spotify",
      "width=520,height=760",
    );
    setBusy(true);
    setError("");
    try {
      const { url } = await spotifyRequest<{ url: string }>("authorize");
      if (new URL(url).origin !== "https://accounts.spotify.com")
        throw new Error("Could not start the connection.");
      if (popup) popup.location.replace(url);
      else setError("Allow pop-ups for this site, then connect again.");
    } catch (failure) {
      popup?.close();
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await spotifyRequest("disconnect");
      await refresh();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { status, error, busy, refresh, connect, disconnect };
}

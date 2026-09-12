import { ArrowUpRight, Headphones, LogOut } from "lucide-react";
import { useRoom } from "../lib/room-context";
import { useSpotify } from "../lib/spotify";
import { ImdbConnectionCard } from "./ImdbConnection";
import { SpotifyConnectButton } from "./SpotifyConnectButton";
import { useSpotifyLibrarySyncState } from "../lib/spotify-sync";

export function Connections() {
  const { local, member, signOut } = useRoom();
  const spotify = useSpotify();
  const librarySync = useSpotifyLibrarySyncState();
  return (
    <div className="connections-page">
      <div className="page-title">
        <span className="eyebrow">THE DOORS INTO YOUR WORLDS</span>
        <h1>
          The things you <em>bring with you.</em>
        </h1>
      </div>
      <section className="setting-row">
        <Headphones size={24} strokeWidth={1.5} />
        <div>
          <h2>The songs you bring with you</h2>
          <p>
            {spotify.busy
              ? "Checking your account…"
              : spotify.error
                ? "Could not check your connection."
                : spotify.status.connected
                  ? `Connected to ${spotify.status.name || "your account"}.`
                  : !spotify.status.configured
                    ? "Spotify hasn’t found its way into this little place yet."
                    : "Let me see the songs that have been keeping you company."}
          </p>
          {spotify.error && (
            <p className="form-error" role="status">
              {spotify.error}
            </p>
          )}
          {spotify.status.connected && librarySync.phase !== "idle" && (
            <small role={librarySync.phase === "error" ? "alert" : "status"}>
              {librarySync.phase === "syncing"
                ? `Adding liked songs… ${librarySync.added.toLocaleString()} added${librarySync.total ? ` · ${librarySync.total.toLocaleString()} in Spotify` : ""}`
                : librarySync.message}
            </small>
          )}
        </div>
        {spotify.error ? (
          <button
            className="button secondary"
            onClick={() => void spotify.refresh()}
            disabled={spotify.busy}
          >
            Try again
          </button>
        ) : spotify.status.connected ? (
          <button
            className="button secondary"
            onClick={() => void spotify.disconnect()}
            disabled={spotify.busy}
          >
            Disconnect
            <ArrowUpRight size={16} />
          </button>
        ) : (
          <SpotifyConnectButton spotify={spotify} />
        )}
      </section>
      <ImdbConnectionCard />
      {!local && (
        <section className="setting-row">
          <LogOut size={24} strokeWidth={1.5} />
          <div>
            <h2>Your shared room, {member.display_name}</h2>
            <p>
              Only the two invited room members can read the collections and
              attachments.
            </p>
          </div>
          <button className="button secondary" onClick={() => void signOut?.()}>
            <LogOut size={16} />
            Sign out
          </button>
        </section>
      )}
    </div>
  );
}

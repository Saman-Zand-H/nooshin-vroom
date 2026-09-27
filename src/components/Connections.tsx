import { useState, type FormEvent } from "react";
import { ArrowUpRight, Headphones, KeyRound, LogOut } from "lucide-react";
import { useRoom } from "../lib/room-context";
import { useSpotify } from "../lib/spotify";
import { DjangoApiError, djangoAuth } from "../lib/django";
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
      {!local && <ChangePasswordRow />}
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

function ChangePasswordRow() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    const confirm = String(data.get("confirm"));
    if (password !== confirm) {
      setError("The two passwords don’t match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await djangoAuth.changePassword(
        String(data.get("current")),
        password,
        confirm,
      );
      setOpen(false);
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof DjangoApiError
          ? cause.message
          : "Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="setting-row">
      <KeyRound size={24} strokeWidth={1.5} />
      <div>
        <h2>Your key to the room</h2>
        <p>Choose a new password whenever you like; the room stays yours.</p>
        {saved && !open && <small role="status">Password updated.</small>}
        {open && (
          <form className="setting-form" onSubmit={submit}>
            <label>
              Current password
              <input
                type="password"
                name="current"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                name="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                name="confirm"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="setting-form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Save password"}
              </button>
            </div>
          </form>
        )}
      </div>
      {!open && (
        <button
          className="button secondary"
          onClick={() => {
            setOpen(true);
            setSaved(false);
          }}
        >
          Change password
        </button>
      )}
    </section>
  );
}

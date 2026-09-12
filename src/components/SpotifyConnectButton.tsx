import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { useRoom } from "../lib/room-context";
import type { useSpotify } from "../lib/spotify";

export function SpotifyConnectButton({
  spotify,
}: {
  spotify: ReturnType<typeof useSpotify>;
}) {
  const { local, member } = useRoom();
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="button secondary"
          disabled={spotify.busy}
          onClick={(event) => {
            if (spotify.status.configured && !spotify.error) {
              event.preventDefault();
              void spotify.connect();
            }
          }}
        >
          {spotify.busy
            ? "Checking Spotify…"
            : spotify.error
              ? "Connection details"
              : spotify.status.configured
                ? "Connect Spotify"
                : "Set up Spotify"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content spotify-setup-dialog">
          <div className="dialog-heading">
            <div>
              <span className="eyebrow">A DOOR INTO YOUR MUSIC</span>
              <Dialog.Title>
                {spotify.error
                  ? "The door needs a little attention."
                  : "Your music hasn’t arrived yet."}
              </Dialog.Title>
              <Dialog.Description>
                {local
                  ? "The device preview keeps everything local. Run the Django service for a real Spotify connection."
                  : spotify.error
                    ? "We couldn’t check the music door. Try again in a moment."
                    : "This place hasn’t been linked to Spotify yet. Once it is, you can bring in the songs you’ve been listening to."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              aria-label="Close Spotify setup"
            >
              <X size={21} />
            </Dialog.Close>
          </div>
          {(local || member.role === "owner") && (
            <details className="spotify-setup-guide">
              <summary>Setup for the site owner</summary>
              {!!spotify.status.setupIssues?.length && (
                <p role="status">
                  Django is missing a valid value for:{" "}
                  {spotify.status.setupIssues.map((name, index) => (
                    <span key={name}>
                      {index > 0 ? ", " : ""}
                      <code>{name}</code>
                    </span>
                  ))}
                  .
                </p>
              )}
              <ol>
                <li>
                  Docker reads Spotify settings from the ignored root{" "}
                  <code>.env</code> file. Standalone Django reads{" "}
                  <code>backend/.env</code>. Set <code>SPOTIFY_CLIENT_ID</code>,{" "}
                  <code>SPOTIFY_CLIENT_SECRET</code>,
                  <code>SPOTIFY_REDIRECT_URI</code>, and{" "}
                  <code>SPOTIFY_TOKEN_KEY</code> there.
                </li>
                <li>
                  Register this callback in your Spotify developer app:{" "}
                  {spotify.status.redirectUris?.length
                    ? spotify.status.redirectUris.map((uri) => (
                        <code key={uri}>{uri}</code>
                      ))
                    : "the exact URL set in SPOTIFY_REDIRECT_URIS"}
                  .
                </li>
                <li>
                  After changing Docker settings, run{" "}
                  <code>docker compose --env-file .env up -d backend</code>. For
                  standalone Django, restart the server. Then check again.
                  Credentials and token encryption stay on the server.
                </li>
              </ol>
              <a
                className="text-button"
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
              >
                Spotify developer dashboard <ArrowUpRight size={15} />
              </a>
            </details>
          )}
          {!local && (
            <button
              className="button secondary"
              disabled={spotify.busy}
              onClick={() => void spotify.refresh()}
            >
              {spotify.busy ? "Checking…" : "Check again"}
            </button>
          )}
          {spotify.status.configured && !spotify.error && (
            <button
              className="button primary"
              disabled={spotify.busy}
              onClick={() => {
                setOpen(false);
                void spotify.connect();
              }}
            >
              Connect Spotify
            </button>
          )}
          <p className="helper">
            You can still save songs and Spotify links here, even before the
            connection is ready.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

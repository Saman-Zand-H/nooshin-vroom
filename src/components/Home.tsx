import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Feather,
  Music2,
  Plus,
  Sparkles,
  Ticket,
} from "lucide-react";
import { motion } from "motion/react";
import { useRoom } from "../lib/room-context";
import type { Entry, Kind } from "../lib/model";
import { Artwork } from "./Artwork";
import { RoomCorners } from "./sections/RoomCorners";
import {
  spotifyRequest,
  useSpotify,
  type Listening,
  type Track,
} from "../lib/spotify";
import { compareSpotifyEntries } from "../lib/spotify-library";

export function Home({
  onAdd,
  onEdit,
  onNavigate,
}: {
  onAdd: (kind: Kind) => void;
  onEdit: (entry: Entry) => void;
  onNavigate: (view: string) => void;
}) {
  const { entries } = useRoom();
  const spotify = useSpotify();
  const book =
    entries.find(
      (entry) => entry.kind === "book" && entry.status === "Reading",
    ) ?? entries.find((entry) => entry.kind === "book");
  const song = entries
    .filter((entry) => entry.kind === "music")
    .sort(compareSpotifyEntries)[0];
  const [likedSong, setLikedSong] = useState<Track | null>(null);
  const note = entries.find((entry) => entry.kind === "note");
  const request = entries.find(
    (entry) => entry.kind === "request" && entry.status !== "Delivered",
  );
  const wishes = entries.filter((entry) => entry.kind === "wish").slice(0, 3);
  useEffect(() => {
    let active = true;
    if (!spotify.status.connected) {
      setLikedSong(null);
      return () => {
        active = false;
      };
    }
    void spotifyRequest<Listening>("listening")
      .then((data) => {
        if (active) setLikedSong(data.liked[0] ?? null);
      })
      .catch(() => {
        if (active) setLikedSong(null);
      });
    return () => {
      active = false;
    };
  }, [spotify.status.connected]);
  const openSong = () => {
    if (likedSong) {
      window.open(likedSong.url, "_blank", "noopener,noreferrer");
    } else if (song) {
      onEdit(song);
    } else {
      onAdd("music");
    }
  };
  return (
    <div className="home-page">
      <section className="home-welcome">
        <div className="welcome-words">
          <span className="eyebrow">
            <span className="tiny-star">✧</span>your quiet room, built around
            you
          </span>
          <h1>
            <em>the girl with a world in her head.</em>
            <span className="title-star" aria-hidden="true">
              ✧
            </span>
          </h1>
          <p>
            For the stories you disappear into, the songs that find you at the
            right hour, and every brilliant little world you let me see.
          </p>
        </div>
        <div className="window-scene">
          <img
            src={`${import.meta.env.BASE_URL}art/night-window.svg`}
            alt="An illustrated moonlit window, a warm lamp, books, and a cup of tea."
            fetchPriority="high"
          />
          <span className="scene-caption">
            for everything you want to keep close.
          </span>
        </div>
      </section>
      <section className="home-objects" aria-label="Your room">
        <motion.article
          className="nightstand object"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="object-top">
            <span>
              <BookOpen size={16} />
              The book by your elbow
            </span>
            <button
              className="icon-button"
              onClick={() => onNavigate("library")}
              aria-label="Open bookshelf"
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div className="nightstand-content">
            <button
              className="nightstand-book"
              onClick={() => (book ? onEdit(book) : onAdd("book"))}
              aria-label={book ? `Open ${book.title}` : "Add your first book"}
            >
              <div className="book-behind" />
              <Artwork entry={book} kind="book" />
            </button>
            <div className="nightstand-copy">
              <span className="eyebrow">
                {book ? book.status : "A PLACE FOR YOUR STORIES"}
              </span>
              <h2 dir="auto">
                {book?.title || "Tell me what you’re reading."}
              </h2>
              <p dir="auto">
                {book?.creator || "I want to hear which world has you now."}
              </p>
              {book?.progress ? (
                <div className="progress-with-label">
                  <div className="reading-progress">
                    <span style={{ width: `${book.progress}%` }} />
                  </div>
                  <small>{book.progress}%</small>
                </div>
              ) : null}
              <button
                className="text-button"
                onClick={() => (book ? onEdit(book) : onAdd("book"))}
              >
                {book ? "Keep reading" : "Put one here"}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </motion.article>
        <motion.article
          className="record-player object"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="object-top">
            <span>
              <Music2 size={16} />
              Your liked songs
            </span>
            <button
              className="icon-button"
              onClick={() => onNavigate("listen")}
              aria-label="Open listening room"
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div className="record-body">
            <div className="record-words">
              <span className="eyebrow">
                {likedSong
                  ? "FROM SPOTIFY"
                  : song
                    ? "ADDED HERE"
                    : "SPOTIFY + YOUR SONGS"}
              </span>
              <h2 dir="auto">
                {likedSong?.title ||
                  song?.title ||
                  "What have you been playing?"}
              </h2>
              <p dir="auto">
                {likedSong?.creator ||
                  song?.creator ||
                  "Send me the one that has stayed with you."}
              </p>
              <button className="text-button" onClick={openSong}>
                {likedSong
                  ? "Open in Spotify"
                  : song
                    ? "Open song"
                    : "Leave it here"}
                <Plus size={15} />
              </button>
            </div>
            <div className="vinyl" aria-hidden="true">
              <div className="vinyl-label">
                {song && !likedSong ? (
                  <Artwork entry={song} kind="music" />
                ) : likedSong ? (
                  <span>
                    liked
                    <br />
                    <em>on Spotify</em>
                  </span>
                ) : (
                  <span>
                    side
                    <br />
                    <em>a.</em>
                  </span>
                )}
              </div>
              <span className="vinyl-hole" />
            </div>
          </div>
        </motion.article>
        <article className="paper-note">
          <div className="paper-tape" aria-hidden="true" />
          <div className="note-top">
            <Feather size={19} strokeWidth={1.3} />
            <span>
              {note ? "THINGS I WANT TO REMEMBER" : "FOR THE THOUGHTS YOU KEEP"}
            </span>
          </div>
          <button
            className="note-body"
            onClick={() => (note ? onEdit(note) : onAdd("note"))}
            aria-label={note ? `Open note: ${note.title}` : "Write a note"}
          >
            {note?.image_path || note?.image_url ? (
              <Artwork entry={note} />
            ) : null}
            <h2 className="handwritten" dir="auto">
              {note?.title || "Something I wanted you to have."}
            </h2>
            <p dir="auto">
              {note?.note ||
                "A photo, a sentence, or a thought that would make me smile."}
            </p>
          </button>
          <button
            className="text-button"
            onClick={() => (note ? onNavigate("notes") : onAdd("note"))}
          >
            {note ? "Read them all" : "Leave me one"}
            <ArrowRight size={16} />
          </button>
          <span className="paper-scribble" aria-hidden="true">
            ♡
          </span>
        </article>
        <article className="setlist-ticket object">
          <div className="object-top">
            <span>
              <Ticket size={16} />
              Songs for my hands
            </span>
            <button
              className="icon-button"
              onClick={() => onNavigate("requests")}
              aria-label="Open violin setlist"
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div className="ticket-body">
            <span className="eyebrow">
              {request ? request.status : "THE VIOLIN SETLIST"}
            </span>
            <h2 dir="auto">
              {request?.title || "What should I play for you?"}
            </h2>
            <p dir="auto">
              {request?.creator || "Tell me which song should become yours."}
            </p>
            <button
              className="text-button"
              onClick={() => (request ? onEdit(request) : onAdd("request"))}
            >
              {request ? "See the request" : "Choose one for me"}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="ticket-tear" />
          <div className="ticket-foot">
            <span>PLAYED ESPECIALLY FOR YOU</span>
            <span aria-hidden="true">♫</span>
          </div>
        </article>
        <article className="wish-drawer object">
          <div className="object-top">
            <span>
              <Sparkles size={16} />
              Little wishes
            </span>
            <button
              className="icon-button"
              onClick={() => onNavigate("vault")}
              aria-label="Open wishlist vault"
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          {wishes.length ? (
            <div className="wish-peeks">
              {wishes.map((wish) => (
                <button key={wish.id} onClick={() => onEdit(wish)}>
                  <Artwork entry={wish} />
                  <span dir="auto">{wish.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-wishes">
              <div className="wish-envelope" aria-hidden="true">
                <span>one day</span>
                <Sparkles size={17} />
              </div>
              <p>The things you stop to look at twice.</p>
            </div>
          )}
          <button className="text-button" onClick={() => onAdd("wish")}>
            Leave a little clue
            <Plus size={16} />
          </button>
        </article>
      </section>
      {!entries.length && (
        <section className="starting-points">
          <div>
            <span className="eyebrow">SOMEWHERE TO START</span>
            <h2>
              The things that make you, <em>you.</em>
            </h2>
            <p>I notice more than you think.</p>
          </div>
          <div className="favourite-links">
            <a
              href="https://open.spotify.com/search/Radiohead%20Jigsaw%20Falling%20Into%20Place"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Music2 size={20} />
              <span>
                <strong>Jigsaw Falling Into Place</strong>
                <small>Radiohead · open in Spotify</small>
              </span>
              <ArrowUpRight size={17} />
            </a>
            <a
              href="https://openlibrary.org/search?q=Six+of+Crows"
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen size={20} />
              <span>
                <strong>Six of Crows</strong>
                <small>Leigh Bardugo · find the book</small>
              </span>
              <ArrowUpRight size={17} />
            </a>
          </div>
        </section>
      )}
      <RoomCorners />
      <footer className="room-footer">
        <span>
          Always trying to know you better, make you happier, and give you love,
          always and forever
        </span>
        <button className="text-button" onClick={() => onNavigate("notes")}>
          Keep writing to me
          <Feather size={14} />
        </button>
      </footer>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  BookOpen,
  Clapperboard,
  Feather,
  Gamepad2,
  Music2,
  Sparkles,
  Ticket,
  Compass,
  Quote,
  Orbit,
} from "lucide-react";
import type { Entry, Kind } from "../lib/model";
import { useRoom } from "../lib/room-context";

const glyphs = {
  book: BookOpen,
  music: Music2,
  wish: Sparkles,
  request: Ticket,
  note: Feather,
  film: Clapperboard,
  game: Gamepad2,
  rabbit_hole: Orbit,
  movie_night: Clapperboard,
  adventure: Compass,
  lyric: Quote,
};

export function useMediaUrl(path: string | null) {
  const { store } = useRoom();
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let current: string | undefined;
    const release = () => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
    };
    const read = async () => {
      if (!path) {
        setUrl(undefined);
        return;
      }
      try {
        const next = await store.mediaUrl(path);
        if (!active) {
          if (next.startsWith("blob:")) URL.revokeObjectURL(next);
          return;
        }
        release();
        current = next;
        setUrl(next);
        setFailed(false);
      } catch {
        if (active) {
          setUrl(undefined);
          setFailed(true);
        }
      }
    };
    setUrl(undefined);
    setFailed(false);
    void read();
    const interval = window.setInterval(
      () => {
        void read();
      },
      55 * 60 * 1000,
    );
    return () => {
      active = false;
      clearInterval(interval);
      release();
    };
  }, [path, store]);
  return { url, failed };
}

export function Artwork({
  entry,
  kind = "book",
  className = "",
}: {
  entry?: Pick<
    Entry,
    "title" | "creator" | "kind" | "image_path" | "image_url"
  >;
  kind?: Kind;
  className?: string;
}) {
  const { url } = useMediaUrl(entry?.image_path ?? null);
  const image = url || entry?.image_url;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  const type = entry?.kind ?? kind;
  const Glyph = glyphs[type];
  return (
    <div className={`artwork art-${type} ${className}`} aria-hidden="true">
      {image && !failed ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="cover-design">
          <div className="cover-rule" />
          <span className="cover-title" dir="auto">
            {entry?.title || (type === "book" ? "The next chapter" : "")}
          </span>
          <Glyph strokeWidth={1} />
          <span className="cover-author" dir="auto">
            {entry?.creator}
          </span>
          <div className="cover-rule" />
        </div>
      )}
    </div>
  );
}

export function Recording({ entry }: { entry: Entry }) {
  const { url, failed } = useMediaUrl(entry.recording_path);
  if (failed)
    return (
      <p role="status">
        This recording could not be loaded. Try again when you’re online.
      </p>
    );
  if (!url) return <p role="status">Loading recording…</p>;
  const mediaProps = {
    controls: true,
    preload: "metadata" as const,
    src: url,
    className: "recording",
    "aria-label": `Recording of ${entry.title}`,
  };
  return entry.recording_type?.startsWith("audio/") ? (
    <audio {...mediaProps} />
  ) : (
    <video {...mediaProps} playsInline />
  );
}

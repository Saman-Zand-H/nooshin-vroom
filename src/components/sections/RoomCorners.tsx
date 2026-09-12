import {
  ArrowUpRight,
  Clapperboard,
  Compass,
  Orbit,
  Quote,
} from "lucide-react";
import { useRoom } from "../../lib/room-context";
import { routeHref } from "../../lib/routes";

export const roomCorners = [
  {
    route: "rabbit-holes",
    kind: "rabbit_hole",
    title: "Rabbit Holes",
    caption: "Show me what you’ve been curious about.",
    icon: Orbit,
  },
  {
    route: "movie-night",
    kind: "movie_night",
    title: "Watch nights",
    caption: "Films and series, alone or together.",
    icon: Clapperboard,
  },
  {
    route: "adventures",
    kind: "adventure",
    title: "Our Adventure Book",
    caption: "I want more adventures with you.",
    icon: Compass,
  },
  {
    route: "lyrics",
    kind: "lyric",
    title: "Wall of Lyrics",
    caption: "Your lyrics, just like the wall at home.",
    icon: Quote,
  },
] as const;

export function RoomCorners({ directory = false }: { directory?: boolean }) {
  const { entries } = useRoom();
  return (
    <section
      className={`room-corners ${directory ? "corners-directory" : ""}`}
      aria-label="More corners of the room"
    >
      {directory ? (
        <div className="page-title">
          <div>
            <span className="eyebrow">FOR YOU, NOOSHIN</span>
            <h1>
              More things <em>you love.</em>
            </h1>
            <p>
              Your lyric wall, your adventures, and the things you want to show
              me.
            </p>
          </div>
        </div>
      ) : (
        <div className="corners-heading">
          <span className="eyebrow">THERE’S MORE HERE</span>
          <h2>
            More things <em>you love.</em>
          </h2>
        </div>
      )}
      <div className="corners-grid">
        {roomCorners.map(({ route, kind, title, caption, icon: Icon }) => {
          const count = entries.filter((entry) => entry.kind === kind).length;
          return (
            <a
              key={route}
              href={routeHref(route)}
              className={`corner-door door-${kind}`}
            >
              <div className="corner-miniature" aria-hidden="true">
                {kind === "rabbit_hole" ? (
                  <>
                    <i />
                    <i />
                    <i />
                    <Orbit />
                  </>
                ) : kind === "movie_night" ? (
                  <>
                    <span className="mini-screen">
                      <Clapperboard size={26} strokeWidth={1} />
                    </span>
                    <span className="mini-seats">PLAY</span>
                  </>
                ) : kind === "adventure" ? (
                  <span className="mini-adventure-book">
                    MY
                    <br />
                    <strong>ADVENTURE</strong>
                    <br />
                    BOOK
                    <Compass size={24} strokeWidth={1} />
                  </span>
                ) : (
                  <>
                    <span className="mini-lyric-slip handwritten">
                      words
                      <br />
                      that stay
                    </span>
                    <Quote size={17} />
                  </>
                )}
              </div>
              <div className="corner-copy">
                <h3>
                  <Icon size={15} />
                  {title}
                </h3>
                <p>{caption}</p>
                <span>
                  {count ? `${count} saved` : "Open"}
                  <ArrowUpRight size={16} />
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

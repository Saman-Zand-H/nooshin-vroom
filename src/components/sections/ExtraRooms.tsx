import { useEffect, useRef } from "react";
import { AdventureBook } from "./AdventureBook";
import { LyricWall } from "./LyricWall";
import { MovieNight } from "./MovieNight";
import { RabbitHoles } from "./RabbitHoles";
import { RoomCorners, roomCorners } from "./RoomCorners";
import type { SectionActions } from "./section-actions";
import { routeHref } from "../../lib/routes";

export default function ExtraRooms({
  view,
  ...actions
}: { view: string } & SectionActions) {
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = menu.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active)
      nav.scrollLeft +=
        active.getBoundingClientRect().left -
        nav.getBoundingClientRect().left -
        (nav.clientWidth - active.clientWidth) / 2;
  }, [view]);
  return (
    <div className="extra-rooms">
      {view !== "explore" && (
        <nav className="room-section-nav" aria-label="More rooms" ref={menu}>
          <a href={routeHref("explore")}>All corners</a>
          {roomCorners.map((corner) => (
            <a
              key={corner.route}
              href={routeHref(corner.route)}
              aria-current={view === corner.route ? "page" : undefined}
            >
              {corner.title}
            </a>
          ))}
        </nav>
      )}
      {view === "rabbit-holes" ? (
        <RabbitHoles {...actions} />
      ) : view === "movie-night" ? (
        <MovieNight {...actions} />
      ) : view === "adventures" ? (
        <AdventureBook {...actions} />
      ) : view === "lyrics" ? (
        <LyricWall {...actions} />
      ) : (
        <RoomCorners directory />
      )}
    </div>
  );
}

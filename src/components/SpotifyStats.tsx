import { useMemo } from "react";
import {
  CalendarHeart,
  Disc3,
  Headphones,
  LibraryBig,
  Users,
} from "lucide-react";
import type { Entry } from "../lib/model";
import {
  compareSpotifyEntries,
  spotifyIdFromLink,
} from "../lib/spotify-library";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long" });
const months = Array.from({ length: 12 }, (_, month) => ({
  month,
  label: monthFormat.format(new Date(2020, month, 1)),
}));

function artists(entry: Entry) {
  return entry.creator
    .split(",")
    .map((artist) => artist.trim())
    .filter(Boolean);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Added here";
  return `saved ${dateFormat.format(new Date(value))}`;
}

function spanLabel(newest: string, oldest: string) {
  const days = Math.max(
    0,
    Math.round((Date.parse(newest) - Date.parse(oldest)) / 86_400_000),
  );
  if (days < 30) return `${days || 1} ${days === 1 ? "day" : "days"}`;
  const years = Math.floor(days / 365.25);
  const months = Math.floor((days % 365.25) / 30.44);
  if (years) return `${years}y${months ? ` ${months}m` : ""}`;
  return `${Math.max(1, months)} months`;
}

export function SpotifyStats({ entries }: { entries: Entry[] }) {
  const stats = useMemo(() => {
    const spotifySongs = entries.filter(
      (entry) =>
        entry.source_id?.startsWith("spotify:") ||
        spotifyIdFromLink(entry.link),
    );
    const artistSource = spotifySongs.length ? spotifySongs : entries;
    const artistCounts = new Map<string, number>();
    for (const entry of artistSource) {
      for (const artist of artists(entry))
        artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    }
    const artistRows = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5);
    const albumCounts = new Map<string, number>();
    for (const entry of spotifySongs) {
      if (entry.provider_album)
        albumCounts.set(
          entry.provider_album,
          (albumCounts.get(entry.provider_album) ?? 0) + 1,
        );
    }
    const albumRows = [...albumCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5);
    const releaseYears = spotifySongs
      .map((entry) => entry.provider_release_year)
      .filter((year): year is number => Number.isInteger(year));
    const decades = new Map<number, number>();
    for (const year of releaseYears) {
      const decade = Math.floor(year / 10) * 10;
      decades.set(decade, (decades.get(decade) ?? 0) + 1);
    }
    const decadeRows = [...decades.entries()].sort((a, b) => b[0] - a[0]);
    const ordered = [...entries].sort(compareSpotifyEntries);
    const dated = spotifySongs
      .filter(
        (entry) =>
          entry.provider_added_at &&
          Number.isFinite(Date.parse(entry.provider_added_at)),
      )
      .sort(compareSpotifyEntries);
    const saveMonthCounts = new Map<number, number>();
    const saveYearCounts = new Map<number, number>();
    for (const entry of dated) {
      const date = new Date(entry.provider_added_at!);
      const month = date.getMonth();
      const year = date.getFullYear();
      saveMonthCounts.set(month, (saveMonthCounts.get(month) ?? 0) + 1);
      saveYearCounts.set(year, (saveYearCounts.get(year) ?? 0) + 1);
    }
    const monthRows = months
      .map(({ month, label }) => ({
        month,
        label,
        count: saveMonthCounts.get(month) ?? 0,
      }))
      .filter((row) => row.count > 0);
    const monthRowsByCount = [...monthRows].sort(
      (a, b) => b.count - a.count || a.month - b.month,
    );
    const saveYearRows = [...saveYearCounts.entries()].sort(
      (a, b) => b[1] - a[1] || b[0] - a[0],
    );
    const saveSpanDays =
      dated.length > 1
        ? Math.max(
            0,
            Math.round(
              (Date.parse(dated[0].provider_added_at!) -
                Date.parse(dated[dated.length - 1].provider_added_at!)) /
                86_400_000,
            ),
          )
        : null;
    return {
      spotifySongs,
      artistRows,
      albumRows,
      albumCount: albumCounts.size,
      releaseYears,
      decadeRows,
      ordered,
      dated,
      uniqueArtists: artistCounts.size,
      oneSongArtists: [...artistCounts.values()].filter((count) => count === 1)
        .length,
      monthRows,
      monthRowsByCount,
      saveYearRows,
      saveSpanDays,
    };
  }, [entries]);
  const newest = stats.dated[0];
  const oldest = stats.dated[stats.dated.length - 1];
  const maxArtist = stats.artistRows[0]?.[1] ?? 1;
  const maxDecade = Math.max(...stats.decadeRows.map(([, count]) => count), 1);
  const maxAlbum = Math.max(...stats.albumRows.map(([, count]) => count), 1);
  const maxMonth = Math.max(...stats.monthRows.map((row) => row.count), 1);
  const topArtist = stats.artistRows[0];
  const topAlbum = stats.albumRows[0];
  const peakMonth = stats.monthRowsByCount[0];
  const saveYears = stats.saveYearRows.length;
  const savesPerMonth =
    stats.saveSpanDays && stats.saveSpanDays > 0
      ? stats.spotifySongs.length / Math.max(1, stats.saveSpanDays / 30.44)
      : null;

  return (
    <section className="spotify-stats" aria-labelledby="spotify-stats-title">
      <div className="spotify-stats-heading">
        <div>
          <span className="eyebrow">
            <Headphones size={14} /> THE SHAPE OF YOUR SOUNDTRACK
          </span>
          <h2 id="spotify-stats-title">A few things your songs reveal.</h2>
          <p>
            Small numbers from the music you chose. The room keeps your own
            songs in the picture, too.
          </p>
        </div>
        <Disc3
          className="spotify-stats-mark"
          size={42}
          strokeWidth={1}
          aria-hidden="true"
        />
      </div>
      {!entries.length ? (
        <div className="spotify-stats-empty" role="status">
          <LibraryBig size={24} strokeWidth={1.2} />
          <p>
            Once you save a few songs, their little patterns will show up here.
          </p>
        </div>
      ) : (
        <>
          <div className="spotify-stat-cards">
            <article>
              <span>SONGS IN YOUR ROOM</span>
              <strong>{entries.length.toLocaleString()}</strong>
              <small>Spotify likes and songs you added</small>
            </article>
            <article>
              <span>LIKED ON SPOTIFY</span>
              <strong>{stats.spotifySongs.length.toLocaleString()}</strong>
              <small>saved from your Spotify library</small>
            </article>
            <article>
              <span>ARTISTS IN THE MIX</span>
              <strong>{stats.uniqueArtists.toLocaleString()}</strong>
              <small>names across the songs here</small>
            </article>
            <article>
              <span>ALBUMS REMEMBERED</span>
              <strong>
                {stats.albumCount ? stats.albumCount.toLocaleString() : "—"}
              </strong>
              <small>
                {stats.albumCount
                  ? "from Spotify metadata"
                  : "Connect Spotify to fill this in"}
              </small>
            </article>
            <article>
              <span>ONE-SONG DISCOVERIES</span>
              <strong>
                {stats.spotifySongs.length
                  ? stats.oneSongArtists.toLocaleString()
                  : "—"}
              </strong>
              <small>
                {stats.spotifySongs.length
                  ? "artists you visited once"
                  : "after your Spotify library arrives"}
              </small>
            </article>
            <article>
              <span>YEARS OF SAVING</span>
              <strong>{saveYears ? saveYears.toLocaleString() : "—"}</strong>
              <small>
                {saveYears
                  ? "years represented in your likes"
                  : "from Spotify save dates"}
              </small>
            </article>
          </div>
          <div className="spotify-stats-columns">
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <Users size={18} />
                <h3>Artists you keep close</h3>
              </div>
              {stats.artistRows.length ? (
                <ol className="spotify-bars">
                  {stats.artistRows.map(([artist, count]) => (
                    <li key={artist}>
                      <div>
                        <span>{artist}</span>
                        <small>
                          {count} {count === 1 ? "song" : "songs"}
                        </small>
                      </div>
                      <span className="spotify-bar-track">
                        <i style={{ width: `${(count / maxArtist) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="spotify-stat-muted">
                  Artist names will gather here as you add songs.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <Disc3 size={18} />
                <h3>Albums with a hold on you</h3>
              </div>
              {stats.albumRows.length ? (
                <ol className="spotify-bars">
                  {stats.albumRows.map(([album, count]) => (
                    <li key={album}>
                      <div>
                        <span>{album}</span>
                        <small>
                          {count} {count === 1 ? "song" : "songs"}
                        </small>
                      </div>
                      <span className="spotify-bar-track">
                        <i style={{ width: `${(count / maxAlbum) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="spotify-stat-muted">
                  Albums will take shape after Spotify metadata arrives.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <CalendarHeart size={18} />
                <h3>The years you keep around</h3>
              </div>
              {stats.decadeRows.length ? (
                <ol className="spotify-bars decade-bars">
                  {stats.decadeRows.slice(0, 6).map(([decade, count]) => (
                    <li key={decade}>
                      <div>
                        <span>{decade}s</span>
                        <small>
                          {count} {count === 1 ? "song" : "songs"}
                        </small>
                      </div>
                      <span className="spotify-bar-track">
                        <i style={{ width: `${(count / maxDecade) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="spotify-stat-muted">
                  Release eras appear after Spotify fills in album dates.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <CalendarHeart size={18} />
                <h3>When songs find you</h3>
              </div>
              {stats.monthRows.length ? (
                <>
                  <ol className="spotify-bars month-bars">
                    {stats.monthRowsByCount.slice(0, 6).map((row) => (
                      <li key={row.month}>
                        <div>
                          <span>{row.label}</span>
                          <small>
                            {row.count} {row.count === 1 ? "save" : "saves"}
                          </small>
                        </div>
                        <span className="spotify-bar-track">
                          <i
                            style={{
                              width: `${(row.count / maxMonth) * 100}%`,
                            }}
                          />
                        </span>
                      </li>
                    ))}
                  </ol>
                  {peakMonth && (
                    <p className="spotify-stat-note">
                      Your busiest month is <em>{peakMonth.label}</em>, with{" "}
                      {peakMonth.count}{" "}
                      {peakMonth.count === 1 ? "save" : "saves"}.
                    </p>
                  )}
                </>
              ) : (
                <p className="spotify-stat-muted">
                  Your saving seasons appear when Spotify dates are available.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel spotify-latest-panel">
              <div className="spotify-panel-title">
                <Disc3 size={18} />
                <h3>The latest songs you chose</h3>
              </div>
              <ol className="spotify-latest-list">
                {stats.ordered.slice(0, 5).map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.title}</span>
                    <small>
                      {entry.creator || "Unknown artist"} ·{" "}
                      {dateLabel(entry.provider_added_at)}
                    </small>
                  </li>
                ))}
              </ol>
            </section>
            <section className="spotify-stat-panel spotify-timeline-panel">
              <div className="spotify-panel-title">
                <LibraryBig size={18} />
                <h3>The edges of your library</h3>
              </div>
              {newest && oldest ? (
                <div className="spotify-edges">
                  <div>
                    <span>NEWEST LIKE</span>
                    <strong>{newest.title}</strong>
                    <small>{dateLabel(newest.provider_added_at)}</small>
                  </div>
                  <div>
                    <span>OLDEST LIKE</span>
                    <strong>{oldest.title}</strong>
                    <small>{dateLabel(oldest.provider_added_at)}</small>
                  </div>
                  <p>
                    Your likes span{" "}
                    <em>
                      {spanLabel(
                        newest.provider_added_at!,
                        oldest.provider_added_at!,
                      )}
                    </em>{" "}
                    of your life in music.
                  </p>
                  {savesPerMonth && (
                    <p className="spotify-stat-note">
                      That’s roughly{" "}
                      <em>{savesPerMonth.toFixed(1)} songs a month</em> across
                      the span.
                    </p>
                  )}
                </div>
              ) : (
                <p className="spotify-stat-muted">
                  The timeline appears when Spotify save dates are available.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel spotify-fingerprint-panel">
              <div className="spotify-panel-title">
                <Users size={18} />
                <h3>Your listening fingerprints</h3>
              </div>
              <dl className="spotify-fingerprint-list">
                <div>
                  <dt>The artist most present</dt>
                  <dd>
                    {topArtist
                      ? `${topArtist[0]} · ${topArtist[1]} ${topArtist[1] === 1 ? "song" : "songs"}`
                      : "Waiting for a few songs"}
                  </dd>
                </div>
                <div>
                  <dt>The album you return to</dt>
                  <dd>
                    {topAlbum
                      ? `${topAlbum[0]} · ${topAlbum[1]} ${topAlbum[1] === 1 ? "song" : "songs"}`
                      : "Waiting for Spotify album details"}
                  </dd>
                </div>
                <div>
                  <dt>Small discoveries</dt>
                  <dd>
                    {stats.spotifySongs.length
                      ? `${stats.oneSongArtists} ${stats.oneSongArtists === 1 ? "artist" : "artists"} visited once`
                      : "Connect Spotify to see this"}
                  </dd>
                </div>
                <div>
                  <dt>Most active save year</dt>
                  <dd>
                    {stats.saveYearRows[0]
                      ? `${stats.saveYearRows[0][0]} · ${stats.saveYearRows[0][1]} saves`
                      : "Waiting for Spotify save dates"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

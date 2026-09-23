import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarHeart,
  Clock3,
  Disc3,
  Headphones,
  LibraryBig,
  Music4,
  Palette,
  Repeat,
  Ticket,
  Users,
} from "lucide-react";
import type { Entry } from "../lib/model";
import {
  compareSpotifyEntries,
  spotifyIdFromLink,
} from "../lib/spotify-library";
import { spotifyRequest, useSpotify, type Listening } from "../lib/spotify";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long" });
const months = Array.from({ length: 12 }, (_, month) => ({
  month,
  label: monthFormat.format(new Date(2020, month, 1)),
}));
const weekdayLabels = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const hourGroups = [
  { label: "Small hours", detail: "after midnight", from: 0, to: 6 },
  { label: "Mornings", detail: "6 to noon", from: 6, to: 12 },
  { label: "Afternoons", detail: "noon to six", from: 12, to: 18 },
  { label: "Evenings", detail: "six to midnight", from: 18, to: 24 },
];
// Her save timestamps arrive in UTC; show the patterns in her own timezone.
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const localParts = new Intl.DateTimeFormat("en-US", {
  timeZone,
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});
const stopWords = new Set([
  "the",
  "and",
  "you",
  "your",
  "yours",
  "for",
  "with",
  "from",
  "that",
  "this",
  "these",
  "those",
  "are",
  "was",
  "were",
  "not",
  "but",
  "all",
  "can",
  "will",
  "wont",
  "cant",
  "one",
  "two",
  "into",
  "out",
  "get",
  "got",
  "her",
  "his",
  "hers",
  "she",
  "him",
  "his",
  "when",
  "what",
  "who",
  "how",
  "why",
  "where",
  "its",
  "its",
  "of",
  "in",
  "on",
  "to",
  "a",
  "an",
  "my",
  "me",
  "we",
  "us",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "no",
  "yes",
  "if",
  "is",
  "at",
  "as",
  "so",
  "by",
  "or",
  "dont",
  "doesnt",
  "aint",
  "im",
  "ive",
  "id",
  "ill",
  "youre",
  "youve",
  "youll",
  "thats",
  "theres",
  "lets",
  "oh",
  "ooh",
  "la",
  "da",
  "na",
  "yeah",
  "hey",
  "part",
  "pt",
  "version",
  "feat",
  "with",
]);
const versionPatterns: { label: string; pattern: RegExp }[] = [
  { label: "Taylor’s Versions", pattern: /taylor.{0,2}s version/i },
  { label: "Remixes", pattern: /\bremix\b/i },
  { label: "Acoustic takes", pattern: /\bacoustic\b/i },
  { label: "Live recordings", pattern: /\blive\b/i },
  { label: "Sped up & slowed", pattern: /\b(sped[ -]?up|slowed)\b/i },
];

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

function durationLabel(ms: number) {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60)
    return `${totalMinutes || 1} ${totalMinutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48)
    return `${hours} ${hours === 1 ? "hour" : "hours"}${minutes ? ` ${minutes}m` : ""}`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days} ${days === 1 ? "day" : "days"}${remHours ? ` ${remHours}h` : ""}`;
}

/** Local weekday and hour for an instant, in the viewer's timezone. */
function localDayHour(value: string) {
  const parts = localParts.formatToParts(new Date(value));
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  return {
    weekday: Math.max(
      0,
      weekdayLabels.findIndex((day) => day.startsWith(weekday)),
    ),
    hour: hour === 24 ? 0 : hour,
  };
}

function monthIndex(value: string) {
  const date = new Date(value);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function monthLabelFromIndex(index: number) {
  return monthFormat.format(new Date(2020, index % 12, 1));
}

function normalizedTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function titleWords(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}']+/gu);
}

async function dominantSwatch(url: string): Promise<string | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("cover unavailable"));
      image.src = url;
    });
    const size = 14;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    const buckets = new Map<
      string,
      { weight: number; r: number; g: number; b: number }
    >();
    for (let index = 0; index < data.length; index += 4) {
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (data[index + 3] < 160) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      if (max < 28 || (max > 238 && saturation < 0.14)) continue;
      const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
      const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
      bucket.weight += 1 + saturation * 2.5;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
    let best: { weight: number; r: number; g: number; b: number } | null = null;
    for (const bucket of buckets.values())
      if (!best || bucket.weight > best.weight) best = bucket;
    if (!best || best.weight < 4) return null;
    const count = Math.max(1, Math.round(best.weight / 3));
    const channel = (value: number) =>
      Math.min(255, Math.round(value / count))
        .toString(16)
        .padStart(2, "0");
    return `#${channel(best.r)}${channel(best.g)}${channel(best.b)}`;
  } catch {
    // A tainted or missing cover simply contributes no colour.
    return null;
  }
}

function RotationPanel() {
  const spotify = useSpotify();
  const [rows, setRows] = useState<[string, number][] | null>(null);
  const [plays, setPlays] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!spotify.status.connected) return;
    let active = true;
    void spotifyRequest<Listening>("listening")
      .then((data) => {
        if (!active) return;
        const counts = new Map<string, number>();
        for (const track of data.recent)
          for (const artist of track.creator
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean))
            counts.set(artist, (counts.get(artist) ?? 0) + 1);
        setPlays(data.recent.length);
        setRows(
          [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 5),
        );
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [spotify.status.connected]);
  if (!spotify.status.connected) return null;
  const max = Math.max(...(rows ?? []).map(([, count]) => count), 1);
  return (
    <section className="spotify-stat-panel">
      <div className="spotify-panel-title">
        <Repeat size={18} />
        <h3>Your recent rotation</h3>
      </div>
      {rows?.length ? (
        <>
          <ol className="spotify-bars">
            {rows.map(([artist, count]) => (
              <li key={artist}>
                <div>
                  <span>{artist}</span>
                  <small>
                    {count} {count === 1 ? "play" : "plays"}
                  </small>
                </div>
                <span className="spotify-bar-track">
                  <i style={{ width: `${(count / max) * 100}%` }} />
                </span>
              </li>
            ))}
          </ol>
          <p className="spotify-stat-note">
            Counted from Spotify’s record of your last {plays} plays.
          </p>
        </>
      ) : (
        <p className="spotify-stat-muted">
          {failed
            ? "Spotify’s recent plays could not be reached just now."
            : "Reading your recent plays…"}
        </p>
      )}
    </section>
  );
}

function PalettePanel({ covers }: { covers: string[] }) {
  const [swatches, setSwatches] = useState<string[] | null>(null);
  const requested = useRef("");
  const key = covers.slice(0, 24).join("|");
  useEffect(() => {
    if (!key || requested.current === key) return;
    requested.current = key;
    let active = true;
    void Promise.all(covers.slice(0, 24).map((url) => dominantSwatch(url)))
      .then((colors) => {
        if (!active) return;
        const counts = new Map<string, number>();
        for (const color of colors)
          if (color) counts.set(color, (counts.get(color) ?? 0) + 1);
        setSwatches(
          [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([color]) => color),
        );
      })
      .catch(() => {
        if (active) setSwatches([]);
      });
    return () => {
      active = false;
    };
  }, [key, covers]);
  if (!key) return null;
  if (!swatches?.length) return null;
  return (
    <section className="spotify-stat-panel">
      <div className="spotify-panel-title">
        <Palette size={18} />
        <h3>The colours of your library</h3>
      </div>
      <div className="spotify-swatch-strip" aria-hidden="true">
        {swatches.map((color) => (
          <span key={color} style={{ background: color }} />
        ))}
      </div>
      <p className="spotify-stat-note">
        Drawn from the album covers your likes are wearing.
      </p>
    </section>
  );
}

export function SpotifyStats({
  entries,
  roomEntries,
}: {
  entries: Entry[];
  roomEntries: Entry[];
}) {
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

    // The weekday and hour she tends to save songs, in her own timezone.
    const weekdayCounts = new Map<number, number>();
    const hourCounts = new Map<number, number>();
    for (const entry of dated) {
      const { weekday, hour } = localDayHour(entry.provider_added_at!);
      weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
    const weekdayRows = [...weekdayLabels]
      .map((label, weekday) => ({
        label,
        weekday,
        count: weekdayCounts.get(weekday) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.weekday - b.weekday)
      .filter((row) => row.count > 0);
    const hourGroupRows = hourGroups.map((group) => ({
      ...group,
      count: [...hourCounts.entries()].reduce(
        (total, [hour, count]) =>
          hour >= group.from && hour < group.to ? total + count : total,
        0,
      ),
    }));

    // How long after release a song tends to reach her.
    const lags = dated
      .map((entry) => ({
        entry,
        lag:
          new Date(entry.provider_added_at!).getFullYear() -
          (entry.provider_release_year ?? 0),
      }))
      .filter(
        (item): item is { entry: Entry; lag: number } =>
          Number.isInteger(item.entry.provider_release_year) && item.lag >= 0,
      );
    const lagValues = lags.map((item) => item.lag).sort((a, b) => a - b);
    const averageLag = lagValues.length
      ? lagValues.reduce((total, value) => total + value, 0) / lagValues.length
      : null;
    const medianLag = lagValues.length
      ? lagValues[Math.floor(lagValues.length / 2)]
      : null;
    const patient = lags.reduce<(typeof lags)[number] | null>(
      (best, item) => (!best || item.lag > best.lag ? item : best),
      null,
    );
    const early = lags.reduce<(typeof lags)[number] | null>(
      (best, item) => (!best || item.lag < best.lag ? item : best),
      null,
    );

    // Consecutive saving months, and the quiet stretches between them.
    const monthFirstEntry = new Map<number, Entry>();
    for (const entry of dated) {
      const key = monthIndex(entry.provider_added_at!);
      if (!monthFirstEntry.has(key)) monthFirstEntry.set(key, entry);
    }
    const keys = [...monthFirstEntry.keys()].sort((a, b) => b - a);
    let longestStreak = keys.length ? 1 : 0;
    let run = 1;
    let longestQuiet = 0;
    let quietBefore = 0;
    let quietAfter = 0;
    for (let index = 1; index < keys.length; index++) {
      const gap = keys[index - 1] - keys[index];
      if (gap === 1) {
        run += 1;
        longestStreak = Math.max(longestStreak, run);
      } else {
        run = 1;
        if (gap > longestQuiet) {
          longestQuiet = gap;
          quietBefore = keys[index - 1];
          quietAfter = keys[index];
        }
      }
    }
    const quietBreaker = monthFirstEntry.get(quietAfter) ?? null;

    // Artists she came back to across different saving years.
    const artistYears = new Map<
      string,
      { years: Set<number>; count: number }
    >();
    for (const entry of dated) {
      const year = new Date(entry.provider_added_at!).getFullYear();
      for (const artist of artists(entry)) {
        const record = artistYears.get(artist) ?? {
          years: new Set<number>(),
          count: 0,
        };
        record.years.add(year);
        record.count += 1;
        artistYears.set(artist, record);
      }
    }
    const returneeRows = [...artistYears.entries()]
      .filter(([, record]) => record.years.size > 1)
      .map(([artist, record]) => ({
        artist,
        years: record.years.size,
        count: record.count,
      }))
      .sort(
        (a, b) =>
          b.years - a.years ||
          b.count - a.count ||
          a.artist.localeCompare(b.artist),
      )
      .slice(0, 5);

    // The oldest and newest recordings she keeps.
    const datedByRelease = dated
      .filter((entry) => Number.isInteger(entry.provider_release_year))
      .sort(
        (a, b) =>
          (a.provider_release_year ?? 0) - (b.provider_release_year ?? 0),
      );
    const oldestRecording = datedByRelease[0] ?? null;
    const newestRelease = datedByRelease[datedByRelease.length - 1] ?? null;

    // Versions, collaborations, and the words in her titles.
    const versionRows = versionPatterns
      .map(({ label, pattern }) => ({
        label,
        count: spotifySongs.filter((entry) => pattern.test(entry.title)).length,
      }))
      .filter((row) => row.count > 0);
    const pairCounts = new Map<string, number>();
    for (const entry of artistSource) {
      const names = artists(entry);
      for (let first = 0; first < names.length; first++)
        for (let second = first + 1; second < names.length; second++) {
          const pair = [names[first], names[second]].sort().join(" + ");
          pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
        }
    }
    const collabRows = [...pairCounts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5);
    const wordCounts = new Map<string, number>();
    for (const entry of entries) {
      for (const word of titleWords(entry.title) ?? []) {
        if (word.length < 3 || stopWords.has(word)) continue;
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }
    const wordRows = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .filter(([word]) => word.length >= 3)
      .slice(0, 8);

    // The room's own corners: likes that became requests or wall lyrics.
    const musicByIdOrTitle = new Map<string, Entry>();
    for (const entry of entries) {
      const id = entry.source_id?.startsWith("spotify:")
        ? entry.source_id
        : spotifyIdFromLink(entry.link)
          ? `spotify:${spotifyIdFromLink(entry.link)}`
          : null;
      if (id) musicByIdOrTitle.set(id, entry);
      musicByIdOrTitle.set(normalizedTitle(entry.title), entry);
    }
    const requests = roomEntries.filter((entry) => entry.kind === "request");
    const requestSongs: Entry[] = [];
    for (const request of requests) {
      const id = spotifyIdFromLink(request.link)
        ? `spotify:${spotifyIdFromLink(request.link)}`
        : null;
      const match =
        (id && musicByIdOrTitle.get(id)) ||
        musicByIdOrTitle.get(normalizedTitle(request.title));
      if (match && !requestSongs.includes(match)) requestSongs.push(match);
    }
    const lyricIds = new Set(
      roomEntries
        .filter((entry) => entry.kind === "lyric")
        .map((entry) => {
          const id = spotifyIdFromLink(entry.link);
          return id ? `spotify:${id}` : null;
        })
        .filter((id): id is string => Boolean(id)),
    );
    const lyricSongs = entries.filter((entry) =>
      lyricIds.has(
        entry.source_id?.startsWith("spotify:")
          ? entry.source_id
          : `spotify:${spotifyIdFromLink(entry.link)}`,
      ),
    );

    const totalDurationMs = entries.reduce(
      (total, entry) => total + (entry.provider_duration_ms ?? 0),
      0,
    );
    const covers = entries
      .map((entry) => entry.image_url)
      .filter((url): url is string => Boolean(url));

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
      weekdayRows,
      hourGroupRows,
      averageLag,
      medianLag,
      patient,
      early,
      longestStreak,
      longestQuiet,
      quietBreaker,
      quietBefore,
      quietAfter,
      returneeRows,
      oldestRecording,
      newestRelease,
      versionRows,
      collabRows,
      wordRows,
      requestSongs,
      lyricSongs,
      totalDurationMs,
      covers,
    };
  }, [entries, roomEntries]);
  const newest = stats.dated[0];
  const oldest = stats.dated[stats.dated.length - 1];
  const maxArtist = stats.artistRows[0]?.[1] ?? 1;
  const maxDecade = Math.max(...stats.decadeRows.map(([, count]) => count), 1);
  const maxAlbum = Math.max(...stats.albumRows.map(([, count]) => count), 1);
  const maxMonth = Math.max(...stats.monthRows.map((row) => row.count), 1);
  const maxWeekday = Math.max(...stats.weekdayRows.map((row) => row.count), 1);
  const maxHourGroup = Math.max(
    ...stats.hourGroupRows.map((row) => row.count),
    1,
  );
  const maxReturnee = Math.max(
    ...stats.returneeRows.map((row) => row.count),
    1,
  );
  const maxCollab = Math.max(...stats.collabRows.map(([, count]) => count), 1);
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
            <article>
              <span>IF YOU PLAYED IT ALL</span>
              <strong className="spotify-stat-word">
                {stats.totalDurationMs
                  ? durationLabel(stats.totalDurationMs)
                  : "—"}
              </strong>
              <small>
                {stats.totalDurationMs
                  ? "listening time, end to end"
                  : "song lengths arrive with your next Spotify sync"}
              </small>
            </article>
            <article>
              <span>ON MY MUSIC STAND</span>
              <strong>
                {stats.requestSongs.length
                  ? stats.requestSongs.length.toLocaleString()
                  : "—"}
              </strong>
              <small>
                {stats.requestSongs.length
                  ? "liked songs you asked me to play"
                  : "liked songs that become violin requests"}
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
                <Users size={18} />
                <h3>When two artists meet</h3>
              </div>
              {stats.collabRows.length ? (
                <>
                  <ol className="spotify-bars">
                    {stats.collabRows.map(([pair, count]) => (
                      <li key={pair}>
                        <div>
                          <span>{pair}</span>
                          <small>
                            {count} {count === 1 ? "song" : "songs"} together
                          </small>
                        </div>
                        <span className="spotify-bar-track">
                          <i
                            style={{ width: `${(count / maxCollab) * 100}%` }}
                          />
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="spotify-stat-note">
                    The pairings that keep showing up in your credits.
                  </p>
                </>
              ) : (
                <p className="spotify-stat-muted">
                  Favourite collaborations appear once a pairing repeats.
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
                <Clock3 size={18} />
                <h3>Then and now</h3>
              </div>
              {stats.oldestRecording && stats.newestRelease ? (
                <div className="spotify-edges">
                  <div>
                    <span>OLDEST RECORDING</span>
                    <strong>{stats.oldestRecording.title}</strong>
                    <small>
                      {stats.oldestRecording.creator || "Unknown artist"} ·{" "}
                      {stats.oldestRecording.provider_release_year}
                    </small>
                  </div>
                  <div>
                    <span>NEWEST RELEASE</span>
                    <strong>{stats.newestRelease.title}</strong>
                    <small>
                      {stats.newestRelease.creator || "Unknown artist"} ·{" "}
                      {stats.newestRelease.provider_release_year}
                    </small>
                  </div>
                  <p>
                    Your shelf of sound reaches from{" "}
                    <em>{stats.oldestRecording.provider_release_year}</em> to{" "}
                    <em>{stats.newestRelease.provider_release_year}</em>.
                  </p>
                </div>
              ) : (
                <p className="spotify-stat-muted">
                  Release years appear after Spotify metadata arrives.
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
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <Clock3 size={18} />
                <h3>The days you fall for songs</h3>
              </div>
              {stats.weekdayRows.length ? (
                <>
                  <ol className="spotify-bars">
                    {stats.weekdayRows.slice(0, 7).map((row) => (
                      <li key={row.weekday}>
                        <div>
                          <span>{row.label}s</span>
                          <small>
                            {row.count} {row.count === 1 ? "save" : "saves"}
                          </small>
                        </div>
                        <span className="spotify-bar-track">
                          <i
                            style={{
                              width: `${(row.count / maxWeekday) * 100}%`,
                            }}
                          />
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="spotify-stat-note">
                    Mostly <em>{stats.weekdayRows[0].label}</em>s, in the{" "}
                    {[...stats.hourGroupRows]
                      .sort((a, b) => b.count - a.count)
                      .find((group) => group.count > 0)
                      ?.label.toLowerCase()}
                    .
                  </p>
                </>
              ) : (
                <p className="spotify-stat-muted">
                  Saving days appear when Spotify save dates are available.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <Clock3 size={18} />
                <h3>The hours music reaches you</h3>
              </div>
              {stats.hourGroupRows.some((group) => group.count > 0) ? (
                <>
                  <ol className="spotify-bars">
                    {[...stats.hourGroupRows]
                      .sort((a, b) => b.count - a.count)
                      .map((group) => (
                        <li key={group.label}>
                          <div>
                            <span>{group.label}</span>
                            <small>{group.detail}</small>
                          </div>
                          <span className="spotify-bar-track">
                            <i
                              style={{
                                width: `${(group.count / maxHourGroup) * 100}%`,
                              }}
                            />
                          </span>
                        </li>
                      ))}
                  </ol>
                  <p className="spotify-stat-note">
                    When you tap the heart, hour by hour.
                  </p>
                </>
              ) : (
                <p className="spotify-stat-muted">
                  Saving hours appear when Spotify save dates are available.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <Clock3 size={18} />
                <h3>How late songs find you</h3>
              </div>
              {stats.averageLag !== null ? (
                <dl className="spotify-fingerprint-list">
                  <div>
                    <dt>On average</dt>
                    <dd>
                      {stats.averageLag.toFixed(1)}{" "}
                      {stats.averageLag === 1 ? "year" : "years"} after release
                    </dd>
                  </div>
                  {stats.medianLag !== null && (
                    <div>
                      <dt>Typically</dt>
                      <dd>
                        {stats.medianLag}{" "}
                        {stats.medianLag === 1 ? "year" : "years"} between
                        release and your heart
                      </dd>
                    </div>
                  )}
                  {stats.patient && (
                    <div>
                      <dt>The patient wait</dt>
                      <dd>
                        {stats.patient.entry.title} · {stats.patient.lag}{" "}
                        {stats.patient.lag === 1 ? "year" : "years"} later
                      </dd>
                    </div>
                  )}
                  {stats.early && (
                    <div>
                      <dt>Caught almost new</dt>
                      <dd>
                        {stats.early.entry.title} · {stats.early.lag}{" "}
                        {stats.early.lag === 1 ? "year old" : "years old"}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="spotify-stat-muted">
                  Discovery lag appears once release years are known.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <CalendarHeart size={18} />
                <h3>Streaks and silences</h3>
              </div>
              {stats.dated.length > 1 ? (
                <dl className="spotify-fingerprint-list">
                  <div>
                    <dt>Longest saving streak</dt>
                    <dd>
                      {stats.longestStreak}{" "}
                      {stats.longestStreak === 1 ? "month" : "months"} in a row
                    </dd>
                  </div>
                  {stats.longestQuiet > 1 && (
                    <div>
                      <dt>The longest quiet</dt>
                      <dd>
                        {stats.longestQuiet - 1}{" "}
                        {stats.longestQuiet - 1 === 1 ? "month" : "months"}{" "}
                        without a new like
                      </dd>
                    </div>
                  )}
                  {stats.quietBreaker && stats.longestQuiet > 1 && (
                    <div>
                      <dt>The song that broke it</dt>
                      <dd>
                        {stats.quietBreaker.title} ·{" "}
                        {monthLabelFromIndex(stats.quietAfter)}{" "}
                        {Math.floor(stats.quietAfter / 12)}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="spotify-stat-muted">
                  Streaks appear as your saving history grows.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <Users size={18} />
                <h3>The ones that stayed</h3>
              </div>
              {stats.returneeRows.length ? (
                <>
                  <ol className="spotify-bars">
                    {stats.returneeRows.map((row) => (
                      <li key={row.artist}>
                        <div>
                          <span>{row.artist}</span>
                          <small>
                            across {row.years}{" "}
                            {row.years === 1 ? "year" : "years"} · {row.count}{" "}
                            {row.count === 1 ? "song" : "songs"}
                          </small>
                        </div>
                        <span className="spotify-bar-track">
                          <i
                            style={{
                              width: `${(row.count / maxReturnee) * 100}%`,
                            }}
                          />
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="spotify-stat-note">
                    Artists you came back to in different years of your life.
                  </p>
                </>
              ) : (
                <p className="spotify-stat-muted">
                  Return visits will show once an artist spans two saving years.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <Music4 size={18} />
                <h3>The versions you keep</h3>
              </div>
              {stats.versionRows.length ? (
                <>
                  <div className="spotify-chip-row">
                    {stats.versionRows.map((row) => (
                      <span key={row.label} className="spotify-chip">
                        {row.label} · {row.count}
                      </span>
                    ))}
                  </div>
                  <p className="spotify-stat-note">
                    The same songs, in the cuts you chose.
                  </p>
                </>
              ) : (
                <p className="spotify-stat-muted">
                  Versions you prefer will gather here.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <Music4 size={18} />
                <h3>The words that find you</h3>
              </div>
              {stats.wordRows.length ? (
                <>
                  <div className="spotify-chip-row">
                    {stats.wordRows.map(([word, count]) => (
                      <span key={word} className="spotify-chip">
                        {word} · {count}
                      </span>
                    ))}
                  </div>
                  <p className="spotify-stat-note">
                    The words that repeat across the titles you save.
                  </p>
                </>
              ) : (
                <p className="spotify-stat-muted">
                  A few songs will start to show their favourite words.
                </p>
              )}
            </section>
            <section className="spotify-stat-panel">
              <div className="spotify-panel-title">
                <Ticket size={18} />
                <h3>The room remembers</h3>
              </div>
              {stats.requestSongs.length || stats.lyricSongs.length ? (
                <dl className="spotify-fingerprint-list">
                  {stats.requestSongs.length > 0 && (
                    <div>
                      <dt>From your likes to my hands</dt>
                      <dd>
                        {stats.requestSongs
                          .slice(0, 3)
                          .map((song) => song.title)
                          .join(" · ")}
                        {stats.requestSongs.length > 3
                          ? ` and ${stats.requestSongs.length - 3} more`
                          : ""}
                      </dd>
                    </div>
                  )}
                  {stats.lyricSongs.length > 0 && (
                    <div>
                      <dt>Also on your wall</dt>
                      <dd>
                        {stats.lyricSongs.length}{" "}
                        {stats.lyricSongs.length === 1
                          ? "liked song"
                          : "liked songs"}{" "}
                        whose words you pinned
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="spotify-stat-muted">
                  When a liked song becomes a request or a lyric on your wall,
                  it shows here.
                </p>
              )}
            </section>
            <RotationPanel />
            <PalettePanel covers={stats.covers} />
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

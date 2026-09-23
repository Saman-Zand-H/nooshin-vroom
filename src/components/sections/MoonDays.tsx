import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MoonStar,
  Pencil,
  Plus,
  Scale,
} from "lucide-react";
import { useRoom } from "../../lib/room-context";
import {
  periodTitle,
  readableDate,
  type BodyDetails,
  type CycleDetails,
} from "../../lib/section-details";
import type { Entry } from "../../lib/model";
import type { SectionActions } from "./section-actions";

const DAY_MS = 86_400_000;
const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
// Her usual run, until the periods she logs say otherwise.
const USUAL_CYCLE_DAYS = 29;
const dayAnchor = (value: string) => new Date(`${value}T12:00:00`);
const isoDay = (date: Date) => date.toLocaleDateString("en-CA");
const daysBetween = (from: string, to: string) =>
  Math.round((dayAnchor(to).getTime() - dayAnchor(from).getTime()) / DAY_MS);
const shiftDay = (value: string, days: number) =>
  isoDay(new Date(dayAnchor(value).getTime() + days * DAY_MS));
const cap = (value: string) => value[0].toUpperCase() + value.slice(1);

// An open period is assumed to run the usual five days; a logged one shades
// exactly what was kept, capped at ten. A longer span reads as a whole-cycle
// record (first day → the day before the next one began), so only the period
// itself is drawn either way.
const TYPICAL_PERIOD_DAYS = 5;
const PERIOD_MAX_DAYS = 10;
// The luteal phase holds fairly steady at about two weeks, so ovulation sits
// ~14 days before the next period, whatever the cycle length.
const LUTEAL_DAYS = 14;

type PhaseKey = "menstrual" | "follicular" | "ovulation" | "luteal";
const PHASE_LABELS: Record<PhaseKey, string> = {
  menstrual: "Period days",
  follicular: "Follicular days",
  ovulation: "Around ovulation",
  luteal: "Luteal days",
};
const PHASE_LINES: Record<PhaseKey, string> = {
  menstrual: "the monthly reset, counted from the first day.",
  follicular: "the quiet build after the days, energy usually rising.",
  ovulation: "the middle of the cycle, its few most fertile days.",
  luteal: "the winding down before the next one begins.",
};
const spanOf = (details: CycleDetails) =>
  details.ended ? daysBetween(details.started, details.ended) + 1 : null;

interface Period {
  entry: Entry;
  details: CycleDetails;
}
interface WeighIn {
  entry: Entry;
  details: BodyDetails;
}

export function MoonDays({ onAdd, onEdit }: SectionActions) {
  const { entries } = useRoom();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  // Oldest first, so the days between starts read left to right.
  const periods = useMemo(
    () =>
      entries
        .filter((entry) => entry.kind === "cycle")
        .map((entry) => ({
          entry,
          details: entry.details?.type === "cycle" ? entry.details : null,
        }))
        .filter(
          (period): period is Period =>
            period.details !== null && !!period.details.started,
        )
        .sort((a, b) => a.details.started.localeCompare(b.details.started)),
    [entries],
  );
  const weighIns = useMemo(
    () =>
      entries
        .filter((entry) => entry.kind === "body")
        .map((entry) => ({
          entry,
          details: entry.details?.type === "body" ? entry.details : null,
        }))
        .filter(
          (weighIn): weighIn is WeighIn =>
            weighIn.details !== null && !!weighIn.details.weight,
        )
        .sort((a, b) =>
          b.details.measured_on.localeCompare(a.details.measured_on),
        ),
    [entries],
  );

  const today = isoDay(new Date());
  const newest = periods.at(-1);

  // A believable cycle runs 15–60 days; anything else is a gap in the record.
  const cycleLengths = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 1; i < periods.length; i++) {
      const gap = daysBetween(
        periods[i - 1].details.started,
        periods[i].details.started,
      );
      if (gap >= 15 && gap <= 60) map.set(periods[i].entry.id, gap);
    }
    return map;
  }, [periods]);

  const loggedAverage = useMemo(() => {
    const gaps = [...cycleLengths.values()].slice(-6);
    return gaps.length
      ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length)
      : null;
  }, [cycleLengths]);
  const cycleLength = loggedAverage ?? USUAL_CYCLE_DAYS;

  const expected = newest
    ? shiftDay(newest.details.started, cycleLength)
    : null;
  const cycleDay = newest
    ? Math.max(1, daysBetween(newest.details.started, today) + 1)
    : null;
  const dueIn = expected ? daysBetween(today, expected) : null;

  // Each entry shades its own days, never past today, never past ten — the
  // calendar only ever claims the period, even when the entry spans a cycle.
  const periodDays = useMemo(() => {
    const map = new Map<string, string>();
    for (const { entry, details } of periods) {
      const length = Math.min(
        spanOf(details) ?? TYPICAL_PERIOD_DAYS,
        PERIOD_MAX_DAYS,
        daysBetween(details.started, today) + 1,
      );
      for (let day = 0; day < length; day++)
        map.set(shiftDay(details.started, day), entry.id);
    }
    return map;
  }, [periods, today]);

  const expectedDays = useMemo(() => {
    if (!expected) return new Set<string>();
    return new Set(
      Array.from({ length: 5 }, (_, index) => shiftDay(expected, index)),
    );
  }, [expected]);

  const periodSpan = newest
    ? Math.min(spanOf(newest.details) ?? TYPICAL_PERIOD_DAYS, PERIOD_MAX_DAYS)
    : 0;
  const inPeriodToday = !!newest && periodDays.get(today) === newest.entry.id;
  const ovulationDay = Math.max(2, cycleLength - LUTEAL_DAYS);
  const phase: PhaseKey | null =
    cycleDay === null
      ? null
      : cycleDay <= periodSpan
        ? "menstrual"
        : Math.abs(cycleDay - ovulationDay) <= 1
          ? "ovulation"
          : cycleDay < ovulationDay
            ? "follicular"
            : "luteal";

  const pickPeriod = (entryId: string) => {
    setSelected(entryId);
    document
      .getElementById(`period-${entryId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // The wheel: day 1 sits at the top and the days run clockwise.
  const wheel = useMemo(() => {
    const size = 320;
    const center = size / 2;
    const radius = 112;
    const angleFor = (day: number) =>
      ((day - 1) / cycleLength) * 2 * Math.PI - Math.PI / 2;
    const point = (r: number, a: number) => [
      center + Math.cos(a) * r,
      center + Math.sin(a) * r,
    ];
    const ticks = [];
    for (let day = 1; day <= cycleLength; day++) {
      const a = angleFor(day);
      const iso = newest ? shiftDay(newest.details.started, day - 1) : "";
      const isPeriod = !!iso && periodDays.has(iso);
      const [x1, y1] = point(isPeriod ? radius - 9 : radius - 4, a);
      const [x2, y2] = point(isPeriod ? radius + 9 : radius + 4, a);
      ticks.push(
        <line
          key={day}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          className={isPeriod ? "wheel-tick period" : "wheel-tick"}
        />,
      );
    }
    const labels = [];
    for (let day = 1; day <= cycleLength; day += 5) {
      const [x, y] = point(radius + 27, angleFor(day));
      labels.push(
        <text key={day} x={x} y={y}>
          {day}
        </text>,
      );
    }
    const todayMarker = cycleDay
      ? (() => {
          // Past the expected length the dot waits at the wheel's end, since
          // the next cycle has not been declared by a logged start.
          const wheelDay = Math.min(cycleDay, cycleLength);
          const [x, y] = point(radius, angleFor(wheelDay));
          return <circle cx={x} cy={y} r={5.5} className="wheel-today" />;
        })()
      : null;
    // The expected window lands just past day 1 of the next round.
    const expectedArc =
      expected && !inPeriodToday
        ? (() => {
            const r = radius + 15;
            const [x1, y1] = point(r, angleFor(cycleLength + 1));
            const [x2, y2] = point(r, angleFor(cycleLength + 5));
            return (
              <path
                d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                className="wheel-expected"
              />
            );
          })()
        : null;
    // Faint phase bands under the ticks; the one she is in lights up.
    const phaseArcs = newest
      ? (() => {
          const r = radius - 26;
          const arc = (fromDay: number, toDay: number, key: PhaseKey) => {
            if (toDay <= fromDay || fromDay < 1) return null;
            const [x1, y1] = point(r, angleFor(fromDay));
            const [x2, y2] = point(r, angleFor(toDay));
            return (
              <path
                key={key}
                d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                className={`wheel-phase phase-${key}${phase === key ? " now" : ""}`}
              />
            );
          };
          return [
            arc(1, periodSpan, "menstrual"),
            arc(periodSpan + 1, ovulationDay - 2, "follicular"),
            arc(ovulationDay - 1, ovulationDay + 1, "ovulation"),
            arc(ovulationDay + 2, cycleLength, "luteal"),
          ].filter(Boolean);
        })()
      : null;
    return { size, ticks, labels, todayMarker, expectedArc, phaseArcs };
  }, [
    cycleLength,
    cycleDay,
    expected,
    newest,
    inPeriodToday,
    periodDays,
    periodSpan,
    ovulationDay,
    phase,
  ]);

  const latestWeighIn = weighIns[0];
  const previousWeighIn = weighIns[1];
  const weightChange =
    latestWeighIn && previousWeighIn
      ? Math.round(
          (Number(latestWeighIn.details.weight) -
            Number(previousWeighIn.details.weight)) *
            10,
        ) / 10
      : null;

  return (
    <div className="moon-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">THE QUIET RHYTHM</span>
          <h1>
            Moon <em>days.</em>
          </h1>
          <p>
            Your cycle, kept gently — where you are in it, how it usually runs,
            and when the next one might arrive.
          </p>
        </div>
        <button className="button primary" onClick={() => onAdd("cycle")}>
          <Plus size={17} />
          Log a period
        </button>
      </div>
      <div className="moon-hero">
        <div className="moon-wheel-wrap">
          <svg
            viewBox={`0 0 ${wheel.size} ${wheel.size}`}
            aria-hidden="true"
            className="moon-wheel"
          >
            {wheel.phaseArcs}
            {wheel.ticks}
            {wheel.labels}
            {wheel.expectedArc}
            {wheel.todayMarker}
          </svg>
          <div className="moon-wheel-center">
            <MoonStar size={22} strokeWidth={1.2} aria-hidden="true" />
            {cycleDay !== null ? (
              <>
                <strong>Day {cycleDay}</strong>
                <span>of this cycle</span>
                {phase && <em>{PHASE_LABELS[phase]}</em>}
              </>
            ) : (
              <>
                <strong>{USUAL_CYCLE_DAYS}</strong>
                <span>days, usually</span>
              </>
            )}
          </div>
        </div>
        <div className="moon-pattern">
          <p className="moon-line">
            {loggedAverage
              ? `Usually every ${loggedAverage} days, by what’s kept here.`
              : `Usually every ${USUAL_CYCLE_DAYS} days.`}
          </p>
          {phase && (
            <p className="moon-line">
              {PHASE_LABELS[phase]} — {PHASE_LINES[phase]}
            </p>
          )}
          {inPeriodToday && newest && (
            <p className="moon-line">
              The days are here — began {readableDate(newest.details.started)}.
            </p>
          )}
          {expected && !inPeriodToday && dueIn !== null && (
            <p className="moon-line">
              Next one around {readableDate(expected)}
              {dueIn > 0
                ? ` — in ${dueIn} day${dueIn === 1 ? "" : "s"}.`
                : dueIn === 0
                  ? " — expected any moment now."
                  : ` — ${-dueIn} day${dueIn === -1 ? "" : "s"} past the usual.`}
            </p>
          )}
          {!newest && (
            <p className="moon-line">
              Log a period and the wheel starts turning with you.
            </p>
          )}
          <p className="moon-legend">
            <span>
              <i className="legend-period" />
              Period
            </span>
            <span>
              <i className="legend-expected" />
              Expected
            </span>
            <span>
              <i className="legend-phase" />
              Phases
            </span>
            <span>
              <i className="legend-today" />
              Today
            </span>
          </p>
        </div>
      </div>
      <div className="moon-months">
        <button
          className="icon-button"
          aria-label="Earlier months"
          onClick={() => setMonthOffset((offset) => offset - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        {[-1, 0, 1].map((step) => (
          <MiniMonth
            key={step}
            offset={monthOffset + step}
            periodDays={periodDays}
            expectedDays={expectedDays}
            today={today}
            selected={selected}
            onPick={pickPeriod}
          />
        ))}
        <button
          className="icon-button"
          aria-label="Later months"
          onClick={() => setMonthOffset((offset) => offset + 1)}
        >
          <ChevronRight size={18} />
        </button>
        {monthOffset !== 0 && (
          <button
            className="text-button moon-today-jump"
            onClick={() => setMonthOffset(0)}
          >
            Back to this month
          </button>
        )}
      </div>
      <div className="moon-columns">
        <section className="moon-weight" aria-label="Weight">
          <div className="moon-card-head">
            <h2>
              <Scale size={16} strokeWidth={1.6} />
              Weight
            </h2>
            <button className="text-button" onClick={() => onAdd("body")}>
              <Plus size={15} />
              Log weight
            </button>
          </div>
          {latestWeighIn ? (
            <>
              <p className="moon-count">
                <strong>{latestWeighIn.details.weight} kg</strong>
                <span>
                  as of {readableDate(latestWeighIn.details.measured_on)}
                </span>
              </p>
              {weightChange !== null && previousWeighIn && (
                <p className="moon-line">
                  {weightChange === 0
                    ? `Same as ${readableDate(previousWeighIn.details.measured_on)}.`
                    : `${weightChange > 0 ? "Up" : "Down"} ${Math.abs(weightChange)} kg since ${readableDate(previousWeighIn.details.measured_on)}.`}
                </p>
              )}
              {latestWeighIn.entry.note && (
                <p className="handwritten moon-note" dir="auto">
                  {latestWeighIn.entry.note}
                </p>
              )}
              {weighIns.length > 0 && (
                <ul className="moon-weight-log">
                  {weighIns.slice(0, 6).map(({ entry, details }) => (
                    <li key={entry.id}>
                      <span>{details.weight} kg</span>
                      <small>{readableDate(details.measured_on)}</small>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${details.weight} kg`}
                        onClick={() => onEdit(entry)}
                      >
                        <Pencil size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="moon-line">
              No weigh-in kept yet — one number whenever you step on the scale.
            </p>
          )}
        </section>
        <section className="moon-history-block" aria-label="Every period kept">
          <div className="moon-card-head">
            <h2>
              <MoonStar size={16} strokeWidth={1.6} />
              Every period kept
            </h2>
          </div>
          {periods.length ? (
            <ol className="moon-history">
              {[...periods].reverse().map(({ entry, details }) => {
                const span = spanOf(details);
                // A span over ten days is a whole-cycle record, not one period.
                const onePeriod = span !== null && span <= PERIOD_MAX_DAYS;
                const cycle = cycleLengths.get(entry.id);
                return (
                  <li
                    key={entry.id}
                    id={`period-${entry.id}`}
                    className={selected === entry.id ? "selected" : ""}
                  >
                    <div>
                      <h3>{periodTitle(details)}</h3>
                      <p className="moon-meta">
                        {onePeriod
                          ? `${span} days`
                          : span === null
                            ? "Cycle still open"
                            : cycle
                              ? `${cycle}-day cycle`
                              : "Whole cycle kept"}
                        {details.flow && ` · ${cap(details.flow)}`}
                        {cycle && onePeriod && ` · ${cycle}-day cycle`}
                      </p>
                      {entry.note && (
                        <p className="handwritten moon-note" dir="auto">
                          {entry.note}
                        </p>
                      )}
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${periodTitle(details)}`}
                      onClick={() => onEdit(entry)}
                    >
                      <Pencil size={16} />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="moon-line">
              Nothing kept yet. The first period you log starts the count.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function MiniMonth({
  offset,
  periodDays,
  expectedDays,
  today,
  selected,
  onPick,
}: {
  offset: number;
  periodDays: Map<string, string>;
  expectedDays: Set<string>;
  today: string;
  selected: string | null;
  onPick: (entryId: string) => void;
}) {
  const view = new Date();
  view.setDate(1);
  view.setMonth(view.getMonth() + offset);
  const year = view.getFullYear();
  const month = view.getMonth();
  const label = new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(view);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    <div className="moon-mini">
      <h3>{label}</h3>
      <div className="moon-weekdays" aria-hidden="true">
        {weekdayLabels.map((dayLabel, index) => (
          <span key={`${dayLabel}-${index}`}>{dayLabel}</span>
        ))}
      </div>
      <div className="moon-grid">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const dayIso = `${year}-${pad(month + 1)}-${pad(day)}`;
          const periodId = periodDays.get(dayIso);
          const isExpected = !periodId && expectedDays.has(dayIso);
          const classes = [
            "moon-day",
            periodId ? "moon-period" : "",
            isExpected ? "moon-expected" : "",
            dayIso === today ? "moon-today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return periodId ? (
            <button
              key={dayIso}
              type="button"
              className={classes + (selected === periodId ? " picked" : "")}
              aria-label={`Period day, ${readableDate(dayIso)}`}
              onClick={() => onPick(periodId)}
            >
              {day}
            </button>
          ) : (
            <span key={dayIso} className={classes}>
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

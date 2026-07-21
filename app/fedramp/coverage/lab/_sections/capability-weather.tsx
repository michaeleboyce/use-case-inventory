"use client";

/**
 * CapabilityWeather — sketch 3 of 4 for /fedramp/coverage/lab.
 *
 * "Two weathers." Two stacked GitHub-contribution-style calendars over the
 * same year span (rows = years, cols = months) let the eye compare two
 * climates:
 *   - top strip "capability arriving" — a monochrome ink rain of each
 *     agency's FIRST core-AI-bearing agency-ATO (LabEvent.kind === "ato");
 *   - bottom strip "access corroborated" — the same grid in vermilion for
 *     dated corroborated rollout evidence (LabEvent.kind === "rollout").
 *
 * The whole point of the sketch: the top strip is raining for a decade
 * before the bottom strip sees its first drop. Everything is deterministic,
 * CSS-vars only, native `title` tooltips (no popover machinery), no d3.
 *
 * Partial dates bucket to the EARLIEST contained month: "YYYY" → January,
 * "YYYY-MM" → that month (see footnote).
 */

import type { LabEvent } from "../_view-model";

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
// bg-foreground / var(--stamp) with opacity 0.2/0.45/0.7/1, indexed by bucket.
const BUCKET_OPACITY = [0, 0.2, 0.45, 0.7, 1];

const GRID_TEMPLATE = "2.75rem repeat(12, 16px)";

// Narrative markers rendered between the two strips, aligned to their month
// column (1-based). The column only encodes month, so the year lives in the
// label/title — that is the story the sketch is telling.
const ANNOTATIONS: { month: number; label: string; title: string }[] = [
  { month: 11, label: "ChatGPT", title: "Nov 2022 · ChatGPT public release" },
  { month: 7, label: "AI Action Plan", title: "Jul 2025 · Federal AI Action Plan" },
];

/** Partial-tolerant parse. Returns 1-based month; "YYYY" → Jan, "YYYY-MM" → that month. */
function parseEvent(date: string): { year: number; month: number } | null {
  const parts = date.split("-");
  const year = Number.parseInt(parts[0], 10);
  if (!Number.isFinite(year)) return null;
  const month = parts[1] ? Number.parseInt(parts[1], 10) : 1;
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { year, month: 1 };
  }
  return { year, month };
}

/** Absolute month ordinal, so gaps are a simple subtraction. */
function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function monthYearLabel(index: number): string {
  const year = Math.floor(index / 12);
  const month0 = ((index % 12) + 12) % 12;
  return `${MONTH_FULL[month0]} ${year}`;
}

/** count → 4-step bucket (1..4), 0 when empty; scaled against the strip max. */
function bucketOf(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

interface StripData {
  /** `${year}-${month}` → event count. */
  counts: Map<string, number>;
  max: number;
  /** Earliest occupied month ordinal, or null when empty. */
  first: number | null;
}

function tallyStrip(events: LabEvent[], kind: LabEvent["kind"]): StripData {
  const counts = new Map<string, number>();
  let max = 0;
  let first: number | null = null;
  for (const e of events) {
    if (e.kind !== kind) continue;
    const parsed = parseEvent(e.date);
    if (!parsed) continue;
    const key = `${parsed.year}-${parsed.month}`;
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    if (next > max) max = next;
    const idx = monthIndex(parsed.year, parsed.month);
    if (first === null || idx < first) first = idx;
  }
  return { counts, max, first };
}

function Strip({
  strip,
  data,
  years,
  colorVar,
  noun,
}: {
  strip: LabEvent["kind"];
  data: StripData;
  years: number[];
  colorVar: string;
  /** tooltip noun, e.g. "first core-AI-bearing ATO" / "corroborated rollout finding". */
  noun: string;
}) {
  const label =
    strip === "ato"
      ? "capability arriving — first core-AI-bearing agency ATOs by month"
      : "access corroborated — dated rollout evidence by month";

  const children: React.ReactNode[] = [];
  // Header: empty corner + month initials.
  children.push(<div key="corner" aria-hidden />);
  for (let m = 0; m < 12; m++) {
    children.push(
      <div
        key={`h-${m}`}
        aria-hidden
        className="text-center font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground"
      >
        {MONTH_INITIALS[m]}
      </div>,
    );
  }
  // Body: one row per year.
  for (const year of years) {
    children.push(
      <div
        key={`y-${year}`}
        aria-hidden
        className="justify-self-end pr-2 font-mono text-[9px] tabular-nums leading-4 text-muted-foreground"
      >
        {year}
      </div>,
    );
    for (let m = 1; m <= 12; m++) {
      const count = data.counts.get(`${year}-${m}`) ?? 0;
      const bucket = bucketOf(count, data.max);
      const common = {
        "data-strip": strip,
        "data-year": String(year),
        "data-month": String(m),
        "data-count": String(count),
        "data-bucket": String(bucket),
      } as const;
      if (count === 0) {
        children.push(
          <div
            key={`c-${year}-${m}`}
            {...common}
            className="h-4 w-4 border border-muted-foreground/25 bg-muted/20"
          />,
        );
      } else {
        const plural = count === 1 ? noun : `${noun}s`;
        children.push(
          <div
            key={`c-${year}-${m}`}
            {...common}
            className="h-4 w-4"
            style={{ backgroundColor: colorVar, opacity: BUCKET_OPACITY[bucket] }}
            title={`${MONTH_FULL[m - 1].slice(0, 3)} ${year} — ${count} ${plural}`}
          />,
        );
      }
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div
        role="grid"
        aria-label={label}
        data-strip={strip}
        className="grid w-max"
        style={{ gridTemplateColumns: GRID_TEMPLATE, gap: "2px" }}
      >
        {children}
      </div>
    </div>
  );
}

function AnnotationBand() {
  return (
    <div className="pb-5">
      <div
        aria-hidden
        className="grid items-center"
        style={{ gridTemplateColumns: GRID_TEMPLATE, gap: "2px" }}
      >
        <div className="justify-self-end pr-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          ↕
        </div>
        {MONTH_INITIALS.map((_, i) => {
          const month = i + 1;
          const ann = ANNOTATIONS.find((a) => a.month === month);
          return (
            <div key={i} className="relative flex h-4 items-center justify-center">
              {ann && (
                <>
                  <span
                    className="h-2.5 w-2.5"
                    style={{ backgroundColor: "var(--stamp)" }}
                    title={ann.title}
                  />
                  <span
                    className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.1em]"
                    style={{ color: "var(--stamp)" }}
                  >
                    {ann.label}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CapabilityWeather({ events }: { events: LabEvent[] }) {
  const ato = tallyStrip(events, "ato");
  const rollout = tallyStrip(events, "rollout");

  // Row span: contiguous years from the first event (falling back to the
  // nominal 2012 span floor) through 2026, extended if data runs later.
  const eventYears = events
    .map((e) => parseEvent(e.date)?.year)
    .filter((y): y is number => typeof y === "number");
  const startYear = eventYears.length ? Math.min(...eventYears) : 2012;
  const endYear = Math.max(2026, ...(eventYears.length ? eventYears : [2026]));
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const gap =
    ato.first !== null && rollout.first !== null
      ? Math.floor((rollout.first - ato.first) / 12)
      : null;
  const summary =
    ato.first !== null && rollout.first !== null
      ? `first capability cell: ${monthYearLabel(ato.first)}; ` +
        `first access cell: ${monthYearLabel(rollout.first)}; ` +
        `gap: ${gap} years.`
      : ato.first !== null
        ? `first capability cell: ${monthYearLabel(ato.first)}; first access cell: none yet.`
        : "no dated capability or access evidence.";

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <div className="flex w-max flex-col gap-3">
          <Strip
            strip="ato"
            data={ato}
            years={years}
            colorVar="var(--foreground)"
            noun="agencies' first core-AI-bearing ATO"
          />
          <AnnotationBand />
          <Strip
            strip="rollout"
            data={rollout}
            years={years}
            colorVar="var(--stamp)"
            noun="corroborated rollout finding"
          />
        </div>
      </div>

      <p
        data-summary
        className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground"
      >
        {summary}
      </p>

      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        Ink strip = capability arriving (opacity buckets each month&rsquo;s count
        against the strip maximum, 4 steps). Vermilion strip = access corroborated,
        same bucketing. Partial dates bucket to the earliest contained month
        (&ldquo;YYYY&rdquo; &rarr; January, &ldquo;YYYY-MM&rdquo; &rarr; that month).
      </p>
    </div>
  );
}

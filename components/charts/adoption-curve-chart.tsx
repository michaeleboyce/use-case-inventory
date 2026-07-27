"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { ChartFrame } from "@/components/charts/chart-frame";
import type { AdoptionSeries } from "@/lib/types/adoption";

/**
 * Aligned technology-adoption curves, two selectable clocks:
 *
 *  - "tech" (default, apples-to-apples): every series is re-based to
 *    x = years since its TECHNOLOGY entered use (commercial availability /
 *    public release), and each federal mandate is marked on that same
 *    clock as a colored rule — so "when the technology came out" and
 *    "when the mandate arrived" are both visible per series, and the
 *    shrinking mandate lag (HTTPS yr ~21 → cloud yr ~5 → LLM yr 2.6)
 *    reads directly off the axis.
 *  - "mandate" (the original view): federal series re-base to their own
 *    mandate, organic series to introduction — compares post-mandate
 *    response speed. The vermilion rule marks the LLM-access mandate at
 *    yr 2.6 of the GenAI era (that pair's clock starts at ChatGPT).
 *
 * Populations differ by construction (federal .gov domains, federal users,
 * employed adults, households) — identity is carried by the legend +
 * per-series population labels, and household curves render recessively
 * in gray so they read as context, not comparanda.
 */

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/** ChatGPT release → AI Action Plan LLM-access mandate, in years. */
const GENAI_MANDATE_X =
  (Date.parse("2025-07-23") - Date.parse("2022-11-30")) / MS_PER_YEAR;

export type AdoptionClock = "tech" | "mandate";

/** The technology-introduction event backing the tech clock. */
export function introEvent(s: AdoptionSeries): { date: string; label: string } {
  return s.introduced ?? s.start;
}

/**
 * The policy-mandate event, if any: an explicit `mandate` wins (the LLM
 * pair, whose `start` is the ChatGPT release); else `start` on federal
 * series that carry `introduced` (their clock start IS the mandate).
 */
export function mandateEvent(
  s: AdoptionSeries,
): { date: string; label: string } | null {
  if (s.mandate) return s.mandate;
  if (s.driver === "federal mandate" && s.introduced) return s.start;
  return null;
}

/** Years from a series' technology introduction to its mandate. */
export function mandateXOnTechClock(s: AdoptionSeries): number | null {
  const m = mandateEvent(s);
  if (!m) return null;
  return (Date.parse(m.date) - Date.parse(introEvent(s).date)) / MS_PER_YEAR;
}

/** Short mandate names for the on-chart markers (tech clock). */
const MANDATE_SHORT: Record<string, string> = {
  "https-enforces": "M-15-13 (HTTPS)",
  "https-supports": "M-15-13 (HTTPS)",
  "piv-login": "HSPD-12 (PIV)",
  "dnssec-gov": "M-08-23 (DNSSEC)",
  "cloud-cfo-ato": "FedRAMP memo",
  "federal-llm-access": "LLM-access mandate",
  "federal-llm-access-bullish": "LLM-access mandate",
};

const SERIES_COLORS: Record<string, string> = {
  "https-enforces": "var(--chart-adoption-1)",
  "https-supports": "var(--chart-adoption-1)",
  "piv-login": "var(--chart-adoption-2)",
  "workplace-pc": "var(--chart-adoption-3)",
  "cloud-cfo-ato": "var(--chart-adoption-4)",
  "dnssec-gov": "var(--chart-adoption-5)",
  // The subject series wear the accent — same hue as the mandate marker.
  // Solid = corroborated floor; dashed = bullish (agency availability).
  "federal-llm-access": "var(--stamp)",
  "federal-llm-access-bullish": "var(--stamp)",
};
const CONTEXT_COLOR = "var(--chart-adoption-context)";
const DASHED_SERIES = new Set(["https-supports", "federal-llm-access-bullish"]);

/** Series kept out of this chart (editorial call — data + CSV keep them). */
const EXCLUDED_SERIES = new Set([
  "workplace-pc",
  "owid-internet",
  "owid-smartphone",
]);

/**
 * Short direct labels at each line's final point. null = legend-only (the
 * dashed HTTPS-supported line shares hue + endpoint with enforced; a second
 * label there collides). dy staggers series that end at similar values.
 */
const END_LABELS: Record<string, { text: string | null; dy: number }> = {
  "https-enforces": { text: "HTTPS (enforced)", dy: 4 },
  "https-supports": { text: null, dy: 0 },
  "piv-login": { text: "PIV login", dy: -8 },
  "dnssec-gov": { text: "DNSSEC (.gov)", dy: -13 },
  "workplace-pc": { text: "PC at work", dy: 0 },
  "cloud-cfo-ato": { text: "Cloud (CFO Act ATOs)", dy: -6 },
  "federal-llm-access": { text: "LLM access (floor)", dy: 10 },
  "federal-llm-access-bullish": { text: "LLM (bullish)", dy: -8 },
  "owid-computer": { text: "Computer", dy: 0 },
  "owid-internet": { text: "Internet", dy: 0 },
  "owid-smartphone": { text: "Smartphone", dy: 12 },
};

type PlottedPoint = { x: number; y: number; date: string };

function toPlotted(
  s: AdoptionSeries,
  maxYears: number | null,
  clock: AdoptionClock,
): PlottedPoint[] {
  const t0 = Date.parse(
    clock === "tech" ? introEvent(s).date : s.start.date,
  );
  return s.points
    .map((p) => ({
      x: (Date.parse(p.date) - t0) / MS_PER_YEAR,
      y: p.value,
      date: p.date,
    }))
    .filter((p) => p.x >= 0 && (maxYears == null || p.x <= maxYears));
}

/** Mandate-marker label pinned near the top of the plot; `row` staggers
 *  neighbors so close markers (cloud yr 5.3, LLM yr 2.6) don't collide. */
function markerLabel(text: string, color: string, row: number) {
  return function MarkerLabel(props: { viewBox?: { x?: number } }) {
    const x = Number(props.viewBox?.x ?? 0);
    return (
      <text
        x={x + 4}
        y={12 + row * 13}
        fill={color}
        fontSize={10}
        fontFamily="var(--font-mono, monospace)"
      >
        {text}
      </text>
    );
  };
}

/** Direct label on a series' final visible point only. */
function endLabel(text: string, color: string, total: number, dy: number) {
  return function EndLabel(props: {
    x?: number | string;
    y?: number | string;
    index?: number;
  }) {
    if (props.index !== total - 1) return null;
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    return (
      <text
        x={x + 6}
        y={y + 3 + dy}
        fill={color}
        fontSize={10}
        fontFamily="var(--font-mono, monospace)"
      >
        {text}
      </text>
    );
  };
}

export function AdoptionCurveChart({
  series,
  exportMode = false,
  initialClock = "tech",
}: {
  series: AdoptionSeries[];
  exportMode?: boolean;
  /** Which clock the chart opens on (and renders in exportMode). */
  initialClock?: AdoptionClock;
}) {
  const [clock, setClock] = React.useState<AdoptionClock>(initialClock);
  const [windowed, setWindowed] = React.useState(true);
  const [showContext, setShowContext] = React.useState(true);
  // The tech clock needs the wider frame: HTTPS data starts at yr ~21 of
  // its technology; 25y covers every federal series' full mandate story.
  const windowYears = clock === "tech" ? 25 : 12;
  const maxYears = windowed ? windowYears : null;

  const percentSeries = series.filter(
    (s) => s.unit === "percent" && !EXCLUDED_SERIES.has(s.id),
  );
  const featured = percentSeries.filter((s) => !s.id.startsWith("owid-"));
  const context = showContext
    ? percentSeries.filter((s) => s.id.startsWith("owid-"))
    : [];

  const plotted = [...context, ...featured] // context first → featured on top
    .map((s) => ({ s, pts: toPlotted(s, maxYears, clock) }))
    .filter(({ pts }) => pts.length > 1);

  // Context series that actually render in the current window (a curve with
  // ≤1 in-window point is dropped above) — gates the gray legend chip and
  // the context line of the clock key.
  const plottedContext = plotted.filter(({ s }) => s.id.startsWith("owid-"));

  const xMax = windowed
    ? windowYears
    : Math.ceil(Math.max(...plotted.flatMap(({ pts }) => pts.map((p) => p.x))));

  // Tech clock: one mandate marker per unique (introduction, mandate) pair —
  // the HTTPS pair and the LLM pair each fold to one rule. Sorted by x, with
  // label rows staggered so near neighbors don't collide.
  const mandateMarkers =
    clock === "tech"
      ? uniqueBy(
          plotted
            .map(({ s }) => s)
            .filter((s) => !s.id.startsWith("owid-"))
            .filter((s) => mandateXOnTechClock(s) != null),
          (s) => `${introEvent(s).date}|${mandateEvent(s)!.date}`,
        )
          .map((s) => ({
            x: mandateXOnTechClock(s)!,
            color: SERIES_COLORS[s.id] ?? "var(--foreground)",
            short: MANDATE_SHORT[s.id] ?? mandateEvent(s)!.label,
          }))
          .filter((m) => m.x <= xMax)
          .sort((a, b) => a.x - b.x)
      : [];

  return (
    <div className="flex flex-col gap-3">
      {exportMode ? null : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
            Clock:
          </span>
          <Button
            variant={clock === "tech" ? "default" : "outline"}
            size="sm"
            onClick={() => setClock("tech")}
            className="font-mono text-[11px]"
          >
            Since technology arrived
          </Button>
          <Button
            variant={clock === "mandate" ? "default" : "outline"}
            size="sm"
            onClick={() => setClock("mandate")}
            className="font-mono text-[11px]"
          >
            Since mandate
          </Button>
          <span className="ml-4 font-mono uppercase tracking-[0.14em] text-muted-foreground">
            Window:
          </span>
          <Button
            variant={windowed ? "default" : "outline"}
            size="sm"
            onClick={() => setWindowed(true)}
            className="font-mono text-[11px]"
          >
            First {windowYears} years
          </Button>
          <Button
            variant={!windowed ? "default" : "outline"}
            size="sm"
            onClick={() => setWindowed(false)}
            className="font-mono text-[11px]"
          >
            Full span
          </Button>
          <span className="ml-4 font-mono uppercase tracking-[0.14em] text-muted-foreground">
            Household context:
          </span>
          <Button
            variant={showContext ? "default" : "outline"}
            size="sm"
            onClick={() => setShowContext((v) => !v)}
            className="font-mono text-[11px]"
          >
            {showContext ? "Shown" : "Hidden"}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {plotted
          .filter(({ s }) => !s.id.startsWith("owid-"))
          .map(({ s }) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block w-4"
                style={
                  DASHED_SERIES.has(s.id)
                    ? { height: 0, borderTop: `2px dashed ${SERIES_COLORS[s.id]}` }
                    : { height: 2, background: SERIES_COLORS[s.id] }
                }
              />
              {s.label}
              <span className="normal-case tracking-normal text-muted-foreground/70">
                ({s.population.toLowerCase()})
              </span>
            </span>
          ))}
        {plottedContext.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-0.5 w-4"
              style={{ background: CONTEXT_COLOR }}
            />
            US households (context)
          </span>
        ) : null}
      </div>

      <ChartFrame height={380}>
        <LineChart margin={{ top: 16, right: 130, bottom: 36, left: 8 }}>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, xMax]}
            allowDuplicatedCategory={false}
            tickFormatter={(v: number) => `${v}`}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            label={{
              value:
                clock === "tech"
                  ? "Years since the technology entered use — colored rules mark each federal mandate"
                  : "Years since mandate (federal) or introduction (organic)",
              position: "insideBottom",
              offset: -22,
              fontSize: 11,
              fill: "var(--muted-foreground)",
            }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            formatter={(value) => [`${value}%`]}
            labelFormatter={(x) =>
              typeof x === "number" ? `Year ${x.toFixed(1)}` : x
            }
          />
          {clock === "mandate" ? (
            <ReferenceLine
              x={GENAI_MANDATE_X}
              stroke="var(--stamp)"
              strokeDasharray="4 4"
              label={{
                value: "Federal LLM-access mandate — yr 2.6 of GenAI",
                position: "top",
                fill: "var(--stamp)",
                fontSize: 10,
              }}
            />
          ) : null}
          {mandateMarkers.map((m, i) => (
            <ReferenceLine
              key={`${m.short}-${m.x}`}
              x={m.x}
              stroke={m.color}
              strokeDasharray="4 4"
              label={markerLabel(
                `${m.short} · yr ${m.x.toFixed(1)}`,
                m.color,
                i % 3,
              )}
            />
          ))}
          {plotted.map(({ s, pts }) => {
            const isContext = s.id.startsWith("owid-");
            const color = isContext ? CONTEXT_COLOR : SERIES_COLORS[s.id];
            const lbl = END_LABELS[s.id] ?? { text: s.label, dy: 0 };
            return (
              <Line
                key={s.id}
                data={pts}
                dataKey="y"
                name={`${s.label} — ${s.population}`}
                stroke={color}
                strokeWidth={isContext ? 1.25 : 2}
                strokeDasharray={DASHED_SERIES.has(s.id) ? "5 4" : undefined}
                strokeOpacity={isContext ? 0.75 : 1}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                label={
                  lbl.text
                    ? endLabel(lbl.text, color, pts.length, lbl.dy)
                    : undefined
                }
              />
            );
          })}
        </LineChart>
      </ChartFrame>

      {/* Clock key: the calendar events behind the axis. Tech clock: year 0
          is the technology's arrival and the mandate's calendar date + axis
          year are spelled out per series. Mandate clock: year 0 is the
          mandate (federal) or introduction (organic), with the mandate LAG
          noted. One entry per unique clock — series that share one (the
          HTTPS pair, the LLM pair) fold. */}
      <div className="border-t border-border pt-2 font-mono text-[10px] leading-[1.7] text-muted-foreground">
        <span className="uppercase tracking-[0.14em]">
          {clock === "tech"
            ? "Each technology's clock — arrival → mandate"
            : "Year 0 for each clock"}
        </span>
        <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5">
          {clock === "tech"
            ? uniqueBy(
                plotted
                  .map(({ s }) => s)
                  .filter((s) => !s.id.startsWith("owid-")),
                (s) => introEvent(s).date + introEvent(s).label,
              ).map((s) => {
                const m = mandateEvent(s);
                const mx = mandateXOnTechClock(s);
                return (
                  <li
                    key={s.id}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5"
                      style={{ background: SERIES_COLORS[s.id] ?? CONTEXT_COLOR }}
                    />
                    {monthYear(introEvent(s).date)} — {introEvent(s).label}
                    {m && mx != null ? (
                      <span className="text-muted-foreground/70">
                        · mandated {monthYear(m.date)} (yr {mx.toFixed(1)})
                      </span>
                    ) : null}
                  </li>
                );
              })
            : uniqueBy(
                plotted
                  .map(({ s }) => s)
                  .filter((s) => !s.id.startsWith("owid-")),
                (s) => `${s.start.date}|${s.start.label}`,
              ).map((s) => (
                <li
                  key={s.start.date + s.start.label}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5"
                    style={{ background: SERIES_COLORS[s.id] ?? CONTEXT_COLOR }}
                  />
                  {monthYear(s.start.date)} — {s.start.label}
                  {s.introduced && mandateLagYears(s) > 0 ? (
                    <span className="text-muted-foreground/70">
                      · mandated ~{mandateLagYears(s)}y after {s.introduced.label}
                    </span>
                  ) : null}
                </li>
              ))}
          {plottedContext.length > 0 ? (
            <li className="text-muted-foreground/70">
              context clock{plottedContext.length > 1 ? "s" : ""}:{" "}
              {plottedContext
                .map(
                  ({ s }) =>
                    `household ${s.label
                      .replace(" (US households)", "")
                      .toLowerCase()} · ${monthYear(s.start.date)}`,
                )
                .join(", ")}
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

/** First occurrence per key — folds series that share a clock/mandate. */
function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function monthYear(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole years between a technology's introduction and its mandate. */
function mandateLagYears(s: AdoptionSeries): number {
  if (!s.introduced) return 0;
  return Math.round(
    (Date.parse(s.start.date) - Date.parse(s.introduced.date)) / MS_PER_YEAR,
  );
}

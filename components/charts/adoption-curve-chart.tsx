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
 * Aligned technology-adoption curves: every series is re-based to
 * x = years since its own mandate (federal series) or introduction
 * (organic series), y = % adoption under that series' own metric.
 *
 * Populations differ by construction (federal .gov domains, federal users,
 * employed adults, households) — identity is carried by the legend +
 * per-series population labels, and household curves render recessively
 * in gray so they read as context, not comparanda.
 *
 * The vermilion reference line marks how early in the GenAI era the federal
 * LLM-access mandate arrived (ChatGPT 2022-11-30 → AI Action Plan
 * 2025-07-23 ≈ 2.6 years) — on this axis, prior mandates *start* the clock;
 * GenAI's arrived before year three.
 */

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/** ChatGPT release → AI Action Plan LLM-access mandate, in years. */
const GENAI_MANDATE_X =
  (Date.parse("2025-07-23") - Date.parse("2022-11-30")) / MS_PER_YEAR;

const SERIES_COLORS: Record<string, string> = {
  "https-enforces": "var(--chart-adoption-1)",
  "https-supports": "var(--chart-adoption-1)",
  "piv-login": "var(--chart-adoption-2)",
  "workplace-pc": "var(--chart-adoption-3)",
  "cloud-cfo-ato": "var(--chart-adoption-4)",
  // The subject series wear the accent — same hue as the mandate marker.
  // Solid = corroborated floor; dashed = bullish (agency availability).
  "federal-llm-access": "var(--stamp)",
  "federal-llm-access-bullish": "var(--stamp)",
};
const CONTEXT_COLOR = "var(--chart-adoption-context)";
const DASHED_SERIES = new Set(["https-supports", "federal-llm-access-bullish"]);

/** Series kept out of this chart (editorial call — data + CSV keep them). */
const EXCLUDED_SERIES = new Set(["workplace-pc", "owid-internet"]);

/**
 * Short direct labels at each line's final point. null = legend-only (the
 * dashed HTTPS-supported line shares hue + endpoint with enforced; a second
 * label there collides). dy staggers series that end at similar values
 * (PIV and the smartphone context line both finish ≈81%).
 */
const END_LABELS: Record<string, { text: string | null; dy: number }> = {
  "https-enforces": { text: "HTTPS (enforced)", dy: 4 },
  "https-supports": { text: null, dy: 0 },
  "piv-login": { text: "PIV login", dy: -8 },
  "workplace-pc": { text: "PC at work", dy: 0 },
  "cloud-cfo-ato": { text: "Cloud (CFO Act ATOs)", dy: -6 },
  "federal-llm-access": { text: "LLM access (floor)", dy: 10 },
  "federal-llm-access-bullish": { text: "LLM (bullish)", dy: -8 },
  "owid-computer": { text: "Computer", dy: 0 },
  "owid-internet": { text: "Internet", dy: 0 },
  "owid-smartphone": { text: "Smartphone", dy: 12 },
};

type PlottedPoint = { x: number; y: number; date: string };

function toPlotted(s: AdoptionSeries, maxYears: number | null): PlottedPoint[] {
  const t0 = Date.parse(s.start.date);
  return s.points
    .map((p) => ({
      x: (Date.parse(p.date) - t0) / MS_PER_YEAR,
      y: p.value,
      date: p.date,
    }))
    .filter((p) => p.x >= 0 && (maxYears == null || p.x <= maxYears));
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
}: {
  series: AdoptionSeries[];
  exportMode?: boolean;
}) {
  const [window12, setWindow12] = React.useState(true);
  const [showContext, setShowContext] = React.useState(true);
  const maxYears = window12 ? 12 : null;

  const percentSeries = series.filter(
    (s) => s.unit === "percent" && !EXCLUDED_SERIES.has(s.id),
  );
  const featured = percentSeries.filter((s) => !s.id.startsWith("owid-"));
  const context = showContext
    ? percentSeries.filter((s) => s.id.startsWith("owid-"))
    : [];

  const plotted = [...context, ...featured] // context first → featured on top
    .map((s) => ({ s, pts: toPlotted(s, maxYears) }))
    .filter(({ pts }) => pts.length > 1);

  const xMax = window12
    ? 12
    : Math.ceil(Math.max(...plotted.flatMap(({ pts }) => pts.map((p) => p.x))));

  return (
    <div className="flex flex-col gap-3">
      {exportMode ? null : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
            Window:
          </span>
          <Button
            variant={window12 ? "default" : "outline"}
            size="sm"
            onClick={() => setWindow12(true)}
            className="font-mono text-[11px]"
          >
            First 12 years
          </Button>
          <Button
            variant={!window12 ? "default" : "outline"}
            size="sm"
            onClick={() => setWindow12(false)}
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
        {context.length > 0 ? (
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
              value: "Years since mandate (federal) or introduction (organic)",
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

      {/* Clock key: the calendar event behind each series' year-0. The
          shared axis is years-since-start, so the actual mandate dates
          live here rather than on the axis. One entry per unique event —
          series that share a clock (the HTTPS pair, the LLM pair) fold. */}
      <div className="border-t border-border pt-2 font-mono text-[10px] leading-[1.7] text-muted-foreground">
        <span className="uppercase tracking-[0.14em]">Year 0 for each clock</span>
        <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5">
          {uniqueClocks(plotted.map(({ s }) => s)).map((s) => (
            <li key={s.start.date + s.start.label} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5"
                style={{ background: SERIES_COLORS[s.id] ?? CONTEXT_COLOR }}
              />
              {monthYear(s.start.date)} — {s.start.label}
              {s.introduced ? (
                <span className="text-muted-foreground/70">
                  · mandated ~{mandateLagYears(s)}y after {s.introduced.label}
                </span>
              ) : null}
            </li>
          ))}
          {context.length > 0 ? (
            <li className="text-muted-foreground/70">
              context clocks: household computer · Aug 1981, smartphone · Jun 2007
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

/** Featured series deduped to one entry per (start date, start label). */
function uniqueClocks(series: AdoptionSeries[]): AdoptionSeries[] {
  const seen = new Set<string>();
  return series.filter((s) => {
    if (s.id.startsWith("owid-")) return false;
    const key = `${s.start.date}|${s.start.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
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

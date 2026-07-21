/**
 * Access-trajectory slope chart: per-agency estimated share of eligible
 * staff with a general-purpose AI tool (y) over evidence dates (x), one
 * line per agency built from dated, web-corroborated anchors (running-best
 * share — see app/_view-models/access-trajectories.ts). Only agencies with
 * ≥2 dated anchors are drawn (a single finding has no trajectory); the
 * omitted count is disclosed below the chart. Identity is color (the
 * validated 7-slot --chart-cat-* palette, assigned in model order) plus a
 * direct end-label per line and a legend.
 */

"use client";

import type { ReactElement } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import type {
  AccessTrajectoriesModel,
  AccessTrajectory,
} from "@/app/_view-models/access-trajectories";

const MUTED = "var(--muted-foreground)";
const DAY = 24 * 3600 * 1000;

/** Fixed categorical assignment order — never cycled or generated. An 8th+
 *  trajectory (none today) falls back to the de-emphasis gray. */
const CAT_COLORS = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
  "var(--chart-cat-6)",
  "var(--chart-cat-7)",
];

/** One Recharts datum: an anchor flattened with its agency's identity. */
interface PlottedAnchor {
  t: number;
  share: number;
  date: string;
  tool: string | null;
  sourceTitle: string | null;
  abbr: string;
  name: string;
  color: string;
  isLast: boolean;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

const TICK_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Half-year tick marks (Jan 1 / Jul 1, UTC) covering [min, max]. */
function halfYearTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  const start = new Date(min);
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth() < 6 ? 6 : 12; // first Jul-1 or next Jan-1
  if (m === 12) {
    y += 1;
    m = 0;
  }
  for (let t = Date.UTC(y, m, 1); t <= max; ) {
    ticks.push(t);
    m += 6;
    if (m >= 12) {
      y += 1;
      m -= 12;
    }
    t = Date.UTC(y, m, 1);
  }
  return ticks;
}

type LabelSlot = "right" | "above" | "below";

/**
 * Anti-collision end-label placement. Trajectories whose final anchors sit
 * close together (share within 0.04 and dates within ~100 days of the
 * previous cluster member) form a cluster — e.g. the VA/GSA pair around
 * 70%. Within a cluster only the rightmost (latest) member labels to the
 * right (nothing sits beyond it); the rest alternate above/below their
 * dot. Isolated trajectories label to the right.
 */
function computeLabelSlots(
  trajectories: AccessTrajectory[],
): Map<string, LabelSlot> {
  const ends = trajectories
    .map((tr) => {
      const last = tr.anchors[tr.anchors.length - 1];
      return { abbr: tr.abbr, share: last.share, t: last.t };
    })
    .sort((a, b) => a.share - b.share || a.t - b.t);

  const clusters: (typeof ends)[] = [];
  for (let i = 0; i < ends.length; i++) {
    const prev = ends[i - 1];
    const cur = ends[i];
    if (
      i === 0 ||
      !prev ||
      Math.abs(cur.share - prev.share) > 0.04 ||
      Math.abs(cur.t - prev.t) > 100 * DAY
    ) {
      clusters.push([cur]);
    } else {
      clusters[clusters.length - 1].push(cur);
    }
  }

  const slots = new Map<string, LabelSlot>();
  for (const cluster of clusters) {
    const rightmost = cluster.reduce((a, b) => (b.t > a.t ? b : a));
    let alt = 0;
    for (const end of cluster) {
      if (end === rightmost) {
        slots.set(end.abbr, "right");
      } else {
        slots.set(end.abbr, alt % 2 === 0 ? "above" : "below");
        alt++;
      }
    }
  }
  return slots;
}

/** SVG shape for one anchor dot; end anchors also carry the agency label. */
function renderDot(
  cx: number | undefined,
  cy: number | undefined,
  p: PlottedAnchor | undefined,
  labelSlot: LabelSlot = "right",
): ReactElement | null {
  if (cx == null || cy == null || !p) return null;
  const r = 4;
  const labelProps =
    labelSlot === "above"
      ? { x: cx, y: cy - r - 5, textAnchor: "middle" as const, dy: undefined }
      : labelSlot === "below"
        ? { x: cx, y: cy + r + 12, textAnchor: "middle" as const, dy: undefined }
        : { x: cx + r + 4, y: cy, textAnchor: undefined, dy: "0.32em" };
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={p.color}
        stroke="var(--background)"
        strokeWidth={1.5}
      />
      {p.isLast && (
        <text
          {...labelProps}
          className="font-mono"
          fontSize={10}
          fill="var(--foreground)"
        >
          {p.abbr}
        </text>
      )}
    </g>
  );
}

export function AccessShareSlope({
  model,
  exportMode = false,
}: {
  model: AccessTrajectoriesModel;
  exportMode?: boolean;
}) {
  const { trajectories, mandateT, singleAnchorCount } = model;
  // Only agencies with a drawable trajectory (≥2 dated anchors); colors
  // follow the model's stable order (best share desc).
  const plotted = trajectories.filter((tr) => !tr.single);
  const colorByAbbr = new Map(
    plotted.map((tr, i) => [tr.abbr, CAT_COLORS[i] ?? MUTED]),
  );
  const labelSlots = computeLabelSlots(plotted);

  if (plotted.length === 0) return null;

  const allT = plotted.flatMap((tr) => tr.anchors.map((a) => a.t));
  const minT = Math.min(...allT, mandateT) - 30 * DAY;
  const maxT = Math.max(...allT, mandateT) + 75 * DAY;

  const toPlotted = (tr: AccessTrajectory): PlottedAnchor[] =>
    tr.anchors.map((a, i) => ({
      ...a,
      abbr: tr.abbr,
      name: tr.name,
      color: colorByAbbr.get(tr.abbr) ?? MUTED,
      isLast: i === tr.anchors.length - 1,
    }));

  return (
    <div className="flex flex-col gap-3">
      <ChartFrame
        height={exportMode ? 440 : 400}
        style={exportMode ? { width: 1000 } : undefined}
      >
        <ScatterChart margin={{ top: 12, right: 44, bottom: 44, left: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis
            type="number"
            dataKey="t"
            name="date"
            domain={[minT, maxT]}
            ticks={halfYearTicks(minT, maxT)}
            tickFormatter={(t: number) => TICK_FMT.format(t)}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            label={{
              value: "Evidence date",
              position: "insideBottom",
              offset: -10,
              style: { fontSize: 11, fill: "var(--muted-foreground)" },
            }}
          />
          <YAxis
            type="number"
            dataKey="share"
            name="share"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={percent}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            label={{
              value: "Est. staff with a general-purpose AI tool",
              angle: -90,
              position: "insideLeft",
              style: {
                fontSize: 11,
                fill: "var(--muted-foreground)",
                textAnchor: "middle",
              },
            }}
          />
          <ReferenceLine
            x={mandateT}
            stroke="var(--border)"
            strokeDasharray="4 4"
            label={{
              value: "LLM-access mandate",
              position: "top",
              fontSize: 9,
              fill: "var(--muted-foreground)",
              className: "font-mono",
            }}
          />
          {!exportMode && (
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const p = payload[0].payload as PlottedAnchor;
                return (
                  <div className="max-w-72 border border-border bg-popover p-2 text-xs text-popover-foreground shadow">
                    <div className="font-semibold">{p.name}</div>
                    <div className="mt-1 tabular-nums">
                      Best corroborated share as of {p.date}:{" "}
                      <span className="font-medium">{percent(p.share)}</span>
                    </div>
                    {p.tool && (
                      <div className="mt-1 text-muted-foreground">
                        {p.tool}
                      </div>
                    )}
                    {p.sourceTitle && (
                      <div className="text-muted-foreground">
                        {p.sourceTitle}
                      </div>
                    )}
                  </div>
                );
              }}
            />
          )}
          {plotted.map((tr) => (
            <Scatter
              key={tr.abbr}
              name={tr.abbr}
              data={toPlotted(tr)}
              isAnimationActive={!exportMode}
              line={{
                stroke: colorByAbbr.get(tr.abbr) ?? MUTED,
                strokeWidth: 2,
                strokeOpacity: 0.85,
              }}
              shape={(props) => {
                const payload = props.payload as PlottedAnchor | undefined;
                return (
                  renderDot(
                    props.cx,
                    props.cy,
                    payload,
                    payload ? labelSlots.get(payload.abbr) : undefined,
                  ) ?? <g />
                );
              }}
            />
          ))}
        </ScatterChart>
      </ChartFrame>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        {plotted.map((tr) => (
          <span key={tr.abbr} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-0.5 w-5"
              style={{ background: colorByAbbr.get(tr.abbr) ?? MUTED }}
            />
            {tr.abbr}
          </span>
        ))}
      </div>

      {singleAnchorCount > 0 && (
        <div className="text-[10px] font-mono text-muted-foreground">
          {singleAnchorCount} agencies with only one dated finding are not
          plotted — a single anchor has no trajectory to draw.
        </div>
      )}
    </div>
  );
}

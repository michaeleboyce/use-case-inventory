/**
 * Decoupling scatter: core-AI services in reach (x) × estimated staff access
 * share (y, 0–1 rendered as percent), for each agency. Dot area encodes
 * AI-eligible workforce; hollow dots mark tier-imputed (non-corroborated)
 * shares; stamp-red marks the story quadrant (high reach, ≤10% access).
 * Client Component — each point navigates to its agency coverage page.
 */

"use client";

import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
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
import type { DecouplingPoint } from "@/app/_view-models/frontier-access";
import { formatNumber } from "@/lib/formatting";

const MUTED = "var(--muted-foreground)";
const STAMP = "var(--stamp)";

/** The four render series, split by (emphasized × imputed). */
const SERIES: {
  key: string;
  color: string;
  hollow: boolean;
  match: (p: DecouplingPoint) => boolean;
}[] = [
  {
    key: "muted-filled",
    color: MUTED,
    hollow: false,
    match: (p) => !p.emphasized && !p.imputed,
  },
  {
    key: "muted-hollow",
    color: MUTED,
    hollow: true,
    match: (p) => !p.emphasized && p.imputed,
  },
  {
    key: "stamp-filled",
    color: STAMP,
    hollow: false,
    match: (p) => p.emphasized && !p.imputed,
  },
  {
    key: "stamp-hollow",
    color: STAMP,
    hollow: true,
    match: (p) => p.emphasized && p.imputed,
  },
];

/** Legend rows describe the encoding dimensions, not the raw four series. */
const LEGEND: { label: string; color: string; hollow: boolean }[] = [
  { label: "corroborated share", color: MUTED, hollow: false },
  { label: "IFP tier-imputed (hollow)", color: MUTED, hollow: true },
  { label: "high reach, ≤10% access", color: STAMP, hollow: false },
];

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Dot radius from AI-eligible workforce; null workforce → a neutral 4.5. */
function dotRadius(eligible: number | null): number {
  if (eligible == null) return 4.5;
  return clamp(3, 14, 0.045 * Math.sqrt(eligible));
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

type LabelSlot = "right" | "above" | "below";

/**
 * Anti-collision label placement: labeled points that sit close together in
 * data space (agencies sharing near-identical reach and share, like DOC and
 * Treasury at 98 services / ~5%) cycle through right → above → below slots
 * instead of all rendering to the right of their dot.
 */
function computeLabelSlots(points: DecouplingPoint[]): Map<string, LabelSlot> {
  const slots = new Map<string, LabelSlot>();
  const labeled = points
    .filter((p) => p.labeled)
    .sort((a, b) => a.reach - b.reach || a.share - b.share);
  const CYCLE: LabelSlot[] = ["right", "above", "below"];
  let clusterStart = 0;
  for (let i = 0; i < labeled.length; i++) {
    const prev = labeled[i - 1];
    const cur = labeled[i];
    if (
      i === 0 ||
      !prev ||
      Math.abs(cur.reach - prev.reach) > 8 ||
      Math.abs(cur.share - prev.share) > 0.08
    ) {
      clusterStart = i;
    }
    slots.set(cur.abbr, CYCLE[(i - clusterStart) % CYCLE.length]);
  }
  return slots;
}

/** SVG shape for one point; called by Recharts with resolved pixel center. */
function renderDot(
  cx: number | undefined,
  cy: number | undefined,
  p: DecouplingPoint | undefined,
  seriesColor: string,
  hollow: boolean,
  labelSlot: LabelSlot = "right",
): ReactElement | null {
  if (cx == null || cy == null || !p) return null;
  const r = dotRadius(p.eligible);
  const labelProps =
    labelSlot === "above"
      ? { x: cx, y: cy - r - 4, textAnchor: "middle" as const, dy: undefined }
      : labelSlot === "below"
        ? { x: cx, y: cy + r + 11, textAnchor: "middle" as const, dy: undefined }
        : { x: cx + r + 3, y: cy, textAnchor: undefined, dy: "0.32em" };
  return (
    <g opacity={p.noAssessment ? 0.45 : 1}>
      {hollow ? (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="var(--background)"
          stroke={seriesColor}
          strokeWidth={1.5}
        />
      ) : (
        <circle cx={cx} cy={cy} r={r} fill={seriesColor} fillOpacity={0.85} />
      )}
      {p.labeled && (
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

function provenanceLine(p: DecouplingPoint): string {
  if (p.noAssessment) return "no assessment found";
  if (p.imputed) {
    return `imputed from IFP tier prior (${(p.tier ?? "").toUpperCase()})`;
  }
  return "IFP web-corroborated share";
}

export function DecouplingScatter({
  points,
  medianReach,
  droppedNoAbbr = 0,
  exportMode = false,
}: {
  points: DecouplingPoint[];
  medianReach: number;
  droppedNoAbbr?: number;
  exportMode?: boolean;
}) {
  const router = useRouter();
  const labelSlots = computeLabelSlots(points);

  return (
    <div className="flex flex-col gap-3">
      <ChartFrame
        height={exportMode ? 420 : 380}
        style={exportMode ? { width: 1000 } : undefined}
      >
        <ScatterChart margin={{ top: 12, right: 24, bottom: 44, left: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis
            type="number"
            dataKey="reach"
            name="reach"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            label={{
              value: "Core-AI services in reach",
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
          {medianReach > 0 && (
            <ReferenceLine
              x={medianReach}
              stroke="var(--border)"
              strokeDasharray="4 4"
              label={{
                value: "median reach",
                position: "top",
                fontSize: 9,
                fill: "var(--muted-foreground)",
                className: "font-mono",
              }}
            />
          )}
          {!exportMode && (
            <Tooltip
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeDasharray: "3 3",
              }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const p = payload[0].payload as DecouplingPoint;
                return (
                  <div className="border border-border bg-popover p-2 text-xs text-popover-foreground shadow">
                    <div className="font-semibold">{p.name}</div>
                    <div className="mt-1 tabular-nums">
                      <span className="font-medium">{p.reach}</span> core-AI
                      services in scope of packages it holds an ATO for
                    </div>
                    <div className="tabular-nums">
                      Access share:{" "}
                      <span className="font-medium">{percent(p.share)}</span>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {provenanceLine(p)}
                    </div>
                    <div className="tabular-nums text-muted-foreground">
                      {p.eligible == null
                        ? "no workforce profile"
                        : `${formatNumber(p.eligible)} AI-eligible workers`}
                    </div>
                  </div>
                );
              }}
            />
          )}
          {SERIES.map((s) => {
            const data = points.filter(s.match);
            if (data.length === 0) return null;
            return (
              <Scatter
                key={s.key}
                name={s.key}
                data={data}
                isAnimationActive={!exportMode}
                cursor={exportMode ? undefined : "pointer"}
                shape={(props) => {
                  const payload = props.payload as
                    | DecouplingPoint
                    | undefined;
                  return (
                    renderDot(
                      props.cx,
                      props.cy,
                      payload,
                      s.color,
                      s.hollow,
                      payload ? labelSlots.get(payload.abbr) : undefined,
                    ) ?? <g />
                  );
                }}
                onClick={
                  exportMode
                    ? undefined
                    : (entry) => {
                        const abbr = (entry as { abbr?: string }).abbr;
                        if (abbr) {
                          router.push(`/fedramp/coverage/agencies/${abbr}`);
                        }
                      }
                }
              />
            );
          })}
        </ScatterChart>
      </ChartFrame>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {LEGEND.map((entry) => (
          <span key={entry.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={
                entry.hollow
                  ? {
                      background: "var(--background)",
                      border: `1.5px solid ${entry.color}`,
                    }
                  : { background: entry.color }
              }
            />
            {entry.label}
          </span>
        ))}
      </div>

      {droppedNoAbbr > 0 && (
        <div className="text-[10px] font-mono text-muted-foreground">
          {droppedNoAbbr} agencies without an inventory abbreviation not plotted.
        </div>
      )}
    </div>
  );
}

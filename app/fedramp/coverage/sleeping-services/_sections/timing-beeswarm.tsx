"use client";

/**
 * A hand-rolled SVG strip/beeswarm of sleeping (agency × product) pairs by the
 * date their capability first came into reach — the first host-package ATO.
 * One dot per sleeping pair with a usable ATO date; x is linear time, y is a
 * greedy collision-avoidance stack around the vertical center. It reads the
 * same story as the bucket bar chart above it ("is it just too new?") but at
 * dot resolution, so a cluster of recent voids is visible as a wall on the
 * right while genuinely old, un-acted-on capability shows as dots far left.
 *
 * Rendered ALONGSIDE (under) the bucket bars — it replaces nothing. No d3: the
 * time scale, the tick years, and the beeswarm packing are all computed here.
 * Dot color is CSS-var only (stamp for a capability void, muted-foreground for
 * "similar already deployed", dimmed for post-cutoff/just-arrived rows that are
 * excluded from the headline counts).
 */

import { useState } from "react";
import type { SleepingPair } from "../_shared";
import { productSlug } from "../_shared";
import { formatDate } from "@/lib/formatting";

const W = 960;
const R = 3.5;
const ROW = 2 * R + 2; // vertical step between stacked dots
const MIN_DIST = 2 * R + 1; // circle-center distance that counts as touching
const TOP_PAD = 12;
const AXIS_H = 22; // room below the baseline for tick labels
const PLOT_L = 10;
const PLOT_R = W - 10;

const SNAPSHOT_MS = Date.parse("2026-06-12");
const CUTOFF_MS = Date.parse("2025-12-31");
const FLOOR_MS = Date.parse("2015-01-01");
const EPOCH_FLOOR_MS = Date.parse("2000-01-01");

type DotState = "void" | "similar" | "excluded";

interface Dot {
  key: string;
  product: string;
  agencyAbbr: string;
  date: string;
  x: number;
  y: number;
  state: DotState;
}

function dotState(p: SleepingPair): DotState {
  if (p.timing_excluded === true || p.recency_last90 === 1) return "excluded";
  if (p.similar_deployed) return "similar";
  return "void";
}

/** Largest stacking offset (in ROW units) that keeps the viewBox <= 320. */
const MAX_OFF = Math.floor(((320 - TOP_PAD - AXIS_H) / 2 - R) / ROW);

export function TimingBeeswarm({ pairs }: { pairs: SleepingPair[] }) {
  const [pinned, setPinned] = useState<string | null>(null);

  const sleeping = pairs.filter((p) => p.role === "sleeping");

  const dated = sleeping
    .map((p) => ({ p, ms: p.first_ato_date ? Date.parse(p.first_ato_date) : NaN }))
    .filter(({ ms }) => Number.isFinite(ms) && ms >= EPOCH_FLOOR_MS)
    .sort((a, b) => a.ms - b.ms);

  const undated = sleeping.length - dated.length;

  if (dated.length === 0) {
    return (
      <div className="font-mono text-[10px] text-muted-foreground">
        {undated > 0
          ? `${undated} sleeping pairs with no usable ATO date not drawn — counted in the "No usable date" bar above.`
          : "No dated sleeping pairs to plot."}
      </div>
    );
  }

  const minDataMs = dated[0].ms;
  const domainStart = Math.max(minDataMs, FLOOR_MS);
  const domainEnd = SNAPSHOT_MS;
  const xScale = (ms: number) =>
    PLOT_L + ((ms - domainStart) / (domainEnd - domainStart)) * (PLOT_R - PLOT_L);

  // Greedy beeswarm packing: for each dot (in date order), take the first
  // vertical offset from {0, +1, -1, +2, -2, …} that doesn't collide with an
  // already-placed dot. ROW > MIN_DIST, so any offset difference of 1 clears —
  // the search only ever fights same-offset neighbors. O(n²), fine for n≈100s.
  const placed: Array<{ x: number; off: number }> = [];
  let maxAbsOff = 0;
  for (const { ms } of dated) {
    const x = xScale(ms);
    let chosen = 0;
    outer: for (let k = 0; k <= MAX_OFF; k++) {
      for (const off of k === 0 ? [0] : [k, -k]) {
        const collides = placed.some((q) => {
          const dx = x - q.x;
          const dy = (off - q.off) * ROW;
          return dx * dx + dy * dy < MIN_DIST * MIN_DIST;
        });
        if (!collides) {
          chosen = off;
          break outer;
        }
      }
    }
    placed.push({ x, off: chosen });
    maxAbsOff = Math.max(maxAbsOff, Math.abs(chosen));
  }

  const contentH = 2 * (maxAbsOff * ROW + R);
  const H = Math.min(320, Math.max(120, Math.round(contentH + TOP_PAD + AXIS_H + 6)));
  const baselineY = H - AXIS_H;
  const cy = (TOP_PAD + baselineY) / 2;

  const dots: Dot[] = dated.map(({ p }, i) => ({
    key: `${p.product}|${p.agency_abbr}`,
    product: p.product,
    agencyAbbr: p.agency_abbr,
    date: p.first_ato_date as string,
    x: placed[i].x,
    y: cy + placed[i].off * ROW,
    state: dotState(p),
  }));

  const voidCount = dots.filter((d) => d.state === "void").length;

  // Year ticks at each Jan-1 boundary that falls inside the visible domain.
  const startYear = new Date(domainStart).getUTCFullYear();
  const endYear = new Date(domainEnd).getUTCFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const ms = Date.UTC(y, 0, 1);
    if (ms >= domainStart && ms <= domainEnd) years.push(y);
  }

  const cutoffX = xScale(CUTOFF_MS);
  const pinnedDot = pinned ? dots.find((d) => d.key === pinned) ?? null : null;

  return (
    <div className="flex flex-col gap-2 font-mono">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5"
            style={{ background: "var(--stamp)" }}
          />
          capability void
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5"
            style={{ background: "var(--muted-foreground)", opacity: 0.85 }}
          />
          similar capability deployed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5"
            style={{ background: "var(--muted-foreground)", opacity: 0.35 }}
          />
          post-cutoff · excluded from headline counts
        </span>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${dots.length} sleeping pairs by first host-package ATO date; ${voidCount} with nothing similar deployed.`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* Baseline */}
          <line
            x1={PLOT_L}
            y1={baselineY}
            x2={PLOT_R}
            y2={baselineY}
            stroke="var(--border)"
            strokeWidth={1}
          />

          {/* Year ticks + labels */}
          {years.map((y) => {
            const x = xScale(Date.UTC(y, 0, 1));
            return (
              <g key={y}>
                <line
                  x1={x}
                  y1={baselineY}
                  x2={x}
                  y2={baselineY + 4}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={baselineY + 15}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--muted-foreground)"
                >
                  {y}
                </text>
              </g>
            );
          })}

          {/* Inventory-cutoff rule */}
          <line
            x1={cutoffX}
            y1={TOP_PAD - 4}
            x2={cutoffX}
            y2={baselineY}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
          />
          <text
            x={cutoffX - 4}
            y={TOP_PAD + 2}
            textAnchor="end"
            fontSize={10}
            fill="var(--muted-foreground)"
          >
            inventory cutoff
          </text>

          {/* Dots */}
          {dots.map((d) => {
            const fill =
              d.state === "void" ? "var(--stamp)" : "var(--muted-foreground)";
            const opacity =
              d.state === "excluded" ? 0.35 : d.state === "similar" ? 0.85 : 1;
            return (
              <a
                key={d.key}
                href={`#board-${productSlug(d.product)}`}
                aria-label={`${d.agencyAbbr} × ${d.product}`}
                onMouseEnter={() => setPinned(d.key)}
                onMouseLeave={() => setPinned((p) => (p === d.key ? null : p))}
                onFocus={() => setPinned(d.key)}
                onBlur={() => setPinned((p) => (p === d.key ? null : p))}
              >
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={R}
                  fill={fill}
                  fillOpacity={opacity}
                  data-state={d.state}
                />
              </a>
            );
          })}
        </svg>

        {pinnedDot ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 w-56 border border-foreground bg-background p-2.5 text-left shadow-[4px_4px_0_0_var(--border)]"
            style={{
              left: `${Math.min(88, Math.max(12, (pinnedDot.x / W) * 100))}%`,
              top: `${(pinnedDot.y / H) * 100}%`,
              transform: "translate(-50%, 10px)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--stamp)]">
              {pinnedDot.agencyAbbr} × {pinnedDot.product}
            </p>
            <p className="mt-1 text-[0.78rem] leading-snug text-muted-foreground">
              <span className="uppercase tracking-[0.1em] text-[9.5px]">
                first ATO ·{" "}
              </span>
              <span className="text-foreground/80">
                {formatDate(pinnedDot.date)}
              </span>
            </p>
            <p className="mt-1 text-[0.78rem] leading-snug">
              {pinnedDot.state === "void" ? (
                <span className="text-[var(--stamp)]">nothing similar deployed</span>
              ) : pinnedDot.state === "similar" ? (
                <span className="text-muted-foreground">
                  similar capability deployed
                </span>
              ) : (
                <span className="text-muted-foreground">post-cutoff — excluded</span>
              )}
            </p>
          </div>
        ) : null}
      </div>

      {undated > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {undated} sleeping pairs with no usable ATO date not drawn — counted in
          the &quot;No usable date&quot; bar above.
        </p>
      ) : null}
    </div>
  );
}

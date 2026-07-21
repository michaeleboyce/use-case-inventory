"use client";

/**
 * Distance to the mandate's goal — a polar bullseye where the CENTER is the
 * goal: every eligible worker has a general AI tool.
 *
 * Radial distance encodes how much of the eligible workforce still has NO
 * general AI tool: an agency at ~100% access sits near the center; a
 * 0%-access agency sits out on the rim. Angle is deterministic (golden-angle
 * increments over agencies sorted by reach), so the layout is stable across
 * renders with no RNG. Body area ∝ eligible workforce. A thin vermilion ring
 * around a body marks peer-proven capabilities it holds an ATO for but has
 * deployed nothing similar to — dormant capability — with ring weight scaled
 * to the count.
 *
 * Hand-rolled SVG (no d3): the radial scale, the golden-angle placement, the
 * concentric share rings, and the pinned-key popover are all computed here.
 * Colors are CSS-var only. viewBox is offset left so the plot leaves a right
 * margin; the legend is plain HTML below.
 */

import { useState } from "react";
import type { LabAgency } from "../_view-model";
import { formatNumber } from "@/lib/formatting";

const W = 880;
const H = 640;
const CX = 340; // plot center, offset left of the 880-wide box
const CY = 320;
const R_MIN = 40; // inner radius: an agency at 100% access
const R_MAX = 270; // rim: an agency at 0% access

/** Radial distance for a coverage share (0–1). share=1 → center, 0 → rim. */
function rFor(share: number): number {
  const s = Math.max(0, Math.min(1, share));
  return R_MIN + (1 - s) * (R_MAX - R_MIN);
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const GOLDEN = 137.507764; // golden angle in degrees
const DEG = Math.PI / 180;

/** Grid rings, labeled by the share of staff they mark. */
const GRID_SHARES = [0.25, 0.5, 0.75, 1] as const;

interface Body {
  abbr: string;
  name: string;
  eligible: number | null;
  share: number;
  imputed: boolean;
  noAssessment: boolean;
  reach: number;
  voids: number;
  x: number;
  y: number;
  r: number; // body radius
  cos: number; // unit direction from center (for label offset)
  sin: number;
  halo: number; // halo stroke width; 0 = no halo
  labeled: boolean;
}

function provenance(a: { imputed: boolean; noAssessment: boolean }): string {
  if (a.noAssessment) return "no assessment found";
  if (a.imputed) return "imputed from IFP tier prior";
  return "IFP web-corroborated share";
}

export function GravityWell({ agencies }: { agencies: LabAgency[] }) {
  const [pinned, setPinned] = useState<string | null>(null);

  // Deterministic order: reach desc, then abbr — drives the golden-angle spiral.
  const ordered = [...agencies].sort(
    (a, b) => b.reach - a.reach || a.abbr.localeCompare(b.abbr),
  );

  const maxEligible = Math.max(1, ...ordered.map((a) => a.eligible ?? 0));
  const eligScale = 16 / Math.sqrt(maxEligible); // sqrt(max) → radius 16

  // Direct labels: the ~12 largest-eligible agencies + anything with voids ≥ 5.
  const topEligible = new Set(
    [...ordered]
      .filter((a) => a.eligible != null)
      .sort((a, b) => (b.eligible ?? 0) - (a.eligible ?? 0))
      .slice(0, 12)
      .map((a) => a.abbr),
  );

  const bodies: Body[] = ordered.map((a, i) => {
    const angle = i * GOLDEN * DEG;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dist = rFor(a.share);
    const r =
      a.eligible == null
        ? 3.5
        : clamp(Math.sqrt(a.eligible) * eligScale, 3, 16);
    return {
      abbr: a.abbr,
      name: a.name,
      eligible: a.eligible,
      share: a.share,
      imputed: a.imputed,
      noAssessment: a.noAssessment,
      reach: a.reach,
      voids: a.voids,
      // Fixed precision: Node and browser trig can differ in the last
      // float digit, which trips React hydration on cx/cy attributes.
      x: Math.round((CX + dist * cos) * 100) / 100,
      y: Math.round((CY + dist * sin) * 100) / 100,
      r: Math.round(r * 100) / 100,
      cos: Math.round(cos * 10000) / 10000,
      sin: Math.round(sin * 10000) / 10000,
      halo: a.voids > 0 ? clamp(a.voids * 0.5 + 0.5, 1, 2.5) : 0,
      labeled: topEligible.has(a.abbr) || a.voids >= 5,
    };
  });

  const pinnedBody = pinned ? bodies.find((b) => b.abbr === pinned) ?? null : null;

  return (
    <div className="font-mono">
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Distance to the mandate's goal: ${bodies.length} agencies plotted by how far they are from every eligible worker having a tool. Distance from center is the share of eligible staff without a tool.`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* Concentric share rings, dashed, with mono labels up one side. */}
          {GRID_SHARES.map((s) => {
            const rr = rFor(s);
            return (
              <g key={s}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={rr}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
                <rect
                  x={CX - 92}
                  y={CY - rr - 11}
                  width={184}
                  height={12}
                  fill="var(--background)"
                  opacity={0.85}
                />
                <text
                  x={CX}
                  y={CY - rr - 2}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--muted-foreground)"
                >
                  {Math.round(s * 100)}% of eligible staff have a tool
                </text>
              </g>
            );
          })}

          {/* Center of the well: full access. */}
          <line
            x1={CX - 6}
            y1={CY}
            x2={CX + 6}
            y2={CY}
            stroke="var(--foreground)"
            strokeWidth={1}
          />
          <line
            x1={CX}
            y1={CY - 6}
            x2={CX}
            y2={CY + 6}
            stroke="var(--foreground)"
            strokeWidth={1}
          />
          <rect
            x={CX - 110}
            y={CY + 10}
            width={220}
            height={13}
            fill="var(--background)"
            opacity={0.85}
          />
          <text
            x={CX}
            y={CY + 20}
            textAnchor="middle"
            fontSize={9}
            fill="var(--muted-foreground)"
          >
            the mandate&apos;s goal: every eligible worker
          </text>

          {/* Bodies + their dormant-capability halos. */}
          {bodies.map((b) => {
            const isPinned = pinned === b.abbr;
            return (
              <g key={b.abbr}>
                {b.halo > 0 ? (
                  <circle
                    cx={b.x}
                    cy={b.y}
                    r={b.r + 4}
                    fill="none"
                    stroke="var(--stamp)"
                    strokeWidth={b.halo}
                    data-halo={b.voids}
                    opacity={b.noAssessment ? 0.5 : 0.7}
                  />
                ) : null}
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r}
                  fill={b.imputed ? "var(--background)" : "var(--foreground)"}
                  stroke="var(--foreground)"
                  strokeWidth={b.imputed ? 1.5 : isPinned ? 1.5 : 0}
                  opacity={b.noAssessment ? 0.45 : 1}
                  data-agency={b.abbr}
                  data-imputed={b.imputed}
                  tabIndex={0}
                  role="img"
                  aria-label={`${b.name} (${b.abbr}): ${Math.round(
                    b.share * 100,
                  )}% of eligible staff have a tool; ${b.reach} core-AI services in reach; ${b.voids} capability voids.`}
                  style={{ cursor: "pointer", outline: "none" }}
                  onMouseEnter={() => setPinned(b.abbr)}
                  onMouseLeave={() =>
                    setPinned((p) => (p === b.abbr ? null : p))
                  }
                  onFocus={() => setPinned(b.abbr)}
                  onBlur={() => setPinned((p) => (p === b.abbr ? null : p))}
                />
                {b.labeled ? (
                  <text
                    x={b.x + (b.r + 6) * b.cos}
                    y={b.y + (b.r + 6) * b.sin + 3}
                    textAnchor={b.cos >= 0 ? "start" : "end"}
                    fontSize={10}
                    fill="var(--foreground)"
                    style={{ pointerEvents: "none" }}
                  >
                    {b.abbr}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {pinnedBody ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 w-64 border border-foreground bg-background p-2.5 text-left shadow-[4px_4px_0_0_var(--border)]"
            style={{
              left: `${clamp((pinnedBody.x / W) * 100, 6, 70)}%`,
              top: `${(pinnedBody.y / H) * 100}%`,
              transform: "translate(-50%, 12px)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--stamp)]">
              {pinnedBody.abbr} · {pinnedBody.name}
            </p>
            <dl className="mt-1.5 space-y-1 text-[0.72rem] leading-snug">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">eligible workers</dt>
                <dd className="tabular-nums text-foreground">
                  {formatNumber(pinnedBody.eligible)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  {Math.round(pinnedBody.share * 100)}% have a tool
                </dt>
                <dd className="text-right text-foreground/80">
                  {provenance(pinnedBody)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[0.72rem] leading-snug text-muted-foreground">
              <span className="tabular-nums text-foreground">
                {pinnedBody.reach}
              </span>{" "}
              core-AI services in scope of packages it holds an ATO for
            </p>
            <p className="mt-1 text-[0.72rem] leading-snug">
              <span className="tabular-nums text-[var(--stamp)]">
                {pinnedBody.voids}
              </span>{" "}
              <span
                className={
                  pinnedBody.voids > 0
                    ? "text-[var(--stamp)]"
                    : "text-muted-foreground"
                }
              >
                peer-proven capabilities with nothing similar deployed
              </span>
            </p>
          </div>
        ) : null}
      </div>

      {/* Legend (HTML). */}
      <ul className="mt-4 flex flex-col gap-1.5 text-[10.5px] text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--foreground)" }}
          />
          solid = corroborated
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px]"
            style={{
              background: "var(--background)",
              borderColor: "var(--foreground)",
            }}
          />
          hollow = tier-imputed
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: "var(--stamp)" }}
          />
          vermilion ring = unused peer-proven capability (thickness = count)
        </li>
        <li className="inline-flex items-center gap-1.5">
          distance from center = share of staff WITHOUT a tool
        </li>
      </ul>
    </div>
  );
}

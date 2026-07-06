/**
 * People-weighted waffle: one square ≈ WAFFLE_UNIT AI-eligible federal
 * workers, colored by whether that worker's agency already puts a
 * general-purpose AI tool in their hands (est.), holds a core-AI capability
 * *in reach* (in scope of a package the agency holds an ATO for) but ships no
 * tool, or has neither. A hand-rolled HTML/CSS unit chart — no Recharts, no
 * SVG. Client Component for the per-square hover/focus popover.
 *
 * Framing guardrail (see app/_view-models/frontier-access.ts): capability is
 * "in reach", never "enabled" or "available". Access shares are IFP estimates.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/formatting";
import type { WaffleModel, WaffleState } from "@/app/_view-models/frontier-access";

/** Square fill by state. CSS vars / tokens only — never hex. */
const STATE_SWATCH: Record<WaffleState, string> = {
  access: "bg-foreground",
  reach_only: "bg-[var(--stamp)]",
  neither: "bg-muted/40 border border-border",
};

/** Legend / aria copy. Ordered access → reach_only → neither. */
const STATE_LEGEND: Record<WaffleState, string> = {
  access: "has a general-purpose AI tool (est.)",
  reach_only: "no tool — agency holds core-AI capability in reach",
  neither: "no tool, no core-AI in reach",
};

/** Short phrasing for the grid's role="img" summary. */
const STATE_WORDS: Record<WaffleState, string> = {
  access: "with a general-purpose AI tool",
  reach_only: "with a core-AI capability in reach but no tool",
  neither: "with neither a tool nor core-AI in reach",
};

const STATE_ORDER: WaffleState[] = ["access", "reach_only", "neither"];

export function PeopleWaffle({
  waffle,
  compact = false,
  exportMode = false,
  crossLinkHref,
}: {
  waffle: WaffleModel;
  compact?: boolean;
  exportMode?: boolean;
  crossLinkHref?: string;
}) {
  const { unit, squares, totals, agencyCount, imputedAgencyCount } = waffle;
  const interactive = !compact && !exportMode;
  const [pinned, setPinned] = useState<number | null>(null);

  const pct = (n: number) =>
    totals.eligible > 0 ? formatPercent(n / totals.eligible) : "—";

  const gridLabel =
    `People-weighted waffle: ${formatNumber(totals.access)} AI-eligible workers ` +
    `${STATE_WORDS.access}, ${formatNumber(totals.reachOnly)} ${STATE_WORDS.reach_only}, ` +
    `${formatNumber(totals.neither)} ${STATE_WORDS.neither}.`;

  return (
    <div
      className="flex flex-col gap-3"
      style={exportMode ? { maxWidth: 1000 } : undefined}
    >
      {/* Totals strip — one line, mono, tabular */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[11px] tabular-nums text-muted-foreground">
        {STATE_ORDER.map((s) => {
          const value =
            s === "access"
              ? totals.access
              : s === "reach_only"
                ? totals.reachOnly
                : totals.neither;
          return (
            <span key={s} className="inline-flex items-baseline gap-1.5">
              <span
                className={cn("inline-block h-2.5 w-2.5", STATE_SWATCH[s])}
                aria-hidden
              />
              <span className="text-foreground">{formatNumber(value)}</span>
              <span className="text-muted-foreground/80">({pct(value)})</span>
            </span>
          );
        })}
      </div>

      {/* The unit grid */}
      <div
        role="img"
        aria-label={gridLabel}
        className={cn("flex flex-wrap", compact ? "gap-[2px]" : "gap-[3px]")}
      >
        {squares.map((sq, i) => {
          const label =
            `${STATE_LEGEND[sq.state]}${
              sq.dominant ? ` — ${sq.dominant.abbr}` : ""
            }, ~${formatNumber(sq.dominantWorkers)} workers` +
            `${sq.imputed ? " (share imputed from tier prior)" : ""}`;
          return (
            <div
              key={i}
              className={cn(
                "relative rounded-none",
                compact ? "h-[10px] w-[10px]" : "h-[14px] w-[14px]",
                STATE_SWATCH[sq.state],
                interactive && "outline-offset-2",
              )}
              aria-label={label}
              tabIndex={interactive ? 0 : undefined}
              onMouseEnter={interactive ? () => setPinned(i) : undefined}
              onMouseLeave={
                interactive
                  ? () => setPinned((p) => (p === i ? null : p))
                  : undefined
              }
              onFocus={interactive ? () => setPinned(i) : undefined}
              onBlur={
                interactive
                  ? () => setPinned((p) => (p === i ? null : p))
                  : undefined
              }
            >
              {interactive && pinned === i ? <SquarePopover square={sq} /> : null}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className={cn(
          "flex font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground",
          compact
            ? "flex-row flex-wrap gap-x-4 gap-y-1"
            : "flex-col gap-1.5",
        )}
      >
        {STATE_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-2">
            <span
              className={cn("inline-block h-3 w-3", STATE_SWATCH[s])}
              aria-hidden
            />
            {STATE_LEGEND[s]}
          </span>
        ))}
      </div>

      {/* Unit / provenance note */}
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/80">
        1 ■ ≈ {formatNumber(unit)} AI-eligible federal workers ·{" "}
        {formatNumber(agencyCount)} agencies modeled · shares for{" "}
        {formatNumber(imputedAgencyCount)} agencies imputed from IFP tier priors
      </p>

      {compact && crossLinkHref ? (
        <Link
          href={crossLinkHref}
          className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Full breakdown: reach vs. access ↗
        </Link>
      ) : null}
    </div>
  );
}

function SquarePopover({ square }: { square: WaffleModel["squares"][number] }) {
  return (
    <div
      role="tooltip"
      className="absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 border border-foreground bg-background p-2.5 text-left shadow-[4px_4px_0_0_var(--border)]"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--stamp)]">
        {STATE_LEGEND[square.state]}
      </p>
      <p className="mt-1 text-[0.82rem] font-medium leading-snug text-foreground">
        {square.dominant
          ? `${square.dominant.name} (${square.dominant.abbr})`
          : "Mixed agencies"}
      </p>
      <p className="mt-1 text-[0.78rem] leading-snug text-muted-foreground">
        ~{formatNumber(square.dominantWorkers)} workers in this state
      </p>
      {square.imputed ? (
        <p className="mt-1 text-[0.72rem] leading-snug text-muted-foreground/80">
          (share imputed from tier prior)
        </p>
      ) : null}
    </div>
  );
}

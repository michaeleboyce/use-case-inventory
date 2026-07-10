"use client";

/**
 * The across-agencies waffle: the same worker-unit squares as PeopleWaffle,
 * composed as labeled per-agency blocks so the government-wide total is
 * visibly built from the 56 researched agency profiles. Sorted by access
 * share, the composition reads left-to-right as "agencies that turned reach
 * into access" → "agencies sitting on the shelf".
 *
 * Provenance vocabulary matches the decoupling scatter: SOLID black = has a
 * tool under a web-corroborated share; HOLLOW black = has a tool under a
 * tier-prior imputed share (uncertainty is visible per-square); stamp red =
 * no tool at an agency holding core-AI capability in reach; muted = neither.
 * The floor → central → bullish strip above the blocks states the same
 * uncertainty numerically.
 *
 * Additive to PeopleWaffle (the pooled view) — it replaces nothing.
 */

import { useState } from "react";
import Link from "next/link";
import type { MosaicModel, MosaicAgency } from "@/app/_view-models/frontier-access";
import { formatNumber } from "@/lib/formatting";

type SquareKind = "access" | "reach_only" | "neither";

function squareClass(kind: SquareKind, imputed: boolean): string {
  if (kind === "access") {
    return imputed
      ? "border-[1.5px] border-foreground bg-background"
      : "bg-foreground";
  }
  if (kind === "reach_only") return "bg-[var(--stamp)]";
  return "border border-border bg-muted/40";
}

function provenance(a: MosaicAgency): string {
  if (a.noAssessment) return "no assessment found";
  if (a.imputed) return "share imputed from IFP tier prior";
  return "IFP web-corroborated share";
}

export function PeopleMosaic({
  mosaic,
  exportMode = false,
}: {
  mosaic: MosaicModel;
  exportMode?: boolean;
}) {
  const [pinned, setPinned] = useState<string | null>(null);
  const { agencies, pooled, unit, floorPct, centralPct, bullishPct } = mosaic;
  const interactive = !exportMode;
  const pinnedAgency = pinned
    ? agencies.find((a) => a.abbr === pinned) ?? null
    : null;

  return (
    <div
      className="flex flex-col gap-4 font-mono"
      style={exportMode ? { maxWidth: 1000 } : undefined}
    >
      {/* Floor → central → bullish uncertainty strip */}
      <div>
        <div className="relative h-3 w-full max-w-[640px] border border-border">
          <div
            className="absolute inset-y-0 left-0 bg-foreground"
            style={{ width: `${floorPct}%` }}
            title={`corroborated floor ${floorPct}%`}
          />
          <div
            className="absolute inset-y-0 bg-foreground/45"
            style={{ left: `${floorPct}%`, width: `${Math.max(0, centralPct - floorPct)}%` }}
            title={`tier-prior central ${centralPct}%`}
          />
          <div
            className="absolute inset-y-0"
            style={{
              left: `${centralPct}%`,
              width: `${Math.max(0, bullishPct - centralPct)}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--foreground) 0 2px, transparent 2px 6px)",
              opacity: 0.5,
            }}
            title={`bullish availability ${bullishPct}%`}
          />
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          share of eligible workers with a tool — corroborated floor{" "}
          <span className="text-foreground">{floorPct}%</span> · with tier
          priors <span className="text-foreground">{centralPct}%</span> ·
          bullish availability{" "}
          <span className="text-foreground">{bullishPct}%</span>
        </p>
      </div>

      {/* Agency blocks */}
      <div
        className="relative flex flex-wrap items-end gap-x-4 gap-y-5"
        role="img"
        aria-label={`Per-agency worker mosaic: ${agencies.length} agencies with ≥1 square of ${formatNumber(unit)} AI-eligible workers, plus ${pooled.agencyCount} smaller agencies pooled.`}
      >
        {agencies.map((a) => {
          const n = a.squares.access + a.squares.reachOnly + a.squares.neither;
          const cols = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(n))));
          const kinds: SquareKind[] = [
            ...Array<SquareKind>(a.squares.access).fill("access"),
            ...Array<SquareKind>(a.squares.reachOnly).fill("reach_only"),
            ...Array<SquareKind>(a.squares.neither).fill("neither"),
          ];
          return (
            <div
              key={a.abbr}
              className="flex flex-col gap-1"
              onMouseEnter={interactive ? () => setPinned(a.abbr) : undefined}
              onMouseLeave={
                interactive
                  ? () => setPinned((p) => (p === a.abbr ? null : p))
                  : undefined
              }
              onFocus={interactive ? () => setPinned(a.abbr) : undefined}
              onBlur={
                interactive
                  ? () => setPinned((p) => (p === a.abbr ? null : p))
                  : undefined
              }
            >
              <div
                className="grid gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${cols}, 12px)` }}
                aria-label={`${a.name}: ${formatNumber(a.eligible)} eligible; ${provenance(a)}`}
              >
                {kinds.map((k, i) => (
                  <span
                    key={i}
                    className={`block h-3 w-3 ${squareClass(k, a.imputed)}`}
                    data-kind={k}
                    data-imputed={k === "access" && a.imputed ? "1" : undefined}
                  />
                ))}
              </div>
              {interactive ? (
                <Link
                  href={`/fedramp/coverage/agencies/${a.abbr}`}
                  className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground hover:text-[var(--stamp)]"
                >
                  {a.abbr}
                </Link>
              ) : (
                <span className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                  {a.abbr}
                </span>
              )}
            </div>
          );
        })}

        {pooled.agencyCount > 0 ? (
          <div className="flex flex-col gap-1">
            <div
              className="flex flex-wrap gap-[2px]"
              style={{ maxWidth: 4 * 14 }}
              aria-label={`${pooled.agencyCount} smaller agencies pooled: ${formatNumber(pooled.eligible)} eligible workers`}
            >
              {(
                [
                  ...Array<SquareKind>(pooled.squares.access).fill("access"),
                  ...Array<SquareKind>(pooled.squares.reachOnly).fill("reach_only"),
                  ...Array<SquareKind>(pooled.squares.neither).fill("neither"),
                ] as SquareKind[]
              ).map((k, i) => (
                <span
                  key={i}
                  className={`block h-3 w-3 ${squareClass(k, true)}`}
                  data-kind={k}
                />
              ))}
            </div>
            <span className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
              +{pooled.agencyCount} others
            </span>
          </div>
        ) : null}

        {pinnedAgency ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute -top-2 right-0 z-20 w-64 border border-foreground bg-background p-2.5 shadow-[4px_4px_0_0_var(--border)]"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--stamp)]">
              {pinnedAgency.abbr} · {pinnedAgency.name}
            </p>
            <p className="mt-1 text-[0.78rem] leading-snug text-muted-foreground">
              {formatNumber(pinnedAgency.eligible)} AI-eligible workers ·{" "}
              {Math.round(pinnedAgency.share * 100)}% with a tool (
              {provenance(pinnedAgency)})
            </p>
            <p className="mt-1 text-[0.78rem] leading-snug text-muted-foreground">
              {pinnedAgency.reach > 0
                ? `${pinnedAgency.reach} core-AI services in scope of packages it holds an ATO for`
                : "no core-AI services in scope of held packages"}
            </p>
          </div>
        ) : null}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 bg-foreground" />
          has a tool — corroborated
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 border-[1.5px] border-foreground bg-background"
          />
          has a tool — tier-imputed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 bg-[var(--stamp)]"
          />
          no tool — core-AI in reach
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 border border-border bg-muted/40"
          />
          no tool, no reach
        </span>
        <span className="normal-case tracking-normal">
          1 ■ ≈ {formatNumber(unit)} workers · blocks sorted by access share
        </span>
      </div>
    </div>
  );
}

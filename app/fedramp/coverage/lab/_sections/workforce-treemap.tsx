"use client";

/**
 * Sketch: "One rectangle of government."
 *
 * A single rectangle is the entire profiled AI-eligible workforce. Every
 * agency is a tile whose AREA is its eligible headcount, so the whole
 * workforce is exhaustively accounted for with zero gaps in coverage —
 * this framing trades the people-mosaic's discrete worker-units for
 * total area. Inside each tile two stacked horizontal bands split that
 * agency's workers by estimated state: a black band (has a tool) sized to
 * the access share, and a remainder band that is vermilion when core-AI
 * capability is in reach (a tool could exist and doesn't) or muted when it
 * is not. Imputed shares wear a diagonal hatch on the black band so the
 * uncertainty is visible where the estimate lives.
 *
 * Provenance vocabulary matches the decoupling scatter and the people
 * mosaic. Guardrail 7 holds: "reach" counts core-AI services in scope of a
 * package the agency holds an ATO for — never "enabled".
 *
 * Layout is a self-contained squarified treemap (Bruls/Huizing/van Wijk,
 * worst-aspect-ratio row packing), deterministic given the input order.
 */

import { useState } from "react";
import type { LabAgency } from "../_view-model";
import { formatNumber } from "@/lib/formatting";

const UNIT_W = 1000;
const UNIT_H = 562; // ~16:9

interface Tile {
  agency: LabAgency;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Worst aspect ratio of a candidate row laid along a side of `side`. */
function worstRatio(row: number[], side: number): number {
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const v of row) {
    sum += v;
    if (v > max) max = v;
    if (v < min) min = v;
  }
  const s2 = sum * sum;
  const side2 = side * side;
  return Math.max((side2 * max) / s2, s2 / (side2 * min));
}

/**
 * Squarified treemap over `agencies` (each with a scaled `area`), packed
 * into the UNIT_W×UNIT_H frame. Areas must already sum to UNIT_W*UNIT_H.
 */
function squarify(
  agencies: LabAgency[],
  areas: number[],
): Tile[] {
  const tiles: Tile[] = [];
  let x = 0;
  let y = 0;
  let w = UNIT_W;
  let h = UNIT_H;
  let i = 0;
  const n = agencies.length;

  while (i < n) {
    const side = Math.min(w, h);
    const row: number[] = [];
    const rowStart = i;
    let best = Infinity;
    while (i < n) {
      const next = worstRatio([...row, areas[i]], side);
      if (row.length === 0 || next <= best) {
        row.push(areas[i]);
        best = next;
        i += 1;
      } else {
        break;
      }
    }
    const rowSum = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      // Vertical strip on the left; each tile fills the strip's width.
      const stripW = rowSum / h;
      let oy = y;
      for (let k = 0; k < row.length; k += 1) {
        const th = row[k] / stripW;
        tiles.push({ agency: agencies[rowStart + k], x, y: oy, w: stripW, h: th });
        oy += th;
      }
      x += stripW;
      w -= stripW;
    } else {
      // Horizontal strip on the top; each tile fills the strip's height.
      const stripH = rowSum / w;
      let ox = x;
      for (let k = 0; k < row.length; k += 1) {
        const tw = row[k] / stripH;
        tiles.push({ agency: agencies[rowStart + k], x: ox, y, w: tw, h: stripH });
        ox += tw;
      }
      y += stripH;
      h -= stripH;
    }
  }
  return tiles;
}

function provenance(a: LabAgency): string {
  if (a.noAssessment) return "no assessment found";
  if (a.imputed) return "share imputed from IFP tier prior";
  return "IFP web-corroborated share";
}

const pct = (v: number, span: number) => `${(v / span) * 100}%`;

export function WorkforceTreemap({ agencies }: { agencies: LabAgency[] }) {
  const [pinned, setPinned] = useState<string | null>(null);

  const eligible = agencies.filter(
    (a) => a.eligible != null && a.eligible > 0,
  );
  const excluded = agencies.length - eligible.length;

  // Deterministic input: largest workforce first.
  const sorted = [...eligible].sort(
    (a, b) => (b.eligible ?? 0) - (a.eligible ?? 0),
  );
  const total = sorted.reduce((s, a) => s + (a.eligible ?? 0), 0);
  const scale = total > 0 ? (UNIT_W * UNIT_H) / total : 0;
  const tiles = total > 0
    ? squarify(sorted, sorted.map((a) => (a.eligible ?? 0) * scale))
    : [];

  const pinnedAgency = pinned
    ? sorted.find((a) => a.abbr === pinned) ?? null
    : null;

  return (
    <div className="flex flex-col gap-4 font-mono">
      <div
        className="relative w-full overflow-hidden border border-foreground"
        style={{ height: 520, background: "var(--background)" }}
        role="img"
        aria-label={`Treemap of AI-eligible workforce across ${tiles.length} agencies; tile area is eligible headcount, ${formatNumber(total)} workers total.`}
      >
        {tiles.map(({ agency: a, x, y, w, h }) => {
          const share = Math.max(0, Math.min(1, a.share));
          const remKind = a.reach > 0 ? "reach_only" : "neither";
          const showFull = w > 72 && h > 28;
          const showAbbr = !showFull && w > 40 && h > 18;
          const focused = pinned === a.abbr;
          return (
            <div
              key={a.abbr}
              data-tile={a.abbr}
              data-area={Math.round(w * h)}
              data-eligible={a.eligible ?? 0}
              data-imputed={a.imputed ? "1" : undefined}
              tabIndex={0}
              className="absolute cursor-default outline-none"
              style={{
                left: pct(x, UNIT_W),
                top: pct(y, UNIT_H),
                width: pct(w, UNIT_W),
                height: pct(h, UNIT_H),
                background: "var(--background)",
              }}
              onMouseEnter={() => setPinned(a.abbr)}
              onMouseLeave={() => setPinned((p) => (p === a.abbr ? null : p))}
              onFocus={() => setPinned(a.abbr)}
              onBlur={() => setPinned((p) => (p === a.abbr ? null : p))}
            >
              {/* 1px paper frame → 2px gap between neighbours */}
              <div
                className={`absolute inset-[1px] flex flex-col ${
                  focused ? "ring-1 ring-[var(--stamp)]" : ""
                }`}
              >
                {/* Access band — black, sized to the share. */}
                <div
                  className="relative w-full bg-foreground"
                  data-band="access"
                  style={{ height: `${share * 100}%` }}
                >
                  {a.imputed ? (
                    <div
                      aria-hidden
                      data-hatch="1"
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(45deg, var(--background) 0 2px, transparent 2px 6px)",
                        opacity: 0.4,
                      }}
                    />
                  ) : null}
                </div>
                {/* Remainder band — vermilion (reach) or muted (no reach). */}
                <div
                  data-band={remKind}
                  className={
                    remKind === "reach_only"
                      ? "w-full bg-[var(--stamp)]"
                      : "w-full bg-muted/40"
                  }
                  style={{ height: `${(1 - share) * 100}%` }}
                />
                {showFull || showAbbr ? (
                  <span className="pointer-events-none absolute left-1 top-1 text-[9px] uppercase leading-none tracking-[0.08em] text-background mix-blend-difference">
                    {showFull
                      ? `${a.abbr} ${Math.round(share * 100)}%`
                      : a.abbr}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {pinnedAgency ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute left-2 top-2 z-20 w-64 border border-foreground bg-background p-2.5 shadow-[4px_4px_0_0_var(--border)]"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--stamp)]">
              {pinnedAgency.abbr} · {pinnedAgency.name}
            </p>
            <p className="mt-1 text-[0.78rem] leading-snug text-muted-foreground">
              {formatNumber(pinnedAgency.eligible)} AI-eligible workers ·{" "}
              {Math.round(Math.max(0, Math.min(1, pinnedAgency.share)) * 100)}%
              with a tool ({provenance(pinnedAgency)})
            </p>
            <p className="mt-1 text-[0.78rem] leading-snug text-muted-foreground">
              {pinnedAgency.reach > 0
                ? `${pinnedAgency.reach} core-AI services in scope of packages it holds an ATO for`
                : "no core-AI services in scope of held packages"}
            </p>
            <p className="mt-1 text-[0.78rem] leading-snug text-muted-foreground">
              {pinnedAgency.voids} peer-proven{" "}
              {pinnedAgency.voids === 1 ? "void" : "voids"} — nothing similar
              deployed
            </p>
          </div>
        ) : null}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 bg-foreground" />
          has a tool (est.)
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
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 bg-foreground"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--background) 0 2px, transparent 2px 6px)",
            }}
          />
          share imputed
        </span>
      </div>

      {/* Mono caption */}
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        area = AI-eligible workforce · black = has a tool (est.) · vermilion =
        no tool, core-AI in reach · hatch = share imputed
      </p>

      {excluded > 0 ? (
        <p className="text-[10px] normal-case tracking-normal text-muted-foreground">
          {excluded} {excluded === 1 ? "agency" : "agencies"} without a
          workforce profile omitted (no eligible headcount).
        </p>
      ) : null}
    </div>
  );
}

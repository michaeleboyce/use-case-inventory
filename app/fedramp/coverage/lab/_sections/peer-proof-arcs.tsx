"use client";

/**
 * "Who proved it for whom" — an arc diagram of the peer-proof relationship the
 * sleeping-services data encodes. For every product, LEAD agencies (report real
 * use) have implicitly de-risked it for SLEEPING agencies (hold the ATO but
 * report nothing). Each arc above the axis is one (lead → sleeper) agency pair
 * aggregated across products; its weight is the count of shared products and it
 * turns vermilion when at least one of those products is a capability VOID for
 * the sleeper (nothing similar deployed).
 *
 * No d3: the horizontal node layout, the arc geometry (SVG elliptical `A`
 * command, flattened so wide spans stay inside the viewBox), and the degree
 * ordering are all computed here. Colors are CSS-var only. Nodes are keyboard
 * focusable; focusing one pins its arcs to full opacity and opens a popover.
 */

import { useState } from "react";
import type { LabAgency, LabPair } from "../_view-model";

const W = 960;
const H = 420;
const BASELINE_Y = 300; // arcs live above; rotated labels hang below
const LEFT_PAD = 56;
const RIGHT_PAD = 56;
const MAX_RISE = BASELINE_Y - 28; // flatten arcs taller than this
const NODE = 6; // square side
const MAX_NODES = 28;
const ARC_CAP = 120; // past this the diagram reads as a hairball, not a story

// Deliberately restrained: thin strokes, low resting opacity, so the shape —
// provers left, sleepers right — carries the story before any interaction.
const STROKE_MIN = 0.5;
const STROKE_MAX = 2.5;
const OPACITY_REST = 0.2;
const OPACITY_ACTIVE = 0.9;
const OPACITY_FADED = 0.08;

interface Arc {
  key: string;
  lead: string;
  sleeper: string;
  products: string[];
  weight: number;
  isVoid: boolean;
}

interface NodeDatum {
  abbr: string;
  name: string;
  x: number;
  leads: boolean;
  leadDeg: number;
  sleepDeg: number;
}

/** Per-agency popover stats, computed over the full (uncapped) pair set. */
interface AgencyStats {
  ledProducts: string[];
  provenFor: string[];
  sleptProducts: Array<{ product: string; isVoid: boolean }>;
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}

function computeStats(pairs: LabPair[]): Map<string, AgencyStats> {
  const stats = new Map<string, AgencyStats>();
  const get = (abbr: string): AgencyStats => {
    let s = stats.get(abbr);
    if (!s) {
      s = { ledProducts: [], provenFor: [], sleptProducts: [] };
      stats.set(abbr, s);
    }
    return s;
  };
  for (const p of pairs) {
    for (const lead of p.leads) {
      const s = get(lead);
      if (!s.ledProducts.includes(p.product)) s.ledProducts.push(p.product);
      for (const sleeper of p.sleepers) {
        if (sleeper !== lead && !s.provenFor.includes(sleeper)) {
          s.provenFor.push(sleeper);
        }
      }
    }
    for (const sleeper of p.sleepers) {
      const s = get(sleeper);
      s.sleptProducts.push({
        product: p.product,
        isVoid: p.voids.includes(sleeper),
      });
    }
  }
  // Voids first, so the popover names the products with nothing similar first.
  for (const s of stats.values()) {
    s.sleptProducts.sort((a, b) => Number(b.isVoid) - Number(a.isVoid));
  }
  return stats;
}

export function PeerProofArcs({
  agencies,
  pairs,
}: {
  agencies: LabAgency[];
  pairs: LabPair[];
}) {
  const [pinned, setPinned] = useState<string | null>(null);

  const nameByAbbr = new Map(agencies.map((a) => [a.abbr, a.name]));
  const stats = computeStats(pairs);

  // Every agency that leads at least one product, for node fill.
  const leadsAny = new Set<string>();
  for (const p of pairs) for (const l of p.leads) leadsAny.add(l);

  // Aggregate (lead → sleeper) arcs across all products, over ALL agencies.
  const arcMap = new Map<string, Arc>();
  for (const p of pairs) {
    for (const lead of p.leads) {
      for (const sleeper of p.sleepers) {
        if (lead === sleeper) continue;
        const key = `${lead}|${sleeper}`;
        let arc = arcMap.get(key);
        if (!arc) {
          arc = { key, lead, sleeper, products: [], weight: 0, isVoid: false };
          arcMap.set(key, arc);
        }
        if (!arc.products.includes(p.product)) {
          arc.products.push(p.product);
          arc.weight += 1;
        }
        if (p.voids.includes(sleeper)) arc.isVoid = true;
      }
    }
  }
  const allArcs = [...arcMap.values()];

  // Degree per agency (arc counts), used for both the node cap and ordering.
  const degree = new Map<string, { lead: number; sleep: number }>();
  const bump = (abbr: string, role: "lead" | "sleep") => {
    let d = degree.get(abbr);
    if (!d) {
      d = { lead: 0, sleep: 0 };
      degree.set(abbr, d);
    }
    d[role] += 1;
  };
  for (const arc of allArcs) {
    bump(arc.lead, "lead");
    bump(arc.sleeper, "sleep");
  }

  const totalAgencies = degree.size;
  if (totalAgencies === 0) {
    return (
      <div className="font-mono text-[10px] text-muted-foreground">
        No peer-proof pairs to draw — the sleeping-services sidecar is absent.
      </div>
    );
  }

  // Keep the most-connected MAX_NODES by total degree; fold the rest away.
  const kept = [...degree.entries()]
    .map(([abbr, d]) => ({ abbr, ...d, total: d.lead + d.sleep }))
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_NODES)
    // Provers left, sleepers right: order by (lead-degree − sleep-degree) desc.
    .sort((a, b) => b.lead - b.sleep - (a.lead - a.sleep));

  const droppedCount = totalAgencies - kept.length;
  const keptSet = new Set(kept.map((k) => k.abbr));

  const n = kept.length;
  const step = n > 1 ? (W - LEFT_PAD - RIGHT_PAD) / (n - 1) : 0;
  const nodes: NodeDatum[] = kept.map((k, i) => ({
    abbr: k.abbr,
    name: nameByAbbr.get(k.abbr) ?? k.abbr,
    x: n > 1 ? LEFT_PAD + i * step : W / 2,
    leads: leadsAny.has(k.abbr),
    leadDeg: k.lead,
    sleepDeg: k.sleep,
  }));
  const xByAbbr = new Map(nodes.map((node) => [node.abbr, node.x]));

  // Only draw arcs whose both endpoints survived the node cap.
  const drawableArcs = allArcs.filter(
    (a) => keptSet.has(a.lead) && keptSet.has(a.sleeper),
  );
  // Past the hairball threshold, keep the structural links (weight ≥ 2 shared
  // products) plus every void arc, and footnote the thin single-product rest.
  let arcs = drawableArcs;
  let culledArcCount = 0;
  if (drawableArcs.length > ARC_CAP) {
    arcs = drawableArcs.filter((a) => a.weight >= 2 || a.isVoid);
    culledArcCount = drawableArcs.length - arcs.length;
  }

  const pinnedNode = pinned ? nodes.find((node) => node.abbr === pinned) : null;
  const pinnedStats = pinned ? stats.get(pinned) : null;

  return (
    <div className="font-mono">
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5"
            style={{ background: "var(--stamp)" }}
          />
          sleeper deploys nothing similar (void)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5"
            style={{ background: "var(--muted-foreground)", opacity: 0.85 }}
          />
          sleeper has a similar tool
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 border"
            style={{ background: "var(--foreground)" }}
          />
          leads ≥1 product
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 border"
            style={{ background: "var(--stamp)" }}
          />
          only sleeps
        </span>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Peer-proof arcs: ${arcs.length} lead-to-sleeper links across ${nodes.length} agencies.`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* Axis baseline */}
          <line
            x1={LEFT_PAD - 8}
            y1={BASELINE_Y}
            x2={W - RIGHT_PAD + 8}
            y2={BASELINE_Y}
            stroke="var(--border)"
            strokeWidth={1}
          />

          {/* Arcs above the axis */}
          {arcs.map((arc) => {
            const xl = xByAbbr.get(arc.lead) as number;
            const xs = xByAbbr.get(arc.sleeper) as number;
            const a = Math.min(xl, xs);
            const b = Math.max(xl, xs);
            const dist = b - a;
            const rx = dist / 2;
            const ry = Math.min(dist / 2, MAX_RISE);
            // sweep-flag 1 bows the arc up over the axis (SVG y-down).
            const d = `M ${a} ${BASELINE_Y} A ${rx} ${ry} 0 0 1 ${b} ${BASELINE_Y}`;
            const active = pinned
              ? arc.lead === pinned || arc.sleeper === pinned
              : null;
            const opacity =
              active === null
                ? OPACITY_REST
                : active
                  ? OPACITY_ACTIVE
                  : OPACITY_FADED;
            return (
              <path
                key={arc.key}
                d={d}
                data-arc={arc.key}
                data-void={arc.isVoid ? "true" : "false"}
                data-weight={arc.weight}
                fill="none"
                stroke={arc.isVoid ? "var(--stamp)" : "var(--muted-foreground)"}
                strokeWidth={clamp(STROKE_MIN, STROKE_MAX, arc.weight)}
                strokeOpacity={opacity}
                strokeLinecap="round"
              />
            );
          })}

          {/* Nodes: square at baseline + rotated mono label below */}
          {nodes.map((node) => {
            const dim =
              pinned && pinned !== node.abbr
                ? arcs.some(
                    (a) =>
                      (a.lead === node.abbr && a.sleeper === pinned) ||
                      (a.sleeper === node.abbr && a.lead === pinned),
                  )
                  ? 1
                  : 0.4
                : 1;
            return (
              <g
                key={node.abbr}
                data-agency={node.abbr}
                role="button"
                tabIndex={0}
                aria-label={`${node.abbr} — leads ${node.leadDeg}, sleeps ${node.sleepDeg}`}
                style={{ cursor: "pointer", outline: "none" }}
                opacity={dim}
                onMouseEnter={() => setPinned(node.abbr)}
                onMouseLeave={() =>
                  setPinned((p) => (p === node.abbr ? null : p))
                }
                onFocus={() => setPinned(node.abbr)}
                onBlur={() => setPinned((p) => (p === node.abbr ? null : p))}
              >
                <rect
                  x={node.x - NODE / 2}
                  y={BASELINE_Y - NODE / 2}
                  width={NODE}
                  height={NODE}
                  fill={node.leads ? "var(--foreground)" : "var(--stamp)"}
                />
                <text
                  x={node.x}
                  y={BASELINE_Y + 12}
                  textAnchor="end"
                  transform={`rotate(-45 ${node.x} ${BASELINE_Y + 12})`}
                  fontSize={10}
                  fill="var(--muted-foreground)"
                >
                  {node.abbr}
                </text>
              </g>
            );
          })}
        </svg>

        {pinnedNode && pinnedStats ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 w-64 border border-foreground bg-background p-2.5 text-left shadow-[4px_4px_0_0_var(--border)]"
            style={{
              left: `${clamp(12, 82, (pinnedNode.x / W) * 100)}%`,
              top: `${(BASELINE_Y / H) * 100}%`,
              transform: "translate(-50%, -115%)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--stamp)]">
              {pinnedNode.abbr}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {pinnedNode.name}
            </p>
            {pinnedStats.ledProducts.length > 0 ? (
              <p className="mt-1.5 text-[0.78rem] leading-snug text-foreground/80">
                <span className="uppercase tracking-[0.1em] text-[9.5px] text-muted-foreground">
                  as lead ·{" "}
                </span>
                <span className="tabular-nums font-semibold">
                  {pinnedStats.ledProducts.length}
                </span>{" "}
                {pinnedStats.ledProducts.length === 1 ? "product" : "products"}{" "}
                proven for{" "}
                <span className="tabular-nums font-semibold">
                  {pinnedStats.provenFor.length}
                </span>{" "}
                {pinnedStats.provenFor.length === 1 ? "agency" : "agencies"}
              </p>
            ) : null}
            {pinnedStats.sleptProducts.length > 0 ? (
              <div className="mt-1.5 text-[0.78rem] leading-snug text-foreground/80">
                <p>
                  <span className="uppercase tracking-[0.1em] text-[9.5px] text-muted-foreground">
                    as sleeper ·{" "}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {pinnedStats.sleptProducts.length}
                  </span>{" "}
                  peer-proven, reports nothing
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {pinnedStats.sleptProducts.slice(0, 3).map((s) => (
                    <li
                      key={s.product}
                      className={
                        s.isVoid ? "text-[var(--stamp)]" : "text-muted-foreground"
                      }
                    >
                      {s.isVoid ? "◆ " : "· "}
                      {s.product}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {droppedCount > 0 || culledArcCount > 0 ? (
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          {droppedCount > 0
            ? `…+${droppedCount} ${droppedCount === 1 ? "agency" : "agencies"} with fewer links not drawn.`
            : ""}
          {droppedCount > 0 && culledArcCount > 0 ? " " : ""}
          {culledArcCount > 0
            ? `${culledArcCount} single-product links omitted for legibility; every void and every two-or-more-product link is drawn.`
            : ""}
        </p>
      ) : null}

      <p className="mt-3 max-w-[68ch] text-[10.5px] leading-relaxed text-muted-foreground">
        An arc is one agency&apos;s reported use of a product another agency holds
        authorized but reports nothing on — drawn in vermilion when the sleeper
        has deployed nothing similar in the capability class.
      </p>
    </div>
  );
}

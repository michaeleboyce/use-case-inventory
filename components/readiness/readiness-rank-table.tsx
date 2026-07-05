"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ReadinessDerivation } from "@/components/readiness/readiness-derivation";
import { TermChip } from "@/components/term-chip";
import { READINESS_TIER_DEFS } from "@/lib/definitions";
import type { AgencyReadinessWithName } from "@/lib/types/inventory";

/**
 * Sortable client-component ranked table for the /readiness hub.
 *
 * Columns: Chevron · Rank · Agency abbr · Agency name · Composite ·
 * 5 subscores · Tier · View. Subscore cells get a subtle bg tint based
 * on threshold:
 *
 *   ≥ 70  → verified (strong)
 *   40–69 → highlight (mid)
 *   < 40  → stamp (weak)
 *
 * Click any column header to sort by that column (toggles asc/desc). Default
 * sort: rank ascending (1 = best).
 *
 * Click a row to expand its score derivation in place — the "X of Y" inputs,
 * weight arithmetic, and methodology links per dimension (the same
 * `headline_inputs` the agency scorecard renders as hover tooltips). The
 * agency-name and "View →" links still navigate (stopPropagation).
 */
type SortKey =
  | "rank"
  | "agency"
  | "composite"
  | "internal"
  | "frontier"
  | "procurement"
  | "risk_gov"
  | "adoption"
  | "tier";

type SortDir = "asc" | "desc";

const TIER_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

const TIER_BADGE: Record<string, string> = {
  A: "bg-[var(--verified)]/15 text-[var(--verified)] border-[var(--verified)]/40",
  B: "bg-[var(--verified)]/8 text-[var(--verified)] border-[var(--verified)]/25",
  C: "bg-[var(--highlight)]/25 text-foreground border-[var(--highlight)]/50",
  D: "bg-[var(--stamp)]/10 text-[var(--stamp)] border-[var(--stamp)]/25",
  F: "bg-[var(--stamp)]/18 text-[var(--stamp)] border-[var(--stamp)]/45",
};

function scoreCellClass(score: number): string {
  if (score >= 70) return "bg-[var(--verified)]/10 text-[var(--verified)]";
  if (score >= 40) return "bg-[var(--highlight)]/20 text-foreground";
  return "bg-[var(--stamp)]/8 text-[var(--stamp)]";
}

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

export function ReadinessRankTable({
  rows,
}: {
  rows: AgencyReadinessWithName[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpanded(agencyId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(agencyId)) next.delete(agencyId);
      else next.add(agencyId);
      return next;
    });
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "agency":
          av = a.agency_abbreviation;
          bv = b.agency_abbreviation;
          break;
        case "composite":
          av = a.composite_score;
          bv = b.composite_score;
          break;
        case "internal":
          av = a.internal_capacity;
          bv = b.internal_capacity;
          break;
        case "frontier":
          av = a.frontier_capability;
          bv = b.frontier_capability;
          break;
        case "procurement":
          av = a.procurement_hygiene;
          bv = b.procurement_hygiene;
          break;
        case "risk_gov":
          av = a.risk_relevant_governance;
          bv = b.risk_relevant_governance;
          break;
        case "adoption":
          av = a.adoption_breadth;
          bv = b.adoption_breadth;
          break;
        case "tier":
          av = TIER_RANK[a.tier] ?? 99;
          bv = TIER_RANK[b.tier] ?? 99;
          break;
        case "rank":
        default:
          av = a.rank;
          bv = b.rank;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Numeric columns generally read better descending by default;
      // textual / ordinal columns ascending.
      setSortDir(
        key === "agency" || key === "rank" || key === "tier" ? "asc" : "desc",
      );
    }
  }

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="w-7 border-b border-border px-1 py-2" aria-label="Expand" />
            <Th label="#" k="rank" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Agency" k="agency" sortKey={sortKey} sortDir={sortDir} onClick={toggle} />
            <Th label="Composite" k="composite" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Internal" k="internal" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Frontier" k="frontier" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Procurement" k="procurement" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Risk Gov" k="risk_gov" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Adoption" k="adoption" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Tier" k="tier" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="center" />
            <th className="border-b border-border px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              View
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const isOpen = expanded.has(r.agency_id);
            return (
            <Fragment key={r.agency_id}>
            <tr
              className={`cursor-pointer border-b border-border hover:bg-muted/20 ${isOpen ? "bg-muted/20" : ""}`}
              onClick={() => toggleExpanded(r.agency_id)}
              aria-expanded={isOpen}
            >
              <td className="w-7 px-1 py-2 align-middle">
                <span
                  className="inline-flex size-5 items-center justify-center text-muted-foreground/60"
                  aria-hidden
                >
                  {isOpen ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </span>
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {r.rank}
              </td>
              <td className="px-2 py-2">
                <Link
                  href={`/agencies/${r.agency_slug}#scorecard`}
                  className="block min-w-0"
                  title={r.agency_name}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.04em] text-foreground">
                    {r.agency_abbreviation}
                  </span>
                  <span className="ml-2 truncate font-display italic text-[0.95rem] text-foreground">
                    {r.agency_name}
                  </span>
                </Link>
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-foreground">
                {fmt(r.composite_score)}
              </td>
              <td className={`px-2 py-2 text-right font-mono tabular-nums ${scoreCellClass(r.internal_capacity)}`}>
                {fmt(r.internal_capacity)}
              </td>
              <td className={`px-2 py-2 text-right font-mono tabular-nums ${scoreCellClass(r.frontier_capability)}`}>
                {fmt(r.frontier_capability)}
              </td>
              <td className={`px-2 py-2 text-right font-mono tabular-nums ${scoreCellClass(r.procurement_hygiene)}`}>
                {fmt(r.procurement_hygiene)}
              </td>
              <td className={`px-2 py-2 text-right font-mono tabular-nums ${scoreCellClass(r.risk_relevant_governance)}`}>
                {fmt(r.risk_relevant_governance)}
              </td>
              <td className={`px-2 py-2 text-right font-mono tabular-nums ${scoreCellClass(r.adoption_breadth)}`}>
                {fmt(r.adoption_breadth)}
              </td>
              <td className="px-2 py-2 text-center">
                {READINESS_TIER_DEFS[r.tier] ? (
                  <TermChip
                    term={READINESS_TIER_DEFS[r.tier]}
                    className={TIER_BADGE[r.tier] ?? ""}
                    href="/readiness/methodology"
                    hrefLabel="Methodology →"
                  >
                    {r.tier}
                  </TermChip>
                ) : (
                  <span
                    className={`inline-block border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${TIER_BADGE[r.tier] ?? ""}`}
                    title={r.tier_label}
                  >
                    {r.tier}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-right">
                <Link
                  href={`/agencies/${r.agency_slug}#scorecard`}
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-[var(--stamp)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  View →
                </Link>
              </td>
            </tr>
            {isOpen ? (
              <tr className="border-b border-border bg-[var(--highlight)]/10">
                <td colSpan={11} className="px-4 py-4 md:px-10">
                  <ReadinessDerivation readiness={r} />
                </td>
              </tr>
            ) : null}
            </Fragment>
            );
          })}
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-6 text-center font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground/60">
                No readiness data available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sortKey === k;
  const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      className={`border-b border-border px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] ${alignClass} ${active ? "text-foreground" : "text-muted-foreground"}`}
    >
      <button
        type="button"
        onClick={() => onClick(k)}
        className="cursor-pointer transition-colors hover:text-foreground"
      >
        {label}
        {arrow}
      </button>
    </th>
  );
}

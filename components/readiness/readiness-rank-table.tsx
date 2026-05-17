"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AgencyReadinessWithName } from "@/lib/types/inventory";

/**
 * Sortable client-component ranked table for the /readiness hub.
 *
 * Columns: Rank · Agency abbr · Agency name · Composite · 5 subscores · Tier · View.
 * Subscore cells get a subtle bg tint based on threshold:
 *
 *   ≥ 70  → emerald (strong)
 *   40–69 → amber  (mid)
 *   < 40  → rose   (weak)
 *
 * Click any column header to sort by that column (toggles asc/desc). Default
 * sort: rank ascending (1 = best).
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
  A: "bg-emerald-100 text-emerald-900 border-emerald-300",
  B: "bg-blue-100 text-blue-900 border-blue-300",
  C: "bg-amber-100 text-amber-900 border-amber-300",
  D: "bg-orange-100 text-orange-900 border-orange-300",
  F: "bg-rose-100 text-rose-900 border-rose-300",
};

function scoreCellClass(score: number): string {
  if (score >= 70) return "bg-emerald-50 text-emerald-900";
  if (score >= 40) return "bg-amber-50 text-amber-900";
  return "bg-rose-50 text-rose-900";
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
    <div className="overflow-x-auto border border-stone-300">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-stone-100">
          <tr>
            <Th label="#" k="rank" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Agency" k="agency" sortKey={sortKey} sortDir={sortDir} onClick={toggle} />
            <Th label="Composite" k="composite" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Internal" k="internal" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Frontier" k="frontier" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Procurement" k="procurement" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Risk Gov" k="risk_gov" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Adoption" k="adoption" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
            <Th label="Tier" k="tier" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="center" />
            <th className="border-b border-stone-300 px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
              View
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.agency_id} className="border-b border-stone-200 hover:bg-stone-50">
              <td className="px-2 py-2 text-right font-mono tabular-nums text-stone-600">
                {r.rank}
              </td>
              <td className="px-2 py-2">
                <Link
                  href={`/agencies/${r.agency_slug}#scorecard`}
                  className="block min-w-0"
                  title={r.agency_name}
                >
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.04em] text-stone-900">
                    {r.agency_abbreviation}
                  </span>
                  <span className="ml-2 truncate font-display italic text-[0.95rem] text-stone-700">
                    {r.agency_name}
                  </span>
                </Link>
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-stone-900">
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
                <span
                  className={`inline-block border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${TIER_BADGE[r.tier] ?? ""}`}
                  title={r.tier_label}
                >
                  {r.tier}
                </span>
              </td>
              <td className="px-2 py-2 text-right">
                <Link
                  href={`/agencies/${r.agency_slug}#scorecard`}
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500 hover:text-[var(--stamp)]"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center font-mono text-xs uppercase tracking-[0.14em] text-stone-400">
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
      className={`border-b border-stone-300 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] ${alignClass} ${active ? "text-stone-900" : "text-stone-500"}`}
    >
      <button
        type="button"
        onClick={() => onClick(k)}
        className="cursor-pointer transition-colors hover:text-stone-900"
      >
        {label}
        {arrow}
      </button>
    </th>
  );
}

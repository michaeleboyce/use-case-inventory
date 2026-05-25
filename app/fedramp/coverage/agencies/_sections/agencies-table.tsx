"use client";

/**
 * Client-side searchable table for /fedramp/coverage/agencies. Each row
 * still drills through to the per-agency page (not expandable here) — the
 * deep-dive happens at /fedramp/coverage/agencies/[abbr]. The search box
 * just narrows the visible rows by abbreviation or name substring.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";
import type { CoverageAgencyRow } from "@/lib/types";

export function AgenciesCoverageTable({
  rows,
}: {
  rows: CoverageAgencyRow[];
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.agency_abbreviation.toLowerCase().includes(q) ||
        r.agency_name.toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div>
      <div className="border-t-2 border-foreground pt-4 mb-4 flex flex-wrap items-baseline gap-3">
        <label
          htmlFor="coverage-agencies-search"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          Search agencies
        </label>
        <input
          id="coverage-agencies-search"
          type="search"
          placeholder="abbr or name (e.g. DOJ, Health)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[16rem] border border-border bg-background px-2 py-1 font-mono text-[12px] text-foreground placeholder:text-muted-foreground/70 hover:border-foreground focus:border-[var(--stamp)] focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)] hover:underline"
          >
            clear
          </button>
        ) : null}
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {formatNumber(filtered.length)} / {formatNumber(rows.length)} shown
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th>#</Th>
              <Th>Agency</Th>
              <Th align="left">Name</Th>
              <Th align="right">Use cases</Th>
              <Th align="right">AI products in ATO scope</Th>
              <Th align="right">Reported (matched)</Th>
              <Th align="right">Gap</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const href = `/fedramp/coverage/agencies/${row.agency_abbreviation}`;
              const isGap = row.authorized_but_unreported > 0;
              return (
                <tr
                  key={row.inventory_agency_id}
                  className="border-b border-border/60 hover:bg-muted/30"
                >
                  <td className="px-2 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="px-2 py-2">
                    <MonoChip href={href} tone="stamp" size="xs">
                      {row.agency_abbreviation}
                    </MonoChip>
                  </td>
                  <td className="px-2 py-2">
                    <Link
                      href={href}
                      className="text-foreground hover:text-[var(--stamp)]"
                    >
                      {row.agency_name}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatNumber(row.use_case_count)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {row.fedramp_authorized_count > 0
                      ? formatNumber(row.fedramp_authorized_count)
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    {row.fedramp_used_count > 0
                      ? formatNumber(row.fedramp_used_count)
                      : "—"}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${
                      isGap
                        ? "font-medium text-[var(--stamp)]"
                        : "text-muted-foreground"
                    }`}
                  >
                    {isGap ? formatNumber(row.authorized_but_unreported) : "—"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  No agencies match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

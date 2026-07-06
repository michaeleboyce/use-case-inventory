"use client";

/**
 * V2 — the frontier grid: agencies × gen-AI platforms, five cell states.
 *
 *   ■  lead        — the agency reports the product in its AI inventory
 *   ◪  sleeping    — in reach + peer-proven, but something similar deployed
 *   □  void        — sleeping AND nothing in the capability class at all
 *   ▨  timing      — in reach only after the inventory cutoff (grayed)
 *      (blank)     — not in reach, not reported
 *
 * Hover OR keyboard focus opens a dependency-free popover with the first
 * host ATO date, the host package(s), and the product's lead users. Click
 * scrolls to the product's board row. Built on the fit-grid HTML-table
 * pattern; glyph vocabulary follows category-topic-heatmap.
 */

import { useMemo, useState } from "react";
import type { GridColumn, GridRow, GridCell } from "../_shared";
import { applyPermutation, seriate, type CellWeight } from "../_seriation";
import { formatDate } from "@/lib/formatting";

/** Cell severity as a seriation weight: void heaviest, similar lighter. */
function cellWeight(state: GridCell["state"]): CellWeight {
  return state === "sleeping_void" ? 2 : state === "sleeping_similar" ? 1 : 0;
}

const STATE_GLYPH: Record<GridCell["state"], string> = {
  lead: "■",
  sleeping_similar: "◪",
  sleeping_void: "□",
  timing_excluded: "▨",
  no_reach: "",
};

const STATE_CLASS: Record<GridCell["state"], string> = {
  lead: "text-foreground",
  sleeping_similar: "text-[var(--stamp)]/70",
  sleeping_void: "text-[var(--stamp)] font-bold",
  timing_excluded: "text-muted-foreground/50",
  no_reach: "text-transparent",
};

const STATE_LABEL: Record<GridCell["state"], string> = {
  lead: "Reports it",
  sleeping_similar: "Sleeping — similar capability deployed",
  sleeping_void: "Sleeping — nothing similar deployed",
  timing_excluded: "In reach only post-inventory (excluded)",
  no_reach: "Not in reach",
};

export function FrontierGrid({
  columns,
  rows,
  leadsByProduct,
}: {
  columns: GridColumn[];
  rows: GridRow[];
  /** product -> lead agency abbreviations, for the popover. */
  leadsByProduct: Record<string, string[]>;
}) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [ordering, setOrdering] = useState<"gap_block" | "severity">(
    "gap_block",
  );

  // Seriation permutes into the ORIGINAL columns/rows; recompute only when
  // the underlying rows change identity, not on pin/hover state. (Columns
  // always change together with rows — the cells are column-parallel.)
  const { rowOrder, colOrder } = useMemo(() => {
    const weights: CellWeight[][] = rows.map((r) =>
      r.cells.map((cell) => cellWeight(cell.state)),
    );
    return seriate(weights);
  }, [rows]);

  // "gap_block" = the seriated (default) view; "severity" = props order,
  // bit-for-bit the server's original ordering (the preserved regression case).
  const seriated = ordering === "gap_block";
  const displayColumns = seriated
    ? applyPermutation(columns, colOrder)
    : columns;
  const displayRows = seriated ? applyPermutation(rows, rowOrder) : rows;
  const maxGap = Math.max(...rows.map((x) => x.sleeping_count), 1);

  return (
    <div className="relative overflow-x-auto">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Order
        </span>
        <OrderChip
          active={seriated}
          onClick={() => setOrdering("gap_block")}
          label="By gap block"
        />
        <OrderChip
          active={!seriated}
          onClick={() => setOrdering("severity")}
          label="By severity"
        />
      </div>
      <p className="mb-3 font-mono text-[10px] text-muted-foreground">
        {seriated
          ? "ordered so sleeping/void mass forms a contiguous block"
          : "ordered by void count (original)"}
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-background py-2 pr-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Agency
            </th>
            {displayColumns.map((c) => (
              <th
                key={c.product}
                className="px-1 pb-2 text-center align-bottom font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
              >
                <a href={`#board-${c.slug}`} className="hover:text-foreground">
                  <span className="inline-block max-w-[5.5rem] whitespace-normal leading-tight [writing-mode:initial]">
                    {c.product}
                  </span>
                </a>
                <div className="mt-1 tabular-nums text-[9.5px] text-muted-foreground/70">
                  {c.lead_count}/{c.reach_count}
                </div>
              </th>
            ))}
            <th className="px-2 pb-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Gap
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {displayRows.map((r) => {
            const cells = seriated
              ? applyPermutation(r.cells, colOrder)
              : r.cells;
            return (
              <tr key={r.agency_id} className="hover:bg-muted/20">
                <th className="sticky left-0 bg-background py-1 pr-3 text-left font-mono text-[11px] font-medium text-foreground">
                  <span title={r.agency_name}>{r.agency_abbr}</span>
                </th>
                {cells.map((cell, i) => {
                  const col = displayColumns[i];
                  const key = `${r.agency_id}|${col.product}`;
                  return (
                    <td key={col.product} className="relative px-1 py-1 text-center">
                      {cell.state === "no_reach" ? (
                        <span aria-label={STATE_LABEL.no_reach} className="text-muted-foreground/20">
                          ·
                        </span>
                      ) : (
                        <a
                          href={`#board-${col.slug}`}
                          tabIndex={0}
                          aria-label={`${r.agency_abbr} × ${col.product}: ${STATE_LABEL[cell.state]}`}
                          className={`inline-block px-1 text-[15px] leading-none outline-offset-2 ${STATE_CLASS[cell.state]}`}
                          onMouseEnter={() => setPinned(key)}
                          onMouseLeave={() => setPinned((p) => (p === key ? null : p))}
                          onFocus={() => setPinned(key)}
                          onBlur={() => setPinned((p) => (p === key ? null : p))}
                        >
                          {STATE_GLYPH[cell.state]}
                        </a>
                      )}
                      {pinned === `${r.agency_id}|${col.product}` && cell.detail ? (
                        <CellPopover
                          agency={r.agency_abbr}
                          product={col.product}
                          state={cell.state}
                          firstAto={cell.detail.first_ato_date}
                          hosts={cell.detail.host_packages}
                          similar={cell.detail.similar_products}
                          leads={leadsByProduct[col.product] ?? []}
                        />
                      ) : null}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 bg-[var(--stamp)]/50"
                      style={{ width: `${(r.sleeping_count / maxGap) * 2.6}rem` }}
                    />
                    <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                      {r.sleeping_count}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {(Object.keys(STATE_GLYPH) as GridCell["state"][])
          .filter((s) => s !== "no_reach")
          .map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`text-[13px] ${STATE_CLASS[s]}`}>{STATE_GLYPH[s]}</span>
              {STATE_LABEL[s]}
            </span>
          ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground/40">·</span> Not in reach
        </span>
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
        Column header: lead users / agencies in reach. Hover or focus a cell
        for dates and hosts; click to jump to its board row.
      </p>
    </div>
  );
}

function OrderChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  const base =
    "inline-flex items-center border bg-background font-mono font-semibold uppercase tracking-[0.06em] transition-colors px-2 py-0.5 text-[11px]";
  const activeRing = "border-foreground text-foreground";
  const idle = "border-border text-muted-foreground hover:text-foreground";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${base} ${active ? activeRing : idle}`}
    >
      {label}
    </button>
  );
}

function CellPopover({
  agency,
  product,
  state,
  firstAto,
  hosts,
  similar,
  leads,
}: {
  agency: string;
  product: string;
  state: GridCell["state"];
  firstAto: string | null;
  hosts: string[];
  similar: string[];
  leads: string[];
}) {
  return (
    <div
      role="tooltip"
      className="absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 border border-foreground bg-background p-3 text-left shadow-[4px_4px_0_0_var(--border)]"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--stamp)]">
        {agency} × {product}
      </p>
      <p className="mt-1 text-[0.82rem] font-medium leading-snug text-foreground">
        {STATE_LABEL[state]}
      </p>
      <dl className="mt-2 space-y-1 text-[0.78rem] leading-snug text-muted-foreground">
        <div>
          <dt className="inline font-mono text-[9.5px] uppercase tracking-[0.1em]">
            first host ATO ·{" "}
          </dt>
          <dd className="inline text-foreground/80">
            {firstAto ? formatDate(firstAto) : "no usable date"}
          </dd>
        </div>
        {hosts.length > 0 ? (
          <div>
            <dt className="inline font-mono text-[9.5px] uppercase tracking-[0.1em]">
              via ·{" "}
            </dt>
            <dd className="inline text-foreground/80">{hosts.join("; ")}</dd>
          </div>
        ) : null}
        {leads.length > 0 ? (
          <div>
            <dt className="inline font-mono text-[9.5px] uppercase tracking-[0.1em]">
              lead users ·{" "}
            </dt>
            <dd className="inline text-foreground/80">{leads.join(", ")}</dd>
          </div>
        ) : null}
        {similar.length > 0 ? (
          <div>
            <dt className="inline font-mono text-[9.5px] uppercase tracking-[0.1em]">
              similar deployed ·{" "}
            </dt>
            <dd className="inline text-foreground/80">{similar.join(", ")}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

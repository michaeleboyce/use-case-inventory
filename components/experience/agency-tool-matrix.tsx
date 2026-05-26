"use client";

import * as React from "react";
import Link from "next/link";
import {
  MATRIX_PRODUCT_BUCKETS,
  type AgencyToolMatrixRow,
  type MatrixCell,
  type MatrixCellEntry,
} from "@/lib/experience-shared";
import { cn } from "@/lib/utils";

/**
 * Per-agency LLM-tool availability matrix.
 *
 * Rows: agencies that reported at least one license band on a row matching
 *       one of the matrix products.
 * Cols: 7 LLM product families (MS Copilot, GitHub Copilot, ChatGPT, Claude,
 *       Gemini, Amazon Q, Agency-built).
 * Cells: the largest license band an agency has on a row mentioning that
 *        product family. Hovering a cell exposes the underlying entries
 *        (up to 8); clicking an entry navigates to its use-case detail.
 *
 * Source: `consolidated_use_cases.estimated_licenses_users`. The bands are
 * agency self-reported and bucketed coarsely on purpose; treat the cells as
 * "at-least-this-many seats" rather than precise counts.
 */
export function AgencyToolMatrix({ rows }: { rows: AgencyToolMatrixRow[] }) {
  const sorted = [...rows]
    .filter((r) => Object.keys(r.cells).length > 0)
    .sort((a, b) => b.estimated_seats - a.estimated_seats);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No matched license bands in the consolidated use cases.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Agency
            </th>
            {MATRIX_PRODUCT_BUCKETS.map((b) => (
              <th
                key={b.key}
                className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {b.label}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Est. seats
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.agency_id} className="border-b border-border/50">
              <td className="px-3 py-2 align-middle">
                <span className="font-mono text-xs font-semibold">
                  {row.abbreviation}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {row.name}
                </span>
              </td>
              {MATRIX_PRODUCT_BUCKETS.map((b) => {
                const cell = row.cells[b.key];
                return (
                  <td
                    key={b.key}
                    className="px-2 py-1 text-center align-middle"
                  >
                    {cell ? <CellHover cell={cell} /> : <Dash />}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                {row.estimated_seats > 0
                  ? row.estimated_seats.toLocaleString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Cells show the largest license band the agency has filed on any
        consolidated-inventory row mentioning that product family. Hover any
        cell to see the underlying entries; click an entry to open the
        use-case detail.
      </p>
    </div>
  );
}

const BAND_TONE: Record<string, string> = {
  "1-100": "bg-stone-100 text-stone-700",
  "101-1000": "bg-amber-100 text-amber-800",
  "1001-5000": "bg-orange-200 text-orange-900",
  "5001-10,000": "bg-rose-200 text-rose-900",
  "10,000-50,000": "bg-rose-300 text-rose-950",
  "50,000+": "bg-rose-500 text-white",
};

/**
 * A pill in a cell, plus a CSS-only popover that opens on hover/focus
 * listing the underlying consolidated_use_cases rows. Each row in the
 * popover is a link to /use-cases/[slug].
 *
 * Uses `group/cell` so the popover only opens for this cell's pill, not
 * a parent or sibling.
 */
function CellHover({ cell }: { cell: MatrixCell }) {
  const tone =
    BAND_TONE[cell.highest_band_label] ?? "bg-stone-100 text-stone-700";
  const extra = Math.max(0, cell.rows - cell.entries.length);

  return (
    <span className="group/cell relative inline-block">
      <button
        type="button"
        className={cn(
          "inline-block cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--stamp)]",
          tone,
        )}
        title={`${cell.rows} row${cell.rows === 1 ? "" : "s"} filed; largest band ${cell.highest_band_label}`}
      >
        {cell.highest_band_label}
      </button>
      {/* Popover. CSS-only: hover/focus on the wrapping span exposes it. */}
      <span
        role="dialog"
        aria-label="Underlying use cases"
        className="invisible absolute left-1/2 top-full z-50 mt-1 w-[22rem] -translate-x-1/2 border border-border bg-background p-3 text-left opacity-0 shadow-lg transition-opacity duration-100 group-hover/cell:visible group-hover/cell:opacity-100 group-focus-within/cell:visible group-focus-within/cell:opacity-100"
      >
        <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Underlying entries · top {cell.entries.length} of {cell.rows}
        </span>
        <span className="mt-2 block divide-y divide-border/50">
          {cell.entries.map((e) => (
            <EntryRow key={e.consolidated_use_case_id} entry={e} />
          ))}
        </span>
        {extra > 0 ? (
          <span className="mt-2 block text-[11px] text-muted-foreground">
            …{extra} more not shown.
          </span>
        ) : null}
      </span>
    </span>
  );
}

function EntryRow({ entry }: { entry: MatrixCellEntry }) {
  const content = (
    <>
      <span className="block text-xs font-medium leading-snug text-foreground">
        {truncate(entry.ai_use_case, 110)}
      </span>
      <span className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="block truncate text-[11px] text-muted-foreground">
          {entry.commercial_product || "—"}
        </span>
        <span className="block whitespace-nowrap font-mono text-[10px] text-muted-foreground">
          {entry.band_label}
        </span>
      </span>
    </>
  );

  if (entry.slug) {
    return (
      <Link
        href={`/use-cases/${entry.slug}`}
        className="block py-1.5 hover:bg-accent focus:bg-accent focus:outline-none"
      >
        {content}
      </Link>
    );
  }
  return <span className="block py-1.5">{content}</span>;
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function Dash() {
  return <span className="text-stone-300">·</span>;
}

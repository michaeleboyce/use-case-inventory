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
 * Two seat estimates per row, neither replacing the other:
 *   - "Filed bands"      — sum of license-band midpoints from
 *                          `consolidated_use_cases.estimated_licenses_users`.
 *   - "Headcount-derived" — workforce × AI-eligible share × Σ per-tool
 *                          share-of-eligible. NULL until the multi-agent
 *                          backfill populates `agency_workforce_profile`
 *                          for that agency.
 *
 * Each cell exposes the underlying entries on hover. Entries are tagged
 * `Appendix B` (consolidated) or `Filing` (individual use_case row).
 */
export function AgencyToolMatrix({ rows }: { rows: AgencyToolMatrixRow[] }) {
  const sorted = [...rows]
    .filter((r) => Object.keys(r.cells).length > 0)
    .sort((a, b) => b.estimated_seats_filed - a.estimated_seats_filed);

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
            <th
              className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
              title="Sum of license-band midpoints from the consolidated inventory."
            >
              Filed bands
            </th>
            <th
              className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
              title="Workforce × AI-eligible share × Σ per-tool share-of-eligible. NULL until backfill data lands for that agency."
            >
              Headcount-derived
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
                {row.estimated_seats_filed > 0
                  ? row.estimated_seats_filed.toLocaleString()
                  : "—"}
              </td>
              <td
                className="px-3 py-2 text-right font-mono text-xs tabular-nums"
                title={row.headcount_breakdown ?? "Workforce data not yet researched for this agency."}
              >
                {row.estimated_seats_headcount != null
                  ? row.estimated_seats_headcount.toLocaleString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        <strong>Filed bands</strong> = sum of OMB-filed license-band midpoints
        (the seat count agencies self-report).{" "}
        <strong>Headcount-derived</strong> = total workforce × IFP-researched
        AI-eligible share × Σ per-tool share-of-eligible. Cells show the
        largest license band on file; hover any cell for the underlying
        entries. <span className="font-mono">Appendix B</span> entries come
        from the consolidated form; <span className="font-mono">Filing</span>{" "}
        entries come from an individual M-25-21 use-case filing.
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

function CellHover({ cell }: { cell: MatrixCell }) {
  const hasBand = cell.highest_band_upper > 0;
  const pillLabel = hasBand
    ? cell.highest_band_label
    : `${cell.entries.length} filing${cell.entries.length === 1 ? "" : "s"}`;
  const tone = hasBand
    ? BAND_TONE[cell.highest_band_label] ?? "bg-stone-100 text-stone-700"
    : "bg-stone-50 text-stone-600 border border-stone-200";
  const extra = Math.max(0, cell.rows - cell.entries.length);

  return (
    <span className="group/cell relative inline-block">
      <button
        type="button"
        className={cn(
          "inline-block cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--stamp)]",
          tone,
        )}
        title={
          hasBand
            ? `${cell.rows} row${cell.rows === 1 ? "" : "s"} filed; largest band ${cell.highest_band_label}`
            : `${cell.rows} individual filing${cell.rows === 1 ? "" : "s"}; no license band reported`
        }
      >
        {pillLabel}
      </button>
      <span
        role="dialog"
        aria-label="Underlying use cases"
        className="invisible absolute left-1/2 top-full z-50 mt-1 w-[24rem] -translate-x-1/2 border border-border bg-background p-3 text-left opacity-0 shadow-lg transition-opacity duration-100 group-hover/cell:visible group-hover/cell:opacity-100 group-focus-within/cell:visible group-focus-within/cell:opacity-100"
      >
        <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Underlying entries · top {cell.entries.length} of {cell.rows}
        </span>
        <span className="mt-2 block divide-y divide-border/50">
          {cell.entries.map((e) => (
            <EntryRow key={`${e.source}-${e.row_id}`} entry={e} />
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
  const sourceChipTone =
    entry.source === "consolidated"
      ? "bg-stone-100 text-stone-700"
      : "bg-amber-50 text-amber-800 border border-amber-200";
  const sourceLabel = entry.source === "consolidated" ? "Appendix B" : "Filing";

  const content = (
    <>
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            "inline-block rounded px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
            sourceChipTone,
          )}
        >
          {sourceLabel}
        </span>
        <span
          className={cn(
            "block flex-1 text-xs font-medium leading-snug",
            entry.subsumed ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {truncate(entry.title, 110)}
        </span>
      </span>
      <span className="mt-0.5 flex items-baseline justify-between gap-2 pl-[3.5rem]">
        <span className="block truncate text-[11px] text-muted-foreground">
          {entry.commercial_product || "—"}
        </span>
        <span className="block whitespace-nowrap font-mono text-[10px] text-muted-foreground">
          {entry.band_label ?? "no band"}
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

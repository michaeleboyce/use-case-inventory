"use client";

import * as React from "react";
import {
  MATRIX_PRODUCT_BUCKETS,
  type AgencyToolMatrixRow,
  type MatrixCell,
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
 *        product family. Empty = no such row in the consolidated inventory.
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
                  <td key={b.key} className="px-2 py-1 text-center align-middle">
                    {cell ? <BandPill cell={cell} /> : <Dash />}
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
        consolidated-inventory row mentioning that product family. Seats are
        a midpoint extrapolation; an employee with multiple tools is counted
        per tool.
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

function BandPill({ cell }: { cell: MatrixCell }) {
  const tone = BAND_TONE[cell.highest_band_label] ?? "bg-stone-100 text-stone-700";
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
        tone,
      )}
      title={`${cell.rows} row${cell.rows === 1 ? "" : "s"} filed; largest band ${cell.highest_band_label}`}
    >
      {cell.highest_band_label}
    </span>
  );
}

function Dash() {
  return <span className="text-stone-300">·</span>;
}

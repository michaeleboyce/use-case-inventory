/**
 * Companion to the LLM-vendor donut (Fig. 07). Surfaces the per-agency
 * breakdown of the "Vendor unspecified" slice: who reports general-LLM
 * access without naming the underlying tool, ranked by absolute count.
 *
 * Bars are stacked: the named (recoverable) portion in the foreground and
 * the unspecified portion in the same muted slate-300 the donut uses for
 * its "Vendor unspecified" wedge — so reader's eye carries the same color
 * meaning across both visuals.
 */

"use client";

import * as React from "react";
import Link from "next/link";

export type VisibilityGapRow = {
  agency_id: number;
  abbreviation: string;
  name: string;
  total: number;
  unspecified: number;
  share: number;
};

const UNSPEC_COLOR = "#cbd5e1"; // slate-300 — matches LLMVendorDonut
const NAMED_COLOR = "#475569"; // slate-600 — recovered/named portion

export function VisibilityGapList({
  rows,
  limit = 10,
}: {
  rows: VisibilityGapRow[];
  limit?: number;
}) {
  const visible = React.useMemo(
    () => rows.slice(0, limit),
    [rows, limit],
  );

  if (visible.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No agencies have unspecified general-LLM entries.
      </div>
    );
  }

  // Scale bars to the largest TOTAL in the visible set, so a row's full
  // bar length reads as "this agency's total general-LLM-access volume."
  const maxTotal = visible.reduce((m, r) => Math.max(m, r.total), 0);

  return (
    <ol className="flex flex-col gap-1">
      {visible.map((row, idx) => {
        const totalPct = maxTotal === 0 ? 0 : (row.total / maxTotal) * 100;
        const unspecPct =
          row.total === 0 ? 0 : (row.unspecified / row.total) * 100;
        const namedPct = 100 - unspecPct;
        const sharePct = Math.round(row.share * 100);
        return (
          <li key={row.agency_id}>
            <Link
              href={`/agencies/${row.abbreviation.toLowerCase()}`}
              className="group grid grid-cols-[28px_72px_1fr_120px] items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/60"
              title={`${row.name} — ${row.unspecified} of ${row.total} general-LLM entries unspecified (${sharePct}%)`}
            >
              <span className="tabular-nums text-muted-foreground">
                {idx + 1}.
              </span>
              <span className="truncate font-medium text-foreground">
                {row.abbreviation}
              </span>
              <span
                aria-hidden
                className="relative h-4 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800"
                style={{ width: `${totalPct}%` }}
              >
                <span className="flex h-full w-full">
                  <span
                    className="block h-full transition-opacity group-hover:opacity-85"
                    style={{ width: `${namedPct}%`, background: NAMED_COLOR }}
                  />
                  <span
                    className="block h-full transition-opacity group-hover:opacity-85"
                    style={{ width: `${unspecPct}%`, background: UNSPEC_COLOR }}
                  />
                </span>
              </span>
              <span className="text-right font-mono tabular-nums text-foreground">
                <span>{row.unspecified}</span>
                <span className="text-muted-foreground"> / {row.total}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="tabular-nums">{sharePct}%</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

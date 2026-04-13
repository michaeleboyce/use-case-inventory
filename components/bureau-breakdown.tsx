/**
 * Bureau / component breakdown — editorial. Client Component because of the
 * show-all toggle. Rows are hairline-ruled; counts are tabular-nums; the
 * hit-bar is a thin hairline fill in ink, not a colored pill.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNumber, formatPercent } from "@/lib/formatting";
import type { BureauBreakdown as BureauRow } from "@/lib/types";
import { agencyUseCasesUrl } from "@/lib/urls";

const DEFAULT_VISIBLE = 15;

export function BureauBreakdown({
  rows,
  agencyId,
}: {
  rows: BureauRow[];
  agencyId?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    return (
      <p className="font-body text-sm text-muted-foreground">
        No bureau-level data reported.
      </p>
    );
  }

  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const visible = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = rows.length - DEFAULT_VISIBLE;

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border border-t border-b border-border">
        {visible.map((row) => {
          const pct = total > 0 ? (row.count / total) * 100 : 0;
          const gridClass =
            "grid grid-cols-[minmax(0,1fr)_8rem_4.5rem] items-center gap-x-4 py-2";
          const inner = (
            <>
              <p className="truncate font-body text-sm text-foreground">
                {row.label}
              </p>
              <div
                aria-hidden="true"
                className="relative h-[2px] w-full bg-border"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-foreground"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-baseline justify-end gap-2 font-mono text-[11px] tabular-nums uppercase tracking-[0.1em]">
                <span className="text-foreground">{formatNumber(row.count)}</span>
                <span className="text-muted-foreground">
                  {formatPercent(pct, 1)}
                </span>
              </div>
            </>
          );
          return (
            <li key={row.label}>
              {agencyId != null && row.bureau_component ? (
                <Link
                  href={agencyUseCasesUrl(agencyId, {
                    bureaus: [row.bureau_component],
                  })}
                  className={`${gridClass} -mx-2 px-2 transition-colors hover:bg-[var(--highlight)]/50`}
                >
                  {inner}
                </Link>
              ) : (
                <div className={gridClass}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground underline-offset-4 hover:text-[var(--stamp)] hover:underline"
        >
          {expanded ? "— Show top 15" : `+ Show all (${hiddenCount} more)`}
        </button>
      ) : null}
    </div>
  );
}

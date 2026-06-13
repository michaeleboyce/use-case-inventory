"use client";

/**
 * Per-agency silently-dropped ledger for /compare-years/silently-dropped.
 *
 * One row per agency that silently dropped an active 2024 use case: how
 * many use cases they filed in 2024, how many vanished, and what share.
 * USAID is included but flagged via `is_dissolved` and rendered with a
 * distinguishing marker — its disappearance is a legitimate, agency-wide
 * dissolution rather than a per-use-case compliance gap.
 *
 * Rows are expandable: click a row to reveal that agency's per-use-case
 * list (Deployed-first), without leaving the page. The agency-name cell
 * is wrapped in a `<Link>` so a click on the name itself still navigates
 * to the agency detail page (`stopPropagation` keeps the row from also
 * toggling). Built on the shared `ExpandableTable` scaffolding.
 *
 * Route-local: consumed only by `../page.tsx`.
 */

import { useMemo } from "react";
import Link from "next/link";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { ExpandableTable } from "@/components/expandable-table";
import {
  collapseWhitespace,
  formatNumber,
  formatPercent,
} from "@/lib/formatting";
import { stageBucket } from "@/lib/stage-buckets";
import type { SilentlyDroppedRow } from "@/lib/types";
import type { SilentlyDroppedAgencyRowExpanded } from "../_view-model";

const columnHelper = createColumnHelper<SilentlyDroppedAgencyRowExpanded>();

export function SilentlyDroppedAgencyTable({
  rows,
}: {
  rows: SilentlyDroppedAgencyRowExpanded[];
}) {
  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("abbreviation", {
          header: "Code",
          enableSorting: false,
          cell: (info) => (
            <MonoChip tone="ink" size="xs">
              {info.getValue()}
            </MonoChip>
          ),
        }),
        columnHelper.accessor("name", {
          header: "Agency",
          cell: (info) => {
            const r = info.row.original;
            return (
              <Link
                href={`/agencies/${r.abbreviation}`}
                onClick={(e) => e.stopPropagation()}
                className="font-display text-[1.02rem] italic leading-tight text-foreground hover:underline decoration-[var(--stamp)] underline-offset-[3px]"
              >
                {info.getValue()}
                {r.is_dissolved ? (
                  <span
                    className="ml-2 align-middle font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--stamp)]"
                    title="USAID was dismantled in 2025 and filed no 2025 inventory — its disappearance is a different category than the per-use-case compliance gap."
                  >
                    dissolved
                  </span>
                ) : null}
              </Link>
            );
          },
        }),
        columnHelper.accessor("filed_2024", {
          header: "Filed 2024",
          cell: (info) => (
            <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
              {info.getValue() > 0 ? formatNumber(info.getValue()) : "—"}
            </span>
          ),
          sortingFn: "basic",
        }),
        columnHelper.accessor("dropped", {
          header: "Dropped",
          cell: (info) => (
            <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--stamp)]">
              {formatNumber(info.getValue())}
            </span>
          ),
          sortingFn: "basic",
        }),
        columnHelper.accessor("pct_dropped", {
          header: "% of 2024",
          cell: (info) => {
            const v = info.getValue();
            if (v == null)
              return (
                <span className="font-mono text-[11px] text-muted-foreground">
                  —
                </span>
              );
            return (
              <span className="font-mono text-[12px] tabular-nums text-foreground">
                {formatPercent(v, 0)}
              </span>
            );
          },
          sortingFn: "basic",
        }),
      ] as ColumnDef<SilentlyDroppedAgencyRowExpanded, unknown>[],
    [],
  );

  return (
    <ExpandableTable
      rows={rows}
      columns={columns}
      getRowKey={(r) => r.abbreviation}
      numericColumnIds={["filed_2024", "dropped", "pct_dropped"]}
      initialSorting={[{ id: "dropped", desc: true }]}
      tableClassName="min-w-[640px]"
      emptyMessage="No agencies with silently-dropped use cases."
      renderExpanded={(r) =>
        r.rows.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            No use cases recorded.
          </p>
        ) : (
          <ul className="space-y-4 pl-4">
            {r.rows.map((uc) => (
              <ExpandedUseCaseItem key={uc.uc_2024_id} row={uc} />
            ))}
          </ul>
        )
      }
    />
  );
}

/** One use-case entry inside an expanded agency sub-row. Stage chip + name +
 *  line-clamped narrative (purpose_benefits + outputs). */
function ExpandedUseCaseItem({ row }: { row: SilentlyDroppedRow }) {
  const bucket = stageBucket(row.dev_stage);
  // Stamp tone for Deployed (the most striking), ink for Pilot, muted for
  // Pre-deployment and Retired.
  const tone =
    bucket === "Deployed"
      ? "stamp"
      : bucket === "Pilot"
        ? "ink"
        : "muted";
  const narrative = [
    collapseWhitespace(row.purpose_benefits),
    collapseWhitespace(row.outputs),
  ]
    .filter(Boolean)
    .join(" — ");
  return (
    <li className="border-l border-[var(--rule)] pl-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <MonoChip tone={tone} size="xs">
          {bucket}
        </MonoChip>
        <span className="font-display text-[1.02rem] italic leading-tight text-foreground">
          {row.use_case_name ?? "Untitled"}
        </span>
      </div>
      {narrative ? (
        <p className="mt-1.5 line-clamp-3 max-w-prose text-[0.9rem] leading-[1.55] text-foreground/80">
          {narrative}
        </p>
      ) : (
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          No narrative recorded.
        </p>
      )}
    </li>
  );
}

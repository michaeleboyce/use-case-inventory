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
 * toggling).
 *
 * Route-local: consumed only by `../page.tsx`.
 */

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type ExpandedState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MonoChip } from "@/components/editorial";
import { formatNumber, formatPercent } from "@/lib/formatting";
import type { SilentlyDroppedRow } from "@/lib/types";
import type { SilentlyDroppedAgencyRowExpanded } from "../_view-model";

const columnHelper = createColumnHelper<SilentlyDroppedAgencyRowExpanded>();

/** Bucket a raw `dev_stage` string into the four high-level deployment
 *  buckets the page uses elsewhere. Mirrors the logic in
 *  `_view-model.ts#exampleScore` so the chips on the expanded sub-rows
 *  and the Deployed-first sort agree on what counts as Deployed/Pilot. */
function stageBucket(devStage: string | null | undefined):
  | "Deployed"
  | "Pilot"
  | "Pre-deployment"
  | "Retired" {
  const s = (devStage ?? "").toLowerCase();
  if (s.includes("retired")) return "Retired";
  if (
    s.includes("operation") ||
    s.includes("production") ||
    s.includes("mission")
  ) {
    return "Deployed";
  }
  if (s.includes("implementation") || s.includes("assessment")) {
    return "Pilot";
  }
  return "Pre-deployment";
}

function paragraph(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

export function SilentlyDroppedAgencyTable({
  rows,
}: {
  rows: SilentlyDroppedAgencyRowExpanded[];
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "dropped", desc: true },
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "expander",
        header: () => null,
        cell: ({ row }) => (
          <span
            className="inline-flex size-5 items-center justify-center text-muted-foreground transition-colors group-hover:text-[var(--stamp)]"
            aria-hidden
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </span>
        ),
      }),
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
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const numericCols = new Set(["filed_2024", "dropped", "pct_dropped"]);
  const totalCols = columns.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b-2 border-foreground">
              {hg.headers.map((h) => {
                const isExpander = h.column.id === "expander";
                const isNum = numericCols.has(h.column.id);
                const isSortable = h.column.getCanSort();
                return (
                  <th
                    key={h.id}
                    scope="col"
                    className={`py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground ${
                      isExpander ? "w-7 px-1" : "px-3"
                    } ${isNum ? "text-right" : "text-left"}`}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={`inline-flex items-center gap-1 hover:text-foreground ${
                          isNum ? "ml-auto" : ""
                        }`}
                      >
                        {flexRender(
                          h.column.columnDef.header,
                          h.getContext(),
                        )}
                        <span className="text-[var(--stamp)]">
                          {h.column.getIsSorted() === "asc"
                            ? "↑"
                            : h.column.getIsSorted() === "desc"
                              ? "↓"
                              : ""}
                        </span>
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const isOpen = row.getIsExpanded();
            const subRows = row.original.rows;
            return (
              <Fragment key={row.id}>
                <tr
                  className={`group cursor-pointer border-b border-border transition-colors hover:bg-[var(--highlight)]/20 ${
                    isOpen ? "bg-[var(--highlight)]/15" : ""
                  }`}
                  onClick={() => row.toggleExpanded()}
                  aria-expanded={isOpen}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isExpander = cell.column.id === "expander";
                    const isNum = numericCols.has(cell.column.id);
                    return (
                      <td
                        key={cell.id}
                        className={`py-3 align-middle ${
                          isExpander ? "w-7 px-1" : "px-3"
                        } ${isNum ? "text-right" : ""}`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
                {isOpen ? (
                  <tr className="border-b border-border bg-[var(--paper-warm)]/40">
                    <td colSpan={totalCols} className="px-3 py-5">
                      {subRows.length === 0 ? (
                        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          No use cases recorded.
                        </p>
                      ) : (
                        <ul className="space-y-4 pl-4">
                          {subRows.map((r) => (
                            <ExpandedUseCaseItem
                              key={r.uc_2024_id}
                              row={r}
                            />
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={totalCols}
                className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                No agencies with silently-dropped use cases.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
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
    paragraph(row.purpose_benefits),
    paragraph(row.outputs),
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

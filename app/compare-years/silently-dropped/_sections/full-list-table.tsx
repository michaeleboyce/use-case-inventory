"use client";

/**
 * The full silently-dropped roster for §V — searchable, sortable, and
 * paged client-side. Excludes USAID by default (rendered separately as a
 * dissolution case); pass `includeDissolved` to fold it in.
 *
 * Route-local: consumed only by `../page.tsx`.
 */

import { Fragment, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ExpandedState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MonoChip } from "@/components/editorial";
import { collapseWhitespace } from "@/lib/formatting";
import type { SilentlyDroppedRow } from "@/lib/types";

const columnHelper = createColumnHelper<SilentlyDroppedRow>();

function excerpt(s: string | null | undefined, n = 180): string {
  const t = collapseWhitespace(s);
  if (!t) return "—";
  return t.length <= n ? t : `${t.slice(0, n).trimEnd()}…`;
}

export function SilentlyDroppedFullList({
  rows,
}: {
  rows: SilentlyDroppedRow[];
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "agency_abbreviation", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
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
      columnHelper.accessor("agency_abbreviation", {
        header: "Agency",
        cell: (info) => (
          <MonoChip tone="ink" size="xs">
            {info.getValue() ?? "—"}
          </MonoChip>
        ),
        sortingFn: "alphanumeric",
      }),
      columnHelper.accessor("use_case_name", {
        header: "Use case (2024)",
        cell: (info) => (
          <span className="font-display text-[0.98rem] italic leading-tight text-foreground">
            {info.getValue() ?? "—"}
          </span>
        ),
        sortingFn: "alphanumeric",
      }),
      columnHelper.accessor("dev_stage", {
        header: "2024 stage",
        cell: (info) => (
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {info.getValue() ?? "—"}
          </span>
        ),
        sortingFn: "alphanumeric",
      }),
      columnHelper.accessor("purpose_benefits", {
        header: "Narrative excerpt",
        enableSorting: false,
        cell: (info) => (
          <span className="text-[0.88rem] leading-snug text-foreground/80">
            {excerpt(info.getValue())}
          </span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, expanded },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.trim().toLowerCase();
      if (!q) return true;
      const r = row.original;
      return (
        (r.agency_abbreviation ?? "").toLowerCase().includes(q) ||
        (r.agency_name ?? "").toLowerCase().includes(q) ||
        (r.use_case_name ?? "").toLowerCase().includes(q) ||
        (r.dev_stage ?? "").toLowerCase().includes(q) ||
        (r.purpose_benefits ?? "").toLowerCase().includes(q) ||
        (r.outputs ?? "").toLowerCase().includes(q)
      );
    },
    getRowId: (r) => String(r.uc_2024_id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const totalFiltered = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <input
          type="text"
          placeholder="Filter by agency, name, stage, or text…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full max-w-md border border-border bg-background px-3 py-1.5 font-mono text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--stamp)]"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {totalFiltered} of {rows.length} rows
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b-2 border-foreground">
                {hg.headers.map((h) => {
                  const isSortable = h.column.getCanSort();
                  const isExpander = h.column.id === "expander";
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={`py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground ${
                        isExpander ? "w-7 px-1" : "px-3"
                      }`}
                    >
                      {isSortable ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-foreground"
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
              const r = row.original;
              const narrative = [
                collapseWhitespace(r.purpose_benefits),
                collapseWhitespace(r.outputs),
              ].filter(Boolean);
              return (
                <Fragment key={row.id}>
                  <tr
                    className={`group cursor-pointer border-b border-border align-top transition-colors hover:bg-[var(--highlight)]/20 ${
                      isOpen ? "bg-[var(--highlight)]/15" : ""
                    }`}
                    onClick={() => row.toggleExpanded()}
                    aria-expanded={isOpen}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isExpander = cell.column.id === "expander";
                      return (
                        <td
                          key={cell.id}
                          className={`py-3 align-top ${
                            isExpander ? "w-7 px-1" : "px-3"
                          }`}
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
                      <td colSpan={columns.length} className="px-3 py-4">
                        {narrative.length > 0 ? (
                          <div className="space-y-3 pl-4">
                            {r.purpose_benefits ? (
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                  Purpose &amp; benefits
                                </p>
                                <p className="mt-1 max-w-prose text-[0.9rem] leading-[1.55] text-foreground/85">
                                  {collapseWhitespace(r.purpose_benefits)}
                                </p>
                              </div>
                            ) : null}
                            {r.outputs ? (
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                  System outputs
                                </p>
                                <p className="mt-1 max-w-prose text-[0.9rem] leading-[1.55] text-foreground/85">
                                  {collapseWhitespace(r.outputs)}
                                </p>
                              </div>
                            ) : null}
                            {r.bureau ? (
                              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                                {r.bureau}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="pl-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            No narrative recorded.
                          </p>
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
                  colSpan={columns.length}
                  className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  No rows match the current filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalFiltered > pageSize ? (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>
            Page {pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="border border-border px-2 py-1 text-foreground transition-colors hover:border-[var(--stamp)] hover:text-[var(--stamp)] disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="border border-border px-2 py-1 text-foreground transition-colors hover:border-[var(--stamp)] hover:text-[var(--stamp)] disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

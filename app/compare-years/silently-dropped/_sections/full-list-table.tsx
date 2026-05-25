"use client";

/**
 * The full silently-dropped roster for §V — searchable, sortable, and
 * paged client-side. Excludes USAID by default (rendered separately as a
 * dissolution case); pass `includeDissolved` to fold it in.
 *
 * Route-local: consumed only by `../page.tsx`.
 */

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import type { SilentlyDroppedRow } from "@/lib/types";

const columnHelper = createColumnHelper<SilentlyDroppedRow>();

function excerpt(s: string | null | undefined, n = 180): string {
  if (!s) return "—";
  const t = s.replace(/\s+/g, " ").trim();
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

  const columns = useMemo(
    () => [
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
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
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
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border align-top">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
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

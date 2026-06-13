"use client";

/**
 * Generic click-to-expand table — the single TanStack scaffolding shared by
 * the /fedramp/coverage/* tables and the compare-years/silently-dropped
 * tables. One row per "thing", expanded payload rendered via a
 * ReactNode-returning callback.
 *
 * SITE-WIDE ROW-AFFORDANCE CONVENTION (this file is the pattern home):
 *   - chevron column (right→down) = the row EXPANDS in place;
 *   - a name-cell <Link> = NAVIGATES (use stopPropagation inside
 *     expanding rows);
 *   - whole-row navigation (no expansion) shows a hover-visible ↗
 *     (ArrowUpRight) at the row end — see components/agencies-table.tsx.
 * New tables should pick exactly one row-click behavior and signal it
 * with the matching affordance.
 *
 * Consumers build their own ColumnDef<TRow>[] (full TanStack power: sort,
 * formatting, links with stopPropagation) and supply `renderExpanded(row)`.
 * The expander chevron column is auto-prepended. Optional extras, all off
 * by default so the minimal coverage-style tables stay unchanged:
 *
 *   - `searchable` — client-side global filter with input + "X of Y" count;
 *   - `pageSize`   — client-side pagination with Prev/Next controls;
 *   - `align`      — "middle" (default) or "top" cell alignment;
 *   - `tableClassName` — extra classes on the <table> (e.g. min-widths).
 */

import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type SortingState,
  type TableOptions,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface ExpandableTableProps<TRow> {
  rows: TRow[];
  columns: ColumnDef<TRow, unknown>[];
  /** Stable unique key for each row (e.g. row.product_id, row.fedramp_id). */
  getRowKey: (row: TRow) => string;
  /** Server-rendered expanded body for a row. Called once per row. */
  renderExpanded: (row: TRow) => ReactNode;
  /** Column ids whose cells right-align (counts, percents). Expander
   *  column is auto-prepended and never right-aligns. */
  numericColumnIds?: string[];
  initialSorting?: SortingState;
  emptyMessage?: string;
  /** Enable a client-side global text filter with an input above the table. */
  searchable?: {
    placeholder?: string;
    /** Return true when the row matches the (already-lowercased, trimmed)
     *  query. */
    matches: (row: TRow, query: string) => boolean;
  };
  /** Enable client-side pagination at this page size. */
  pageSize?: number;
  /** Cell vertical alignment. Defaults to "middle". */
  align?: "top" | "middle";
  /** Extra classes for the <table> element (e.g. "min-w-[920px]"). */
  tableClassName?: string;
}

export function ExpandableTable<TRow>({
  rows,
  columns,
  getRowKey,
  renderExpanded,
  numericColumnIds,
  initialSorting,
  emptyMessage = "No rows.",
  searchable,
  pageSize,
  align = "middle",
  tableClassName = "",
}: ExpandableTableProps<TRow>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const numericCols = useMemo(
    () => new Set(numericColumnIds ?? []),
    [numericColumnIds],
  );
  const alignClass = align === "top" ? "align-top" : "align-middle";

  // Prepend a chevron-only expander column.
  const tableColumns = useMemo<ColumnDef<TRow, unknown>[]>(() => {
    const expander: ColumnDef<TRow, unknown> = {
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
    };
    return [expander, ...columns];
  }, [columns]);

  const options: TableOptions<TRow> = {
    data: rows,
    columns: tableColumns,
    state: {
      sorting,
      expanded,
      ...(searchable ? { globalFilter } : {}),
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowCanExpand: () => true,
    getRowId: getRowKey,
  };
  if (searchable) {
    options.onGlobalFilterChange = setGlobalFilter;
    options.globalFilterFn = (row, _columnId, filterValue) => {
      const q = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      if (!q) return true;
      return searchable.matches(row.original, q);
    };
    options.getFilteredRowModel = getFilteredRowModel();
  }
  if (pageSize) {
    options.getPaginationRowModel = getPaginationRowModel();
    options.initialState = { pagination: { pageSize } };
  }
  const table = useReactTable(options);

  const totalCols = tableColumns.length;
  const totalFiltered = searchable
    ? table.getFilteredRowModel().rows.length
    : rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const effectivePageSize = table.getState().pagination.pageSize;

  return (
    <div className={searchable || pageSize ? "space-y-3" : undefined}>
      {searchable ? (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <input
            type="text"
            placeholder={searchable.placeholder ?? "Filter rows…"}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full max-w-md border border-border bg-background px-3 py-1.5 font-mono text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--stamp)]"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {totalFiltered} of {rows.length} rows
          </span>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table
          className={`w-full border-collapse text-[13px] ${tableClassName}`}
        >
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b-2 border-foreground">
                {hg.headers.map((h) => {
                  const isExpander = h.column.id === "expander";
                  const isNum = numericCols.has(h.column.id);
                  const canSort = !isExpander && h.column.getCanSort();
                  const sortDir = h.column.getIsSorted();
                  const sortGlyph =
                    sortDir === "asc" ? " ↑" : sortDir === "desc" ? " ↓" : "";
                  return (
                    <th
                      key={h.id}
                      onClick={
                        canSort ? h.column.getToggleSortingHandler() : undefined
                      }
                      className={`py-2 text-left align-bottom font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ${
                        isExpander ? "w-7 px-1" : "px-3"
                      } ${isNum ? "text-right" : ""} ${
                        canSort
                          ? "cursor-pointer select-none hover:text-foreground"
                          : ""
                      }`}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <span aria-hidden className="text-[var(--stamp)]">
                        {sortGlyph}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isOpen = row.getIsExpanded();
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
                      return (
                        <td
                          key={cell.id}
                          className={`py-3 ${
                            isExpander
                              ? "w-7 px-1 align-middle"
                              : `px-3 ${alignClass}`
                          } ${
                            numericCols.has(cell.column.id)
                              ? "text-right tabular-nums"
                              : ""
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
                      <td colSpan={totalCols} className="px-3 py-5">
                        {renderExpanded(row.original)}
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
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pageSize && totalFiltered > effectivePageSize ? (
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

"use client";

/**
 * Generic click-to-expand table for the /fedramp/coverage/* pages. One row
 * per "thing" (product / agency / etc.) with an expanded payload
 * server-rendered and passed as a ReactNode-returning callback.
 *
 * Mirrors the pattern from
 * `app/compare-years/silently-dropped/_sections/agency-table.tsx`:
 * - TanStack Table v8 with `getExpandedRowModel()`
 * - Click anywhere on the row to toggle
 * - Chevron icon flips between right (collapsed) and down (expanded)
 * - Expanded body lives in a second `<tr>` spanning all columns
 *
 * Consumers build their own ColumnDef<TRow>[] (full TanStack power: sort,
 * formatting, links with stopPropagation) and supply
 * `renderExpanded(row)` returning whatever should appear inside the
 * expanded row — typically a `<CoverageUseCaseList>` or
 * `<CoverageAgencyList>` from this directory. The expanded content is
 * server-rendered upstream; this component just toggles visibility.
 */

import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface ExpandableCoverageTableProps<TRow> {
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
}

export function ExpandableCoverageTable<TRow>({
  rows,
  columns,
  getRowKey,
  renderExpanded,
  numericColumnIds,
  initialSorting,
  emptyMessage = "No rows.",
}: ExpandableCoverageTableProps<TRow>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const numericCols = useMemo(
    () => new Set(numericColumnIds ?? []),
    [numericColumnIds],
  );

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

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowCanExpand: () => true,
    getRowId: getRowKey,
  });

  const totalCols = tableColumns.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b-2 border-foreground">
              {hg.headers.map((h) => {
                const isExpander = h.column.id === "expander";
                const isNum = numericCols.has(h.column.id);
                return (
                  <th
                    key={h.id}
                    className={`py-2 text-left align-bottom font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ${
                      isExpander ? "w-7 px-1" : "px-3"
                    } ${isNum ? "text-right" : ""}`}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
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
                    const isNum = numericCols.has(cell.column.id);
                    return (
                      <td
                        key={cell.id}
                        className={`py-3 align-middle ${
                          isExpander ? "w-7 px-1" : "px-3"
                        } ${isNum ? "text-right tabular-nums" : ""}`}
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
  );
}

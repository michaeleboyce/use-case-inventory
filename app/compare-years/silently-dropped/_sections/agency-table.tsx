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
 * Route-local: consumed only by `../page.tsx`.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import { MonoChip } from "@/components/editorial";
import { formatNumber, formatPercent } from "@/lib/formatting";
import type { SilentlyDroppedAgencyRow } from "@/lib/types";

const columnHelper = createColumnHelper<SilentlyDroppedAgencyRow>();

export function SilentlyDroppedAgencyTable({
  rows,
}: {
  rows: SilentlyDroppedAgencyRow[];
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "dropped", desc: true },
  ]);

  const columns = useMemo(
    () => [
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
            <span className="font-display text-[1.02rem] italic leading-tight text-foreground group-hover:underline decoration-[var(--stamp)] underline-offset-[3px]">
              {info.getValue()}
              {r.is_dissolved ? (
                <span
                  className="ml-2 align-middle font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--stamp)]"
                  title="USAID was dismantled in 2025 and filed no 2025 inventory — its disappearance is a different category than the per-use-case compliance gap."
                >
                  dissolved
                </span>
              ) : null}
            </span>
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
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const numericCols = new Set(["filed_2024", "dropped", "pct_dropped"]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b-2 border-foreground">
              {hg.headers.map((h) => {
                const isNum = numericCols.has(h.column.id);
                const isSortable = h.column.getCanSort();
                return (
                  <th
                    key={h.id}
                    scope="col"
                    className={`px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground ${
                      isNum ? "text-right" : "text-left"
                    }`}
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
              <th scope="col" className="w-8" aria-hidden />
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="group cursor-pointer border-b border-border transition-colors hover:bg-[var(--highlight)]/20"
              onClick={() =>
                router.push(`/agencies/${row.original.abbreviation}`)
              }
            >
              {row.getVisibleCells().map((cell) => {
                const isNum = numericCols.has(cell.column.id);
                return (
                  <td
                    key={cell.id}
                    className={`px-3 py-3 align-middle ${
                      isNum ? "text-right" : ""
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
              <td className="pr-2 text-right">
                <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[var(--stamp)]" />
              </td>
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
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

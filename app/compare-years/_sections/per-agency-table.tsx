"use client";

/**
 * Sortable per-agency cycle-comparison ledger for /compare-years.
 *
 * Each row is one agency: aggregate 2024 / 2025 counts and delta (from
 * `year_comparison`), plus the per-use-case lineage split (continued /
 * renamed / retired / new from `use_case_year_links`). Styled as a flat
 * editorial data ledger, mirroring `components/agencies-table.tsx`.
 *
 * Route-local — only consumed by the parent `page.tsx`, so it lives in
 * `_sections/` per the dashboard's colocated-component convention.
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
import { formatNumber, formatYoY } from "@/lib/formatting";
import type { PerAgencyLineageRow } from "@/lib/types";

const columnHelper = createColumnHelper<PerAgencyLineageRow>();

function DeltaCell({ value }: { value: number }) {
  const color =
    value > 0
      ? "text-[var(--verified)]"
      : value < 0
        ? "text-[var(--stamp)]"
        : "text-muted-foreground";
  return (
    <span className={`font-mono text-[12px] font-semibold tabular-nums ${color}`}>
      {value > 0 ? "+" : ""}
      {formatNumber(value)}
    </span>
  );
}

function NumCell({
  value,
  accent,
}: {
  value: number;
  accent?: "stamp" | "verified" | "amber" | "muted";
}) {
  const color =
    value === 0
      ? "text-muted-foreground/50"
      : accent === "stamp"
        ? "text-[var(--stamp)]"
        : accent === "verified"
          ? "text-[var(--verified)]"
          : accent === "amber"
            ? "text-foreground"
            : "text-foreground";
  return (
    <span className={`font-mono text-[12px] tabular-nums ${color}`}>
      {formatNumber(value)}
    </span>
  );
}

export function PerAgencyTable({ rows }: { rows: PerAgencyLineageRow[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "count_2025", desc: true },
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
        cell: (info) => (
          <span className="font-display text-[1.02rem] italic leading-tight text-foreground group-hover:underline decoration-[var(--stamp)] underline-offset-[3px]">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("count_2024", {
        header: "2024",
        cell: (info) => <NumCell value={info.getValue()} accent="muted" />,
        sortingFn: "basic",
      }),
      columnHelper.accessor("count_2025", {
        header: "2025",
        cell: (info) => (
          <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
            {formatNumber(info.getValue())}
          </span>
        ),
        sortingFn: "basic",
      }),
      columnHelper.accessor("delta", {
        header: "Δ",
        cell: (info) => <DeltaCell value={info.getValue()} />,
        sortingFn: "basic",
      }),
      columnHelper.accessor("pct_change", {
        header: "% chg",
        cell: (info) => {
          const v = info.getValue();
          if (v == null)
            return (
              <span className="font-mono text-[11px] text-muted-foreground">
                —
              </span>
            );
          const color =
            v > 0
              ? "text-[var(--verified)]"
              : v < 0
                ? "text-[var(--stamp)]"
                : "text-muted-foreground";
          return (
            <span
              className={`font-mono text-[12px] tabular-nums ${color}`}
            >
              {formatYoY(v)}
            </span>
          );
        },
        sortingFn: "basic",
      }),
      columnHelper.accessor("continued", {
        header: "Continued",
        cell: (info) => <NumCell value={info.getValue()} accent="verified" />,
        sortingFn: "basic",
      }),
      columnHelper.accessor("renamed", {
        header: "Renamed",
        cell: (info) => <NumCell value={info.getValue()} />,
        sortingFn: "basic",
      }),
      columnHelper.accessor("retired_2024", {
        header: "Retired",
        cell: (info) => <NumCell value={info.getValue()} accent="stamp" />,
        sortingFn: "basic",
      }),
      columnHelper.accessor("new_2025", {
        header: "New",
        cell: (info) => <NumCell value={info.getValue()} accent="amber" />,
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

  const numericCols = new Set([
    "count_2024",
    "count_2025",
    "delta",
    "pct_change",
    "continued",
    "renamed",
    "retired_2024",
    "new_2025",
  ]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse">
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
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
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
                No agency comparison data available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

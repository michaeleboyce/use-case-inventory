"use client";

/**
 * Sortable per-agency 2024-vs-2025 IFP-tagged GenAI ledger for /compare-years.
 *
 * Each row is one agency: its IFP-tagged generative-AI use-case count in 2024
 * (from `use_case_tags_2024_canonical`) and 2025 (from `use_case_tags`), plus
 * the net change. Both sides use the same `is_generative_ai` tag, so the delta
 * is like-for-like. Clicking a row opens the agency detail page.
 *
 * Route-local — only consumed by the parent `page.tsx`.
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
import { formatNumber } from "@/lib/formatting";
import type { AgencyYearCompareGenAiRow } from "@/lib/db";

const columnHelper = createColumnHelper<AgencyYearCompareGenAiRow>();

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

export function GenAiByAgencyTable({
  rows,
}: {
  rows: AgencyYearCompareGenAiRow[];
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "genai_2025", desc: true },
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
      columnHelper.accessor("genai_2024", {
        header: "GenAI 2024",
        cell: (info) => (
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {formatNumber(info.getValue())}
          </span>
        ),
        sortingFn: "basic",
      }),
      columnHelper.accessor("genai_2025", {
        header: "GenAI 2025",
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

  const numericCols = new Set(["genai_2024", "genai_2025", "delta"]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
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
                        {flexRender(h.column.columnDef.header, h.getContext())}
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
                No GenAI comparison data available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

"use client";

/**
 * §IIa "Live generative AI that vanished" — the dropped live-GenAI roster,
 * collapsed by (agency, use_case_name) and expandable in place.
 *
 * Each row is one named capability. A `×N` badge marks names an agency filed
 * more than once (Education filed 49 entries under "Generative AI Usage").
 * Click a row to expand it: a single-filing row reveals its 2024 narrative;
 * a cluster reveals every underlying filing, one per bureau/task, Deployed-
 * first. Mirrors the expand pattern in `agency-table.tsx`.
 *
 * Route-local: consumed only by `../page.tsx`.
 */

import { Fragment, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  type ExpandedState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MonoChip } from "@/components/editorial";
import { collapseWhitespace, formatNumber } from "@/lib/formatting";
import { stageBucket } from "@/lib/stage-buckets";
import type { SilentlyDroppedGenAiRow } from "@/lib/types";
import type { SilentlyDroppedGenAiGroup } from "../_view-model";

const columnHelper = createColumnHelper<SilentlyDroppedGenAiGroup>();

export function SilentlyDroppedLiveGenAiTable({
  groups,
}: {
  groups: SilentlyDroppedGenAiGroup[];
}) {
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
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--stamp)]">
            {info.getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.accessor("use_case_name", {
        header: "Use case",
        cell: (info) => {
          const g = info.row.original;
          return (
            <>
              <span className="font-display text-[1rem] italic leading-tight text-foreground">
                {g.use_case_name ?? "Untitled"}
              </span>
              {g.count > 1 ? (
                <span className="ml-2 inline-block rounded-sm bg-[var(--stamp)]/[0.12] px-1.5 py-0.5 align-middle font-mono text-[10px] font-medium not-italic tracking-[0.04em] text-[var(--stamp)]">
                  ×{g.count}
                </span>
              ) : null}
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {g.count > 1
                  ? `${formatNumber(g.bureaus.length)} ${
                      g.bureaus.length === 1 ? "bureau" : "bureaus"
                    }`
                  : (g.bureaus[0] ?? "")}
              </span>
            </>
          );
        },
      }),
      columnHelper.accessor("dev_stage", {
        header: "2024 stage",
        cell: (info) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {info.getValue() ?? (info.row.original.count > 1 ? "various" : "—")}
          </span>
        ),
      }),
      columnHelper.accessor("tool_product_name", {
        header: "Tool",
        cell: (info) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {info.getValue() ??
              (info.row.original.count > 1 ? "various / unnamed" : "—")}
          </span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: groups,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getRowId: (g) => g.key,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const totalCols = columns.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b-2 border-foreground">
              {hg.headers.map((h) => {
                const isExpander = h.column.id === "expander";
                return (
                  <th
                    key={h.id}
                    scope="col"
                    className={`py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground ${
                      isExpander ? "w-7 px-1" : "px-3"
                    }`}
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
            const members = row.original.members;
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
                        className={`py-3 ${isExpander ? "w-7 px-1 align-middle" : "px-3"}`}
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
                      {members.length === 0 ? (
                        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          No filings recorded.
                        </p>
                      ) : (
                        <ul className="space-y-4 pl-4">
                          {members.map((m) => (
                            <ExpandedFilingItem key={m.uc_2024_id} row={m} />
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
                No live GenAI use cases silently dropped.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** One filing inside an expanded group: stage chip + bureau + narrative. */
function ExpandedFilingItem({ row }: { row: SilentlyDroppedGenAiRow }) {
  const bucket = stageBucket(row.dev_stage);
  const tone =
    bucket === "Deployed" ? "stamp" : bucket === "Pilot" ? "ink" : "muted";
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
        {row.bureau ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {row.bureau}
          </span>
        ) : null}
        {row.tool_product_name ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {row.tool_product_name}
          </span>
        ) : null}
      </div>
      {narrative ? (
        <p className="mt-1.5 max-w-prose text-[0.9rem] leading-[1.55] text-foreground/80">
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

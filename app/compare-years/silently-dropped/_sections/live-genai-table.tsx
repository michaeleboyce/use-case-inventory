"use client";

/**
 * §IIa "Live generative AI that vanished" — the dropped live-GenAI roster,
 * collapsed by (agency, use_case_name) and expandable in place.
 *
 * Each row is one named capability. A `×N` badge marks names an agency filed
 * more than once (Education filed 49 entries under "Generative AI Usage").
 * Click a row to expand it: a single-filing row reveals its 2024 narrative;
 * a cluster reveals every underlying filing, one per bureau/task, Deployed-
 * first. Built on the shared `ExpandableTable` scaffolding.
 *
 * Route-local: consumed only by `../page.tsx`.
 */

import { useMemo } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { ExpandableTable } from "@/components/expandable-table";
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
  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("agency_abbreviation", {
          header: "Agency",
          enableSorting: false,
          cell: (info) => (
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--stamp)]">
              {info.getValue() ?? "—"}
            </span>
          ),
        }),
        columnHelper.accessor("use_case_name", {
          header: "Use case",
          enableSorting: false,
          cell: (info) => {
            const g = info.row.original;
            return (
              <>
                <span className="font-display text-[1rem] italic leading-tight text-foreground">
                  {g.use_case_name ?? "Untitled"}
                </span>
                {g.count > 1 ? (
                  <span className="ml-2 inline-block bg-[var(--stamp)]/[0.12] px-1.5 py-0.5 align-middle font-mono text-[10px] font-medium not-italic tracking-[0.04em] text-[var(--stamp)]">
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
          enableSorting: false,
          cell: (info) => (
            <span className="font-mono text-[11px] text-muted-foreground">
              {info.getValue() ??
                (info.row.original.count > 1 ? "various" : "—")}
            </span>
          ),
        }),
        columnHelper.accessor("tool_product_name", {
          header: "Tool",
          enableSorting: false,
          cell: (info) => (
            <span className="font-mono text-[11px] text-muted-foreground">
              {info.getValue() ??
                (info.row.original.count > 1 ? "various / unnamed" : "—")}
            </span>
          ),
        }),
      ] as ColumnDef<SilentlyDroppedGenAiGroup, unknown>[],
    [],
  );

  return (
    <ExpandableTable
      rows={groups}
      columns={columns}
      getRowKey={(g) => g.key}
      align="top"
      tableClassName="min-w-[720px]"
      emptyMessage="No live GenAI use cases silently dropped."
      renderExpanded={(g) =>
        g.members.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            No filings recorded.
          </p>
        ) : (
          <ul className="space-y-4 pl-4">
            {g.members.map((m) => (
              <ExpandedFilingItem key={m.uc_2024_id} row={m} />
            ))}
          </ul>
        )
      }
    />
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

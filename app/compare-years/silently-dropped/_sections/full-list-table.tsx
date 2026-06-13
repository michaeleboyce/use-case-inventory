"use client";

/**
 * The full silently-dropped roster for §V — searchable, sortable, and
 * paged client-side, with each row expanding to its full 2024 narrative.
 * Built on the shared `ExpandableTable` scaffolding (search + pagination
 * props). Excludes USAID by default (rendered separately as a dissolution
 * case).
 *
 * Route-local: consumed only by `../page.tsx`.
 */

import { useMemo } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { ExpandableTable } from "@/components/expandable-table";
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
  const columns = useMemo(
    () =>
      [
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
      ] as ColumnDef<SilentlyDroppedRow, unknown>[],
    [],
  );

  return (
    <ExpandableTable
      rows={rows}
      columns={columns}
      getRowKey={(r) => String(r.uc_2024_id)}
      align="top"
      tableClassName="min-w-[920px]"
      initialSorting={[{ id: "agency_abbreviation", desc: false }]}
      pageSize={25}
      searchable={{
        placeholder: "Filter by agency, name, stage, or text…",
        matches: (r, q) =>
          (r.agency_abbreviation ?? "").toLowerCase().includes(q) ||
          (r.agency_name ?? "").toLowerCase().includes(q) ||
          (r.use_case_name ?? "").toLowerCase().includes(q) ||
          (r.dev_stage ?? "").toLowerCase().includes(q) ||
          (r.purpose_benefits ?? "").toLowerCase().includes(q) ||
          (r.outputs ?? "").toLowerCase().includes(q),
      }}
      emptyMessage="No rows match the current filter."
      renderExpanded={(r) => {
        const purpose = collapseWhitespace(r.purpose_benefits);
        const outputs = collapseWhitespace(r.outputs);
        if (!purpose && !outputs) {
          return (
            <p className="pl-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              No narrative recorded.
            </p>
          );
        }
        return (
          <div className="space-y-3 pl-4">
            {purpose ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Purpose &amp; benefits
                </p>
                <p className="mt-1 max-w-prose text-[0.9rem] leading-[1.55] text-foreground/85">
                  {purpose}
                </p>
              </div>
            ) : null}
            {outputs ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  System outputs
                </p>
                <p className="mt-1 max-w-prose text-[0.9rem] leading-[1.55] text-foreground/85">
                  {outputs}
                </p>
              </div>
            ) : null}
            {r.bureau ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {r.bureau}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}

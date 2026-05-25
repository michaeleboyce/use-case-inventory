"use client";

/**
 * "Mentioned without an ATO" expandable table on
 * /fedramp/coverage/agencies/[abbr]. Each row is a product this agency
 * uses but has no FedRAMP authorization on file for; expand to see the
 * top-10 actual use cases at this agency that name the product.
 */

import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";
import { buildUseCasesUrl } from "@/lib/urls";
import { ExpandableCoverageTable } from "@/components/coverage/expandable-coverage-table";
import { CoverageUseCaseList } from "@/components/coverage/coverage-use-case-list";
import type { CoverageUseCaseRow } from "@/lib/types";

export interface MentionedWithoutAtoRow {
  inventory_product_id: number;
  canonical_name: string;
  use_case_count: number;
  fedramp_id: string | null;
  csp: string | null;
  cso: string | null;
  _detail: CoverageUseCaseRow[];
  _totalUseCases: number;
}

const columnHelper = createColumnHelper<MentionedWithoutAtoRow>();

export function MentionedWithoutAtoTable({
  rows,
  agencyId,
  agencyAbbr,
}: {
  rows: MentionedWithoutAtoRow[];
  agencyId: number;
  agencyAbbr: string;
}) {
  const columns = [
    columnHelper.accessor("canonical_name", {
      id: "product",
      header: "Product",
      cell: (info) => (
        <Link
          href={`/products/${info.row.original.inventory_product_id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-display text-[1rem] italic text-foreground hover:underline decoration-[var(--stamp)] underline-offset-[3px]"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.display({
      id: "csp",
      header: "CSP / offering",
      cell: ({ row }) => {
        const r = row.original;
        const text = [r.csp, r.cso].filter(Boolean).join(" · ");
        return (
          <span className="text-muted-foreground">{text || "—"}</span>
        );
      },
    }),
    columnHelper.display({
      id: "fedramp",
      header: "FedRAMP",
      cell: ({ row }) => {
        const r = row.original;
        if (!r.fedramp_id) {
          return (
            <span className="font-mono text-[10.5px] text-muted-foreground">
              —
            </span>
          );
        }
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <MonoChip
              href={`/fedramp/marketplace/products/${r.fedramp_id}`}
              tone="stamp"
              size="xs"
            >
              {r.fedramp_id}
            </MonoChip>
          </span>
        );
      },
    }),
    columnHelper.accessor("use_case_count", {
      id: "use_cases",
      header: "Use cases",
      cell: (info) => formatNumber(info.getValue()),
    }),
  ] as Parameters<typeof ExpandableCoverageTable<MentionedWithoutAtoRow>>[0]["columns"];

  return (
    <ExpandableCoverageTable<MentionedWithoutAtoRow>
      rows={rows}
      columns={columns}
      getRowKey={(r) => String(r.inventory_product_id)}
      numericColumnIds={["use_cases"]}
      initialSorting={[{ id: "use_cases", desc: true }]}
      emptyMessage="Nothing flagged for this agency."
      renderExpanded={(r) => {
        const seeAllHref = buildUseCasesUrl({
          productIds: [r.inventory_product_id],
          agencyIds: [agencyId],
          entryKind: "all",
        });
        return (
          <CoverageUseCaseList
            rows={r._detail}
            totalCount={r._totalUseCases}
            seeAllHref={seeAllHref}
            heading={`${agencyAbbr} use cases that reference ${r.canonical_name} (no agency ATO on file).`}
          />
        );
      }}
    />
  );
}

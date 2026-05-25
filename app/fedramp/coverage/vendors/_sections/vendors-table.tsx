"use client";

/**
 * Vendor coverage table for /fedramp/coverage/vendors. Click any row to
 * expand into the top-10 use cases that mention the product (server-
 * rendered inline; no client fetch).
 */

import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";
import { buildUseCasesUrl } from "@/lib/urls";
import { ExpandableCoverageTable } from "@/components/coverage/expandable-coverage-table";
import { CoverageUseCaseList } from "@/components/coverage/coverage-use-case-list";
import type { CoverageUseCaseRow, CoverageVendorRow } from "@/lib/types";

export type VendorsTableRow = CoverageVendorRow & {
  _detail: CoverageUseCaseRow[];
  _totalUseCases: number;
};

function impactTone(level: string | null): "stamp" | "verified" | "ink" | "muted" {
  const v = (level ?? "").toLowerCase();
  if (v === "high") return "verified";
  if (v === "moderate") return "stamp";
  if (v === "low" || v === "li-saas") return "muted";
  return "ink";
}

const columnHelper = createColumnHelper<VendorsTableRow>();

export function VendorsTable({
  rows,
  agencyAbbr,
  agencyId,
}: {
  rows: VendorsTableRow[];
  agencyAbbr: string | null;
  agencyId: number | null;
}) {
  const columns = [
    columnHelper.accessor("canonical_name", {
      id: "name",
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
    columnHelper.accessor("vendor", {
      id: "vendor",
      header: "Vendor",
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue() ?? "—"}</span>
      ),
    }),
    columnHelper.accessor("use_case_count", {
      id: "use_cases",
      header: "Use cases",
      cell: (info) => formatNumber(info.getValue()),
    }),
    columnHelper.accessor("agency_count", {
      id: "agencies",
      header: "Agencies",
      cell: (info) => (
        <span className="text-muted-foreground">{formatNumber(info.getValue())}</span>
      ),
    }),
    columnHelper.display({
      id: "fedramp",
      header: "FedRAMP",
      cell: ({ row }) => {
        const r = row.original;
        if (r.has_fedramp_link === 1 && r.fedramp_id) {
          return (
            <span onClick={(e) => e.stopPropagation()}>
              <MonoChip
                href={`/fedramp/marketplace/products/${r.fedramp_id}`}
                tone="verified"
                size="xs"
                title={`${r.fedramp_csp ?? ""} ${r.fedramp_cso ?? ""}`.trim()}
              >
                {r.fedramp_id}
              </MonoChip>
            </span>
          );
        }
        return (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--stamp)]">
            not on FedRAMP
          </span>
        );
      },
    }),
    columnHelper.accessor("fedramp_impact_level", {
      id: "impact",
      header: "Impact",
      cell: (info) => {
        const v = info.getValue();
        if (!v) {
          return (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              —
            </span>
          );
        }
        return (
          <MonoChip tone={impactTone(v)} size="xs">
            {v}
          </MonoChip>
        );
      },
    }),
    columnHelper.accessor("fedramp_ato_count", {
      id: "atos",
      header: "ATOs",
      cell: (info) => {
        const v = info.getValue();
        return v > 0 ? (
          <span className="text-muted-foreground">{formatNumber(v)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    }),
  ] as Parameters<typeof ExpandableCoverageTable<VendorsTableRow>>[0]["columns"];

  return (
    <ExpandableCoverageTable<VendorsTableRow>
      rows={rows}
      columns={columns}
      getRowKey={(r) => String(r.inventory_product_id)}
      numericColumnIds={["use_cases", "agencies", "atos"]}
      emptyMessage="No products to rank."
      renderExpanded={(r) => {
        const isUnmatched = r.has_fedramp_link !== 1;
        const heading = isUnmatched
          ? agencyAbbr
            ? `${agencyAbbr} reports ${formatNumber(r.use_case_count)} use cases for ${r.canonical_name}, no FedRAMP authorization.`
            : `Reported in ${formatNumber(r.agency_count)} ${r.agency_count === 1 ? "agency" : "agencies"} without a FedRAMP authorization.`
          : agencyAbbr
            ? `${agencyAbbr} use cases for ${r.canonical_name}.`
            : `Top use cases referencing ${r.canonical_name}.`;
        const seeAllHref = buildUseCasesUrl({
          productIds: [r.inventory_product_id],
          ...(agencyId != null ? { agencyIds: [agencyId] } : {}),
          entryKind: "all",
        });
        return (
          <CoverageUseCaseList
            rows={r._detail}
            totalCount={r._totalUseCases}
            seeAllHref={seeAllHref}
            heading={heading}
          />
        );
      }}
    />
  );
}

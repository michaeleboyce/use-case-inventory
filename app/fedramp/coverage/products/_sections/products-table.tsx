"use client";

/**
 * Unused-products table for /fedramp/coverage/products. Each row is a
 * FedRAMP-authorized inventory product with zero use cases; expand to see
 * the agencies that hold the authorization (the "FedRAMP → AI" inverse
 * drill).
 */

import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";
import { ExpandableCoverageTable } from "@/components/coverage/expandable-coverage-table";
import { CoverageAgencyList } from "@/components/coverage/coverage-agency-list";
import type { AgencyAtoRow } from "@/lib/types";

export interface ProductsTableRow {
  inventory_product_id: number;
  canonical_name: string;
  vendor: string | null;
  fedramp_id: string;
  fedramp_csp: string;
  fedramp_cso: string;
  fedramp_impact_level: string | null;
  fedramp_ato_count: number;
  _agencies: AgencyAtoRow[];
}

function impactTone(level: string | null): "stamp" | "verified" | "ink" | "muted" {
  const v = (level ?? "").toLowerCase();
  if (v === "high") return "verified";
  if (v === "moderate") return "stamp";
  if (v === "low" || v === "li-saas") return "muted";
  return "ink";
}

const columnHelper = createColumnHelper<ProductsTableRow>();

export function ProductsTable({ rows }: { rows: ProductsTableRow[] }) {
  const columns = [
    columnHelper.accessor("vendor", {
      id: "vendor",
      header: "Vendor",
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue() ?? "—"}</span>
      ),
    }),
    columnHelper.accessor("canonical_name", {
      id: "product",
      header: "Product (inventory)",
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
      id: "fedramp",
      header: "FedRAMP offering",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <MonoChip
              href={`/fedramp/marketplace/products/${r.fedramp_id}`}
              tone="stamp"
              size="xs"
              title={`${r.fedramp_csp} · ${r.fedramp_cso}`}
            >
              {r.fedramp_id}
            </MonoChip>
            <span className="ml-2 text-[0.85rem] text-muted-foreground">
              {r.fedramp_csp} · {r.fedramp_cso}
            </span>
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
            <span className="font-mono text-[10.5px] text-muted-foreground">
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
      header: "Authorizing agencies",
      cell: (info) =>
        info.getValue() > 0 ? formatNumber(info.getValue()) : "—",
    }),
  ] as Parameters<typeof ExpandableCoverageTable<ProductsTableRow>>[0]["columns"];

  return (
    <ExpandableCoverageTable<ProductsTableRow>
      rows={rows}
      columns={columns}
      getRowKey={(r) => String(r.inventory_product_id)}
      numericColumnIds={["atos"]}
      emptyMessage="No products match the current filter."
      renderExpanded={(r) => (
        <CoverageAgencyList
          rows={r._agencies}
          heading={
            r._agencies.length === 0
              ? undefined
              : `Agencies holding a FedRAMP authorization for ${r.canonical_name} but reporting zero AI use cases.`
          }
          emptyMessage="No agencies in our scope hold this authorization yet."
        />
      )}
    />
  );
}

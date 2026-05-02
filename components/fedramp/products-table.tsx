/**
 * Sortable directory table for FedRAMP products. Server Component-friendly:
 * accepts a fully-sorted row list and renders an editorial table with
 * MonoChip provider chips, ImpactBadge cells, and click-through CSO names.
 *
 * Sort is URL-driven by callers (e.g. `?sort=cso:desc`); this component
 * re-emits sort headers as plain `<a href>` links so the page stays a
 * Server Component.
 */

import Link from "next/link";
import { MonoChip } from "@/components/editorial";
import { ImpactBadge } from "@/components/fedramp/impact-badge";
import { StatusStamp } from "@/components/fedramp/status-stamp";
import { formatDate, formatNumber } from "@/lib/formatting";
import type { FedrampProduct } from "@/lib/types";

export type ProductSortKey =
  | "cso"
  | "csp"
  | "status"
  | "impact"
  | "auth_date";
export type SortDir = "asc" | "desc";

const COLUMN_LABELS: Record<ProductSortKey, string> = {
  cso: "Cloud Service Offering",
  csp: "Provider",
  status: "Status",
  impact: "Impact",
  auth_date: "Auth date",
};

export function ProductsTable({
  rows,
  sortKey,
  sortDir,
  buildSortHref,
}: {
  rows: FedrampProduct[];
  sortKey: ProductSortKey;
  sortDir: SortDir;
  buildSortHref: (key: ProductSortKey, dir: SortDir) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        No products match the current filter.
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <SortHeader
              column="cso"
              activeSort={sortKey}
              activeDir={sortDir}
              buildSortHref={buildSortHref}
            />
            <SortHeader
              column="csp"
              activeSort={sortKey}
              activeDir={sortDir}
              buildSortHref={buildSortHref}
            />
            <SortHeader
              column="status"
              activeSort={sortKey}
              activeDir={sortDir}
              buildSortHref={buildSortHref}
            />
            <SortHeader
              column="impact"
              activeSort={sortKey}
              activeDir={sortDir}
              buildSortHref={buildSortHref}
            />
            <SortHeader
              column="auth_date"
              activeSort={sortKey}
              activeDir={sortDir}
              buildSortHref={buildSortHref}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.fedramp_id}
              className="border-b border-dotted border-border align-baseline hover:bg-foreground/[0.025]"
            >
              <td className="px-2 py-2.5">
                <Link
                  href={`/fedramp/marketplace/products/${p.fedramp_id}`}
                  className="font-display italic text-[1.05rem] leading-tight text-foreground hover:text-[var(--stamp)]"
                >
                  {p.cso}
                </Link>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {p.fedramp_id}
                </div>
              </td>
              <td className="px-2 py-2.5">
                <MonoChip
                  href={`/fedramp/marketplace/csps/${p.csp_slug}`}
                  tone="ink"
                  size="xs"
                  title={p.csp}
                >
                  {p.csp}
                </MonoChip>
              </td>
              <td className="px-2 py-2.5">
                <StatusStamp status={p.status} size="xs" />
              </td>
              <td className="px-2 py-2.5">
                <ImpactBadge impact={p.impact_level} />
              </td>
              <td className="px-2 py-2.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatDate(p.auth_date)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground">
            <td
              colSpan={5}
              className="px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {formatNumber(rows.length)} {rows.length === 1 ? "row" : "rows"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SortHeader({
  column,
  activeSort,
  activeDir,
  buildSortHref,
  align = "left",
}: {
  column: ProductSortKey;
  activeSort: ProductSortKey;
  activeDir: SortDir;
  buildSortHref: (key: ProductSortKey, dir: SortDir) => string;
  align?: "left" | "right";
}) {
  const isActive = activeSort === column;
  const nextDir: SortDir = isActive
    ? activeDir === "asc"
      ? "desc"
      : "asc"
    : column === "cso" || column === "csp"
      ? "asc"
      : "desc";
  const arrow = isActive ? (activeDir === "asc" ? "▲" : "▼") : "·";
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <th
      scope="col"
      aria-sort={
        isActive
          ? activeDir === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={`px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${alignClass}`}
    >
      <a
        href={buildSortHref(column, nextDir)}
        className={`inline-flex items-baseline gap-1.5 ${
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span>{COLUMN_LABELS[column]}</span>
        <span aria-hidden className="text-[8px]">
          {arrow}
        </span>
      </a>
    </th>
  );
}

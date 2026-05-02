/**
 * /fedramp/marketplace/assessors — directory of every FedRAMP-recognized
 * 3PAO. Counts (products covered, authorized, high-impact) are computed
 * locally per assessor from `getFedrampProductsByAssessor` so the page
 * doesn't need a dedicated db.ts helper.
 */

import { Suspense } from "react";
import Link from "next/link";

import {
  getFedrampAssessors,
  getFedrampProductsByAssessor,
} from "@/lib/db";
import { Section, Eyebrow, MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";

export const metadata = {
  title: "3PAOs · FedRAMP Marketplace · Federal AI Inventory",
  description:
    "Directory of FedRAMP-recognized third-party assessment organizations and the cloud-service offerings each has signed.",
};

type SortKey = "name" | "products" | "authorized" | "high";
const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  products: "# products covered",
  authorized: "# authorized",
  high: "# high-impact",
};
function isSortKey(s: string | undefined): s is SortKey {
  return s === "name" || s === "products" || s === "authorized" || s === "high";
}

export default async function MarketplaceAssessorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qRaw = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const sortRaw = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sortKey: SortKey = isSortKey(sortRaw) ? sortRaw : "products";
  const dirRaw = Array.isArray(sp.dir) ? sp.dir[0] : sp.dir;
  const defaultDir: "asc" | "desc" = sortKey === "name" ? "asc" : "desc";
  const dir: "asc" | "desc" =
    dirRaw === "asc" || dirRaw === "desc" ? dirRaw : defaultDir;

  const assessors = getFedrampAssessors();
  const rows = assessors.map((a) => {
    const products = getFedrampProductsByAssessor(a.id);
    const authorized = products.filter(
      (p) => p.status === "FedRAMP Authorized",
    ).length;
    const high = products.filter((p) => p.impact_level === "High").length;
    return {
      id: a.id,
      name: a.name,
      slug: a.slug,
      product_count: products.length,
      authorized_count: authorized,
      high_impact_count: high,
    };
  });

  const q = qRaw.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.slug.includes(q),
      )
    : rows;

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "products":
        cmp = a.product_count - b.product_count;
        break;
      case "authorized":
        cmp = a.authorized_count - b.authorized_count;
        break;
      case "high":
        cmp = a.high_impact_count - b.high_impact_count;
        break;
    }
    if (cmp === 0) cmp = a.name.localeCompare(b.name);
    return dir === "asc" ? cmp : -cmp;
  });

  const totalProducts = rows.reduce((s, r) => s + r.product_count, 0);
  const totalAuthorized = rows.reduce((s, r) => s + r.authorized_count, 0);
  const totalHigh = rows.reduce((s, r) => s + r.high_impact_count, 0);

  return (
    <div>
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <Eyebrow color="stamp">§ IV · 3PAOs</Eyebrow>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {formatNumber(rows.length)} third-party assessors
            </div>
            <div className="font-mono text-[10.5px] tracking-[0.1em] text-muted-foreground">
              {formatNumber(totalProducts)} offerings ·{" "}
              {formatNumber(totalAuthorized)} authorized ·{" "}
              {formatNumber(totalHigh)} high-impact
            </div>
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.4rem] leading-[1] tracking-[-0.02em] text-foreground md:text-[3.4rem]">
            Third-Party Assessment Organizations
          </h1>
          <p className="mt-6 max-w-[62ch] text-base leading-relaxed text-foreground/85 md:text-[1.05rem]">
            Every cloud-service offering on the FedRAMP marketplace is
            independently audited by an accredited 3PAO before its security
            package reaches the PMO. Below: each accredited assessor, the
            offerings they have signed, and the slice of those that reached
            authorization or High impact.
          </p>

          <Suspense fallback={null}>
            <form
              action="/fedramp/marketplace/assessors"
              method="get"
              className="mt-8 flex items-end gap-3 border-t border-border pt-4"
            >
              <div className="flex-1">
                <label
                  htmlFor="q"
                  className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Filter
                </label>
                <input
                  id="q"
                  type="search"
                  name="q"
                  defaultValue={qRaw}
                  placeholder="Search assessors…"
                  className="mt-1 w-full border-b border-border bg-transparent px-1 py-1.5 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
                />
              </div>
              <input type="hidden" name="sort" value={sortKey} />
              <input type="hidden" name="dir" value={dir} />
              <button
                type="submit"
                className="border border-foreground bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background"
              >
                Apply
              </button>
            </form>
          </Suspense>
        </div>
      </header>

      <Section
        number="I"
        title="Directory"
        lede="Sorted by offerings covered. Click a column to re-sort."
      >
        {sorted.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            No assessors match {`"${qRaw}"`}.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-foreground text-left">
                  <SortHeader
                    label={SORT_LABELS.name}
                    column="name"
                    activeSort={sortKey}
                    activeDir={dir}
                    q={qRaw}
                    align="left"
                  />
                  <Th>Slug</Th>
                  <SortHeader
                    label={SORT_LABELS.products}
                    column="products"
                    activeSort={sortKey}
                    activeDir={dir}
                    q={qRaw}
                    align="right"
                  />
                  <SortHeader
                    label={SORT_LABELS.authorized}
                    column="authorized"
                    activeSort={sortKey}
                    activeDir={dir}
                    q={qRaw}
                    align="right"
                  />
                  <SortHeader
                    label={SORT_LABELS.high}
                    column="high"
                    activeSort={sortKey}
                    activeDir={dir}
                    q={qRaw}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-dotted border-border align-baseline hover:bg-foreground/[0.025]"
                  >
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/fedramp/marketplace/assessors/${row.slug}`}
                        className="font-display italic text-[1.05rem] leading-tight text-foreground hover:text-[var(--stamp)]"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <MonoChip
                        href={`/fedramp/marketplace/assessors/${row.slug}`}
                        tone="muted"
                        size="xs"
                      >
                        {row.slug}
                      </MonoChip>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums">
                      {formatNumber(row.product_count)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-foreground">
                      {formatNumber(row.authorized_count)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums">
                      {row.high_impact_count > 0 ? (
                        <span className="text-[var(--stamp)]">
                          {formatNumber(row.high_impact_count)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground">
                  <td
                    className="px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"
                    colSpan={2}
                  >
                    Totals
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[12px] tabular-nums text-foreground">
                    {formatNumber(totalProducts)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[12px] tabular-nums text-foreground">
                    {formatNumber(totalAuthorized)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[12px] tabular-nums text-foreground">
                    {formatNumber(totalHigh)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-2 pb-1.5 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
    >
      {children}
    </th>
  );
}

function SortHeader({
  label,
  column,
  activeSort,
  activeDir,
  q,
  align,
}: {
  label: string;
  column: SortKey;
  activeSort: SortKey;
  activeDir: "asc" | "desc";
  q: string;
  align: "left" | "right";
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  const isActive = activeSort === column;
  const nextDir: "asc" | "desc" = isActive
    ? activeDir === "asc"
      ? "desc"
      : "asc"
    : column === "name"
      ? "asc"
      : "desc";

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("sort", column);
  params.set("dir", nextDir);

  const arrow = isActive ? (activeDir === "asc" ? "▲" : "▼") : "·";

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
      <Link
        href={`/fedramp/marketplace/assessors?${params.toString()}`}
        className={`inline-flex items-baseline gap-1.5 ${
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span>{label}</span>
        <span aria-hidden className="text-[8px]">
          {arrow}
        </span>
      </Link>
    </th>
  );
}

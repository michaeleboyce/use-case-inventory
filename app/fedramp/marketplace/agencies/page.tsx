/**
 * /fedramp/marketplace/agencies — directory of every parent federal agency
 * that holds at least one FedRAMP authorization. Server Component.
 *
 * Counts (initial / reuse / distinct products) are computed locally from
 * `getFedrampAuthorizationsForAgency` per row to avoid touching db.ts;
 * the FedRAMP agency table itself is small (~91 rows) so the cost is
 * negligible.
 */

import { Suspense } from "react";
import {
  getFedrampAgencies,
  getFedrampAuthorizationsForAgency,
} from "@/lib/db";
import { Section, Eyebrow, MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";

export const metadata = {
  title: "Agencies · FedRAMP Marketplace · Federal AI Inventory",
  description:
    "Every parent federal agency that holds at least one FedRAMP authorization, with initial / reuse / distinct-product counts.",
};

type Sort = "total" | "alpha" | "initial" | "reuse" | "products";
const SORT_OPTIONS: Array<{ key: Sort; label: string }> = [
  { key: "total", label: "Total ATOs" },
  { key: "alpha", label: "A → Z" },
  { key: "initial", label: "Initial" },
  { key: "reuse", label: "Reuse" },
  { key: "products", label: "Products" },
];
function isSort(s: string | null | undefined): s is Sort {
  return (
    s === "total" ||
    s === "alpha" ||
    s === "initial" ||
    s === "reuse" ||
    s === "products"
  );
}

interface Row {
  id: number;
  parent_agency: string;
  parent_slug: string;
  initial_count: number;
  reuse_count: number;
  distinct_product_count: number;
}

export default async function MarketplaceAgenciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const sortParam = typeof sp.sort === "string" ? sp.sort : undefined;
  const sort: Sort = isSort(sortParam) ? sortParam : "total";

  const agencies = getFedrampAgencies();
  // Roll up authorizations per agency. The FedRAMP table has ~91 agencies,
  // so this is cheap.
  const rows: Row[] = agencies.map((a) => {
    const auths = getFedrampAuthorizationsForAgency(a.id);
    let initial = 0;
    let reuse = 0;
    const distinct = new Set<string>();
    for (const auth of auths) {
      if (auth.ato_type === "Initial") initial++;
      else if (auth.ato_type === "Reuse") reuse++;
      distinct.add(auth.fedramp_id);
    }
    return {
      id: a.id,
      parent_agency: a.parent_agency,
      parent_slug: a.parent_slug,
      initial_count: initial,
      reuse_count: reuse,
      distinct_product_count: distinct.size,
    };
  });

  let filtered = rows;
  if (q.length > 0) {
    filtered = filtered.filter(
      (r) =>
        r.parent_agency.toLowerCase().includes(q) ||
        r.parent_slug.toLowerCase().includes(q),
    );
  }

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "alpha":
        return a.parent_agency.localeCompare(b.parent_agency);
      case "initial":
        return b.initial_count - a.initial_count;
      case "reuse":
        return b.reuse_count - a.reuse_count;
      case "products":
        return b.distinct_product_count - a.distinct_product_count;
      case "total":
      default:
        return (
          b.initial_count +
          b.reuse_count -
          (a.initial_count + a.reuse_count)
        );
    }
  });

  return (
    <div>
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <Eyebrow color="stamp">§ III · Agencies</Eyebrow>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="tabular-nums text-foreground">
                {formatNumber(agencies.length)}
              </span>{" "}
              parent agencies
            </div>
            {q.length > 0 ? (
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Showing{" "}
                <span className="tabular-nums text-foreground">
                  {formatNumber(sorted.length)}
                </span>{" "}
                matches
              </div>
            ) : null}
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.4rem] leading-[1] tracking-[-0.02em] text-foreground md:text-[3.6rem]">
            Federal Agency Customers
          </h1>
          <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-foreground/85 md:text-[1.05rem]">
            Every parent federal agency that holds — or has held — at least
            one FedRAMP authorization. The ledger separates the agency that
            sponsored the initial authorization (Initial) from agencies that
            adopted an existing package (Reuse).
          </p>

          <Suspense fallback={null}>
            <form
              action="/fedramp/marketplace/agencies"
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
                  defaultValue={q}
                  placeholder="Filter by agency name or slug…"
                  className="mt-1 w-full border-b border-border bg-transparent px-1 py-1.5 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
                />
              </div>
              <input type="hidden" name="sort" value={sort} />
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
        lede="Sorted by total ATO events held."
      >
        <div className="space-y-4">
          <SortTabs current={sort} q={q} />

          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr className="border-b-2 border-foreground text-left">
                  <Th className="w-[40%]">Parent agency</Th>
                  <Th className="text-right">Initial</Th>
                  <Th className="text-right">Reuse</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Distinct products</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      No agencies match {q ? `“${q}”` : "the current filter"}.
                    </td>
                  </tr>
                ) : (
                  sorted.map((row) => {
                    const total = row.initial_count + row.reuse_count;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-dotted border-border hover:bg-foreground/[0.025]"
                      >
                        <td className="px-2 py-2 align-top">
                          <MonoChip
                            href={`/fedramp/marketplace/agencies/${row.parent_slug}`}
                            tone="ink"
                            size="sm"
                            title={row.parent_agency}
                          >
                            {row.parent_agency}
                          </MonoChip>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[12px]">
                          {formatNumber(row.initial_count)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[12px] text-[var(--verified)]">
                          {formatNumber(row.reuse_count)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[12px] font-semibold">
                          {formatNumber(total)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[12px] text-foreground/80">
                          {formatNumber(row.distinct_product_count)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function SortTabs({ current, q }: { current: Sort; q: string }) {
  const baseQs = q.length > 0 ? `q=${encodeURIComponent(q)}&` : "";
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Sort
      </span>
      {SORT_OPTIONS.map((opt) => {
        const active = opt.key === current;
        return (
          <a
            key={opt.key}
            href={`?${baseQs}sort=${opt.key}`}
            className={`font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
              active
                ? "text-foreground border-b-2 border-[var(--stamp)] -mb-[3px] pb-1"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </a>
        );
      })}
    </div>
  );
}

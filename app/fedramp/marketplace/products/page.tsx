/**
 * /fedramp/marketplace/products — directory of every FedRAMP cloud service
 * offering. Server Component; sort/search are URL-driven so the page stays
 * pure RSC and is shareable.
 */

import { Suspense } from "react";
import { Section, MonoChip, Eyebrow } from "@/components/editorial";
import { getFedrampProducts, getFedrampSnapshot } from "@/lib/db";
import { formatDate, formatNumber } from "@/lib/formatting";
import {
  ProductsTable,
  type ProductSortKey,
  type SortDir,
} from "@/components/fedramp/products-table";
import type { FedrampProduct } from "@/lib/types";

export const metadata = {
  title: "Products · FedRAMP Marketplace · Federal AI Inventory",
  description:
    "Every FedRAMP cloud-service offering, with status, impact level, provider, and most-recent authorization date.",
};

const SORT_KEYS = new Set<ProductSortKey>([
  "cso",
  "csp",
  "status",
  "impact",
  "auth_date",
]);

function parseSort(raw: string | undefined): {
  key: ProductSortKey;
  dir: SortDir;
} {
  if (!raw) return { key: "cso", dir: "asc" };
  const [keyRaw, dirRaw] = raw.split(":");
  const key = SORT_KEYS.has(keyRaw as ProductSortKey)
    ? (keyRaw as ProductSortKey)
    : "cso";
  const dir: SortDir = dirRaw === "desc" ? "desc" : "asc";
  return { key, dir };
}

function applySort(rows: FedrampProduct[], sort: { key: ProductSortKey; dir: SortDir }): FedrampProduct[] {
  const out = [...rows];
  const dir = sort.dir === "desc" ? -1 : 1;
  const cmpStr = (a: string | null | undefined, b: string | null | undefined) =>
    (a ?? "").localeCompare(b ?? "", "en", { sensitivity: "base" }) * dir;
  const cmpNum = (a: number | null | undefined, b: number | null | undefined) =>
    ((a ?? 0) - (b ?? 0)) * dir;

  switch (sort.key) {
    case "cso":
      out.sort((a, b) => cmpStr(a.cso, b.cso));
      break;
    case "csp":
      out.sort((a, b) => cmpStr(a.csp, b.csp) || cmpStr(a.cso, b.cso));
      break;
    case "status":
      out.sort((a, b) => cmpStr(a.status, b.status) || cmpStr(a.cso, b.cso));
      break;
    case "impact":
      out.sort(
        (a, b) =>
          cmpNum(a.impact_level_number, b.impact_level_number) ||
          cmpStr(a.cso, b.cso),
      );
      break;
    case "auth_date":
      out.sort((a, b) => {
        if (!a.auth_date && !b.auth_date) return 0;
        if (!a.auth_date) return 1;
        if (!b.auth_date) return -1;
        return cmpStr(a.auth_date, b.auth_date);
      });
      break;
  }
  return out;
}

export default async function MarketplaceProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const status = typeof sp.status === "string" ? sp.status : "";
  const impact = typeof sp.impact === "string" ? sp.impact : "";
  const sortRaw = typeof sp.sort === "string" ? sp.sort : undefined;
  const sort = parseSort(sortRaw);

  const all = getFedrampProducts();
  let rows = all;
  if (q) {
    rows = rows.filter(
      (p) =>
        p.cso.toLowerCase().includes(q) ||
        p.csp.toLowerCase().includes(q) ||
        p.fedramp_id.toLowerCase().includes(q),
    );
  }
  if (status) rows = rows.filter((p) => p.status === status);
  if (impact) rows = rows.filter((p) => p.impact_level === impact);
  rows = applySort(rows, sort);

  const snapshot = getFedrampSnapshot();

  const buildSortHref = (key: ProductSortKey, dir: SortDir): string => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (impact) params.set("impact", impact);
    params.set("sort", `${key}:${dir}`);
    return `?${params.toString()}`;
  };

  const activeChips: { label: string; tone: "stamp" | "ink" | "muted" }[] = [];
  if (q) activeChips.push({ label: `“${q}”`, tone: "stamp" });
  if (status) activeChips.push({ label: status, tone: "ink" });
  if (impact) activeChips.push({ label: impact, tone: "ink" });

  return (
    <div>
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-3">
            <Eyebrow color="stamp">§ I · Products</Eyebrow>
            {snapshot ? (
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                Filed {formatDate(snapshot.snapshot_date)}
              </div>
            ) : null}
            <div className="border-t border-border pt-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Showing
              </div>
              <div className="mt-1 font-display text-[2rem] italic leading-[0.95] tracking-[-0.02em] tabular-nums">
                {formatNumber(rows.length)}
                {snapshot ? (
                  <span className="ml-1 text-[1rem] not-italic text-muted-foreground">
                    / {formatNumber(snapshot.product_count)}
                  </span>
                ) : null}
              </div>
            </div>
            {activeChips.length > 0 ? (
              <div className="border-t border-dotted border-border pt-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Filters
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeChips.map((c, i) => (
                    <MonoChip key={`${c.label}-${i}`} tone={c.tone} size="xs">
                      {c.label}
                    </MonoChip>
                  ))}
                </div>
                <a
                  href="/fedramp/marketplace/products"
                  className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
                >
                  Reset filters →
                </a>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.4rem] leading-[1] tracking-[-0.02em] text-foreground md:text-[3.6rem]">
            Authorized Cloud Services
          </h1>
          <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-foreground/85 md:text-[1.05rem]">
            Every cloud-service offering on the FedRAMP marketplace as of{" "}
            {snapshot ? formatDate(snapshot.snapshot_date) : "the latest snapshot"}.
            Authorized, in process, ready, agency-sponsored. Filter by status
            or impact level, then drill through to the product&rsquo;s full
            authorization history.
          </p>

          {/* GET-form filters: status / impact / q */}
          <Suspense fallback={null}>
            <form
              action="/fedramp/marketplace/products"
              method="get"
              className="mt-8 grid grid-cols-1 items-end gap-3 border-t border-border pt-4 md:grid-cols-[1fr_10rem_8rem_auto]"
            >
              <div>
                <label
                  htmlFor="q"
                  className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Search
                </label>
                <input
                  id="q"
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="CSO, CSP, or FedRAMP ID…"
                  className="mt-1 w-full border-b border-border bg-transparent px-1 py-1.5 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="status"
                  className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={status}
                  className="mt-1 w-full border-b border-border bg-transparent px-1 py-1.5 font-mono text-[12px] focus:border-foreground focus:outline-none"
                >
                  <option value="">Any</option>
                  <option value="FedRAMP Authorized">Authorized</option>
                  <option value="FedRAMP In Process">In process</option>
                  <option value="FedRAMP Ready">Ready</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="impact"
                  className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Impact
                </label>
                <select
                  id="impact"
                  name="impact"
                  defaultValue={impact}
                  className="mt-1 w-full border-b border-border bg-transparent px-1 py-1.5 font-mono text-[12px] focus:border-foreground focus:outline-none"
                >
                  <option value="">Any</option>
                  <option value="High">High</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Low">Low</option>
                  <option value="Li-SaaS">Li-SaaS</option>
                </select>
              </div>
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

      <Section number="I" title="Directory" lede="Click any column to re-sort.">
        <ProductsTable
          rows={rows}
          sortKey={sort.key}
          sortDir={sort.dir}
          buildSortHref={buildSortHref}
        />
      </Section>
    </div>
  );
}

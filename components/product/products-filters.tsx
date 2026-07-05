/**
 * Client-side filter bar + grid for the /products page — editorial.
 *
 * A thin ruled row above the grid with monospace labels and native
 * <input>/<select> controls styled as hairline boxes. No shadcn Card,
 * no Select-in-Card; filters feel like the filing strip of a broadsheet.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/product/product-card";
import { FilterSelect } from "@/components/ui/filter-select";
import { EmptyState } from "@/components/empty-state";
import { humanize, formatNumber } from "@/lib/formatting";
import { buildUseCasesUrl } from "@/lib/urls";
import type { ProductWithCounts } from "@/lib/types";

type SortKey = "agency_count" | "use_case_count" | "name";

// Min-entries threshold options. The catalog includes ~10 products with zero
// use-case rows (seeded but never linked) and a long tail with exactly one
// reporting entry — both produce noisy / un-informative cards. The default
// (>= 2 entries) drops both. "All" surfaces the full catalog for audit.
const MIN_ENTRIES_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "All" },
  { value: 1, label: "1+ entry" },
  { value: 2, label: "2+ entries (default)" },
  { value: 5, label: "5+ entries" },
  { value: 10, label: "10+ entries" },
];
const DEFAULT_MIN_ENTRIES = 2;

type Props = {
  products: ProductWithCounts[];
  /** id → canonical_name, used so cards can show "Part of: <parent>". */
  parentNames: Record<number, string>;
};

const ALL = "__all__";
const UNCLASSIFIED = "__unclassified__";
// URL value used for the uncategorized bucket so the param is human-readable
// (?category=uncategorized) without exposing the internal sentinel string.
const URL_UNCATEGORIZED = "uncategorized";

// `products.product_type` is an IFP-curated category (general_llm,
// security_tool, etc.) — NOT the OMB M-25-21 `ai_classification` field, which
// lives on use_cases. Backfill in scripts/cleanup_products_taxonomy.py sets
// missing values to the literal string 'unclassified'; we treat that and
// null/empty identically here so the filter has one "uncategorized" bucket.
const isUncategorized = (t: string | null | undefined): boolean => {
  if (!t) return true;
  const trimmed = t.trim().toLowerCase();
  return trimmed === "" || trimmed === "unclassified";
};

const fieldClass =
  "h-8 min-w-0 border border-border bg-background px-2 font-mono text-[11px] tracking-[0.08em] text-foreground placeholder:uppercase placeholder:text-muted-foreground focus:border-foreground focus:outline-none";

export function ProductsFilters({ products, parentNames }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read ?category=X on first render so a deep link from a product detail
  // page lands on the right filter. We use the URL value as the source of
  // truth on mount but then drive subsequent updates from local state +
  // a one-way write back to the URL via router.replace.
  const initialCategory = (() => {
    const raw = searchParams.get("category");
    if (!raw) return ALL;
    return raw === URL_UNCATEGORIZED ? UNCLASSIFIED : raw;
  })();

  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState<string>(ALL);
  const [productType, setProductType] = useState<string>(initialCategory);
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [genaiOnly, setGenaiOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("agency_count");
  const [minEntries, setMinEntries] = useState<number>(DEFAULT_MIN_ENTRIES);

  // Keep the URL in sync with the productType filter so users can copy/share
  // the URL or hit back/forward. Other filters are intentionally NOT URL-
  // backed yet — only the category one, since that's the deep-link target.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (productType === ALL) {
      params.delete("category");
    } else if (productType === UNCLASSIFIED) {
      params.set("category", URL_UNCATEGORIZED);
    } else {
      params.set("category", productType);
    }
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productType]);

  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.vendor) set.add(p.vendor);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const productTypes = useMemo(() => {
    const set = new Set<string>();
    let hasUncategorized = false;
    for (const p of products) {
      if (isUncategorized(p.product_type)) {
        hasUncategorized = true;
      } else {
        set.add(p.product_type!.trim());
      }
    }
    const types = Array.from(set).sort((a, b) => a.localeCompare(b));
    return hasUncategorized ? [...types, UNCLASSIFIED] : types;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = products.filter((p) => {
      if (p.use_case_count < minEntries) return false;
      if (q && !p.canonical_name.toLowerCase().includes(q)) return false;
      if (vendor !== ALL && p.vendor !== vendor) return false;
      if (productType === UNCLASSIFIED) {
        if (!isUncategorized(p.product_type)) return false;
      } else if (productType !== ALL && p.product_type !== productType) {
        return false;
      }
      if (frontierOnly && p.is_frontier_llm !== 1) return false;
      if (genaiOnly && p.is_generative_ai !== 1) return false;
      return true;
    });
    rows.sort((a, b) => {
      if (sortKey === "name")
        return a.canonical_name.localeCompare(b.canonical_name);
      if (sortKey === "use_case_count")
        return b.use_case_count - a.use_case_count;
      return b.agency_count - a.agency_count;
    });
    return rows;
  }, [
    products,
    search,
    vendor,
    productType,
    frontierOnly,
    genaiOnly,
    sortKey,
    minEntries,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    vendor !== ALL ||
    productType !== ALL ||
    frontierOnly ||
    genaiOnly ||
    sortKey !== "agency_count" ||
    minEntries !== DEFAULT_MIN_ENTRIES;

  const resetFilters = () => {
    setSearch("");
    setVendor(ALL);
    setProductType(ALL);
    setFrontierOnly(false);
    setGenaiOnly(false);
    setSortKey("agency_count");
    setMinEntries(DEFAULT_MIN_ENTRIES);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <aside className="border-y-2 border-foreground py-4 lg:sticky lg:top-[9.25rem] lg:border-y-0 lg:border-r-2 lg:py-0 lg:pr-6">
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
          <FilterField label="Search">
            <input
              type="search"
              placeholder="Product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={fieldClass + " w-full"}
            />
          </FilterField>

          <FilterSelect
            label="Vendor"
            value={vendor}
            onChange={setVendor}
            options={[
              { value: ALL, label: "All vendors" },
              ...vendors.map((v) => ({ value: v, label: v })),
            ]}
          />

          <FilterSelect
            label="Category (IFP-curated)"
            value={productType}
            onChange={setProductType}
            options={[
              { value: ALL, label: "All categories" },
              ...productTypes.map((t) => ({
                value: t,
                label: t === UNCLASSIFIED ? "Uncategorized" : humanize(t),
              })),
            ]}
          />

          <FilterSelect
            label="Sort"
            value={sortKey}
            onChange={(v) => setSortKey(v as SortKey)}
            options={[
              { value: "agency_count", label: "Agencies, desc" },
              { value: "use_case_count", label: "Entries, desc" },
              { value: "name", label: "Name, A-Z" },
            ]}
          />

          <FilterSelect
            label="Min entries"
            value={String(minEntries)}
            onChange={(v) => setMinEntries(Number(v))}
            options={MIN_ENTRIES_OPTIONS.map((o) => ({
              value: String(o.value),
              label: o.label,
            }))}
          />
        </div>

        <div className="mt-4 space-y-3 border-t border-dotted border-border pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={frontierOnly}
              onChange={(e) => setFrontierOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--stamp)]"
            />
            Frontier LLM only
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={genaiOnly}
              onChange={(e) => setGenaiOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--stamp)]"
            />
            Generative AI only
          </label>
          {productType !== ALL && productType !== UNCLASSIFIED ? (
            <Link
              href={buildUseCasesUrl({ productCategories: [productType] })}
              className="inline-flex border border-dotted border-border px-2 py-1 text-foreground transition-colors hover:border-foreground hover:text-[var(--stamp)]"
              title={`Drill into all use cases that reference any product in the '${productType}' category`}
            >
              → See use cases in {humanize(productType)}
            </Link>
          ) : null}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="block border border-border px-2 py-1 text-foreground transition-colors hover:border-foreground hover:text-[var(--stamp)]"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-y border-border py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <span>
            <span className="tabular-nums text-foreground">
              {formatNumber(filtered.length)}
            </span>{" "}
            / {formatNumber(products.length)} products
          </span>
          {hasActiveFilters ? (
            <span className="text-foreground">Filtered catalogue</span>
          ) : (
            <span>Sorted by agency adoption</span>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState variant="boxed" message="No products match these filters" />
        ) : (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                parentName={
                  p.parent_product_id != null
                    ? (parentNames[p.parent_product_id] ?? null)
                    : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterField({
  label,
  hint,
  title,
  children,
}: {
  label: string;
  hint?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="flex items-baseline gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--stamp)]"
        title={title}
      >
        {label}
        {hint ? (
          <span
            className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/80"
            aria-hidden
          >
            ({hint})
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

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
import { ProductCard } from "@/components/product-card";
import { humanize, formatNumber } from "@/lib/formatting";
import { buildUseCasesUrl } from "@/lib/urls";
import type { ProductWithCounts } from "@/lib/types";

type SortKey = "agency_count" | "use_case_count" | "name";

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
  "h-8 min-w-0 border border-border bg-background px-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground focus:border-foreground focus:outline-none";

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
  }, [products, search, vendor, productType, frontierOnly, genaiOnly, sortKey]);

  return (
    <div className="flex flex-col gap-8">
      <div className="border-y-2 border-foreground py-3">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <FilterField label="Search">
            <input
              type="search"
              placeholder="Product name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={fieldClass + " w-full"}
            />
          </FilterField>

          <FilterField label="Vendor">
            <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className={fieldClass + " w-full"}
            >
              <option value={ALL}>All vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField
            label="Category"
            hint="IFP-curated"
            title="Internal product category curated by IFP (e.g. general_llm, security_tool). Not the OMB M-25-21 ai_classification field, which lives on individual use cases."
          >
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className={fieldClass + " w-full"}
            >
              <option value={ALL}>All categories</option>
              {productTypes.map((t) => (
                <option key={t} value={t}>
                  {t === UNCLASSIFIED ? "Uncategorized" : humanize(t)}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Sort">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className={fieldClass + " w-full"}
            >
              <option value="agency_count">Agencies, desc</option>
              <option value="use_case_count">Entries, desc</option>
              <option value="name">Name, A–Z</option>
            </select>
          </FilterField>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-dotted border-border pt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
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
              className="border border-dotted border-border px-2 py-0.5 text-foreground transition-colors hover:border-foreground hover:text-[var(--stamp)]"
              title={`Drill into all use cases that reference any product in the '${productType}' category`}
            >
              → See use cases in {humanize(productType)}
            </Link>
          ) : null}
          <span className="ml-auto">
            <span className="tabular-nums text-foreground">
              {formatNumber(filtered.length)}
            </span>{" "}
            / {formatNumber(products.length)} products
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center border border-dashed border-border font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          — No products match these filters —
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

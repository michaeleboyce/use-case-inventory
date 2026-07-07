"use client";

/**
 * Sidebar filter panel for the Use Cases Explorer — editorial edition.
 *
 * Every control reads/writes to URL search params so the page can remain
 * a Server Component and the filtering is done in SQL on the server.
 *
 * Multi-select groups are represented as comma-separated param values
 * (e.g. `?entry_type=custom_system,product_deployment`). Single-value
 * filters (search, agency_type) also live in query params. Toggles use
 * a `1` / absent convention.
 *
 * Visually: flat, hairline-ruled sections; mono uppercase labels; no
 * shadcn Card wrapper. Matches the newspaper-filing aesthetic shared
 * across the dashboard.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import {
  CheckRow,
  FilterGroup,
  MonoLabel,
  SourceChip,
} from "@/components/ui/filter-primitives";
import { EntryKindToggle } from "./controls";
import { labelFor, parseCsv, toggleInCsv } from "./filter-utils";
import { INTEGRATION_DEPTH_ORDER } from "@/lib/derived-display";

export interface FilterOption {
  value: string;
  label: string;
}

export interface UseCaseFiltersProps {
  agencies: Array<{ id: number; name: string; abbreviation: string }>;
  products: Array<{
    id: number;
    canonical_name: string;
    vendor: string | null;
    use_case_count?: number;
  }>;
  templates: Array<{
    id: number;
    short_name: string;
    use_case_count?: number;
    agency_count?: number;
  }>;
  facets: {
    agencyTypes: string[];
    tagEntryTypes: string[];
    tagDeploymentScopes: string[];
    tagAISophistications: string[];
    tagIntegrationDepths: string[];
    tagArchitectureTypes: string[];
    tagUseTypes: string[];
    tagHighImpactDesignations: string[];
    topicAreas: string[];
    productCategories: string[];
    bureaus: string[];
    maturityTiers: string[];
    isWithhelds: string[];
    contractingUsages: string[];
    lineageStatuses: string[];
  };
}

export function UseCaseFilters({
  agencies,
  products,
  templates,
  facets,
}: UseCaseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchDraft, setSearchDraft] = useState<string>(
    searchParams.get("q") ?? "",
  );
  const [agencyQuery, setAgencyQuery] = useState<string>("");
  const [productQuery, setProductQuery] = useState<string>("");
  const [templateQuery, setTemplateQuery] = useState<string>("");
  const [bureauQuery, setBureauQuery] = useState<string>("");
  const [vendorDraft, setVendorDraft] = useState<string>(
    searchParams.get("vendor") ?? "",
  );

  const currentParams = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );

  const pushParams = useCallback(
    (next: URLSearchParams) => {
      next.delete("page");
      const qs = next.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.push(href);
      });
    },
    [router, pathname],
  );

  const setSingle = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(currentParams.toString());
      if (value && value.length > 0) next.set(key, value);
      else next.delete(key);
      pushParams(next);
    },
    [currentParams, pushParams],
  );

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(currentParams.toString());
      const updated = toggleInCsv(next.get(key), value);
      if (updated.length > 0) next.set(key, updated);
      else next.delete(key);
      // Template links live on consolidated_use_cases only — bumping
      // entry_kind to "all" so a template selection actually narrows
      // something (matches the drill-through behavior in lib/urls.ts).
      if (key === "template_ids" && updated.length > 0 && !next.get("entry_kind")) {
        next.set("entry_kind", "all");
      }
      pushParams(next);
    },
    [currentParams, pushParams],
  );

  const toggleBool = useCallback(
    (key: string) => {
      const next = new URLSearchParams(currentParams.toString());
      if (next.get(key) === "1") next.delete(key);
      else next.set(key, "1");
      pushParams(next);
    },
    [currentParams, pushParams],
  );

  const clearAll = useCallback(() => {
    startTransition(() => router.push(pathname));
  }, [router, pathname]);

  const submitSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSingle("q", searchDraft.trim() || null);
    },
    [searchDraft, setSingle],
  );

  const selectedAgencyIds = parseCsv(currentParams.get("agency_ids"));
  const selectedAgencyTypes = parseCsv(currentParams.get("agency_type"));
  const selectedEntryTypes = parseCsv(currentParams.get("entry_type"));
  const selectedSophistication = parseCsv(currentParams.get("sophistication"));
  const selectedProductIds = parseCsv(currentParams.get("product_ids"));
  const selectedTemplateIds = parseCsv(currentParams.get("template_ids"));
  const selectedBureaus = parseCsv(currentParams.get("bureau"));
  const selectedMaturityTiers = parseCsv(currentParams.get("tier"));
  const selectedIsWithhelds = parseCsv(currentParams.get("withheld"));
  const selectedContractingUsages = parseCsv(currentParams.get("contracting"));
  const selectedLineageStatuses = parseCsv(currentParams.get("lineage"));
  const selectedScopes = parseCsv(currentParams.get("scope"));
  const selectedIntegrationDepths = parseCsv(
    currentParams.get("integration_depth"),
  );
  const selectedArchitectures = parseCsv(currentParams.get("architecture"));
  const selectedUseTypes = parseCsv(currentParams.get("use_type"));
  const selectedHighImpact = parseCsv(currentParams.get("high_impact"));
  const selectedTopicAreas = parseCsv(currentParams.get("topic_area"));
  const selectedProductCategories = parseCsv(currentParams.get("product_category"));

  const activeCount =
    Array.from(currentParams.keys()).filter((k) => k !== "view" && k !== "page")
      .length;

  const filteredAgencies = useMemo(() => {
    const q = agencyQuery.trim().toLowerCase();
    if (!q) return agencies;
    return agencies.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.abbreviation.toLowerCase().includes(q),
    );
  }, [agencies, agencyQuery]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const base = q
      ? products.filter(
          (p) =>
            p.canonical_name.toLowerCase().includes(q) ||
            (p.vendor ?? "").toLowerCase().includes(q),
        )
      : products;
    // Pin selected products to the top so the user can always see what's active.
    const selected = new Set(selectedProductIds);
    return [...base].sort((a, b) => {
      const aSel = selected.has(String(a.id)) ? 1 : 0;
      const bSel = selected.has(String(b.id)) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      return (b.use_case_count ?? 0) - (a.use_case_count ?? 0);
    });
  }, [products, productQuery, selectedProductIds]);

  const topProductPicks = useMemo(
    () => products.filter((p) => (p.use_case_count ?? 0) > 0).slice(0, 6),
    [products],
  );

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    const base = q
      ? templates.filter((t) => t.short_name.toLowerCase().includes(q))
      : templates;
    const selected = new Set(selectedTemplateIds);
    return [...base].sort((a, b) => {
      const aSel = selected.has(String(a.id)) ? 1 : 0;
      const bSel = selected.has(String(b.id)) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      return (b.use_case_count ?? 0) - (a.use_case_count ?? 0);
    });
  }, [templates, templateQuery, selectedTemplateIds]);

  const filteredBureaus = useMemo(() => {
    const q = bureauQuery.trim().toLowerCase();
    if (!q) return facets.bureaus;
    return facets.bureaus.filter((b) => b.toLowerCase().includes(q));
  }, [facets.bureaus, bureauQuery]);

  // Order the DB-distinct integration-depth values shallow → deep, then append
  // the "Not assessed" (NULL) sentinel so the facet reads as a progression.
  const orderedIntegrationDepths = useMemo(() => {
    const present = new Set(facets.tagIntegrationDepths);
    const ordered = INTEGRATION_DEPTH_ORDER.filter((v) => present.has(v));
    // Any labeled value not in the canonical order (defensive) sorts after.
    for (const v of facets.tagIntegrationDepths) {
      if (!ordered.includes(v)) ordered.push(v);
    }
    return [...ordered, "not_assessed"];
  }, [facets.tagIntegrationDepths]);

  const submitVendor = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSingle("vendor", vendorDraft.trim() || null);
    },
    [vendorDraft, setSingle],
  );

  return (
    <aside
      className={cn(
        "flex w-full flex-col text-sm",
        isPending && "opacity-60",
      )}
      aria-label="Filters"
    >
      {/* Panel header — editorial eyebrow + hairline rule. */}
      <div className="flex items-end justify-between gap-2 border-b-2 border-foreground pb-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--stamp)]">
            § Filter
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {activeCount > 0 ? (
              <>
                <span className="tabular-nums text-foreground">
                  {activeCount}
                </span>{" "}
                active
              </>
            ) : (
              <>No filter applied</>
            )}
          </div>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
          >
            Clear
            <X className="size-3" aria-hidden />
          </button>
        )}
      </div>

      {/* Full-text search */}
      <form onSubmit={submitSearch} className="flex flex-col gap-1.5 pt-4">
        <MonoLabel>Search</MonoLabel>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.currentTarget.value)}
            placeholder="name, problem, vendor…"
            className="border-border bg-transparent pl-7 font-mono text-[12px]"
          />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          ↵ Enter to query
        </p>
      </form>

      {/* Entry-kind toggle. Default = individual (3,549 rows); switch to
          consolidated (900) for OMB enterprise-license rows; "All" combines
          both (4,449). Drill-throughs from product/agency pages arrive with
          entry_kind=all so the page count matches the link's count. */}
      <div className="flex flex-col gap-1.5 pt-4">
        <div className="flex items-center gap-2">
          <MonoLabel>Entry kind</MonoLabel>
          <SourceChip source="omb" />
        </div>
        <EntryKindToggle
          value={
            currentParams.get("entry_kind") === "consolidated"
              ? "consolidated"
              : currentParams.get("entry_kind") === "all"
                ? "all"
                : "individual"
          }
          onChange={(v) => {
            // "individual" is the default — represented by absence of the
            // URL param. "consolidated" / "all" are explicit.
            setSingle("entry_kind", v === "individual" ? null : v);
          }}
        />
      </div>

      {/* Agency Type */}
      <FilterGroup title="Agency type" source="derived">
        {facets.agencyTypes.map((v) => (
          <CheckRow
            key={v}
            checked={selectedAgencyTypes.includes(v)}
            onToggle={() => toggleMulti("agency_type", v)}
            label={labelFor(v)}
          />
        ))}
      </FilterGroup>

      {/* Agency (searchable) */}
      <FilterGroup title="Agency" defaultOpen={false} source="omb">
        <div className="mb-2">
          <Input
            value={agencyQuery}
            onChange={(e) => setAgencyQuery(e.currentTarget.value)}
            placeholder="Find agency…"
            className="h-7 border-border bg-transparent font-mono text-[11px]"
          />
        </div>
        <div className="max-h-56 overflow-y-auto pr-1">
          {filteredAgencies.map((a) => (
            <CheckRow
              key={a.id}
              checked={selectedAgencyIds.includes(String(a.id))}
              onToggle={() => toggleMulti("agency_ids", String(a.id))}
              label={
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground">
                    {a.abbreviation}
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {a.name}
                  </span>
                </span>
              }
            />
          ))}
          {filteredAgencies.length === 0 && (
            <p className="py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              No matches
            </p>
          )}
        </div>
      </FilterGroup>

      {/* Bureau / sub-agency — OMB-filed `bureau_component`, count-ranked. */}
      <FilterGroup
        title={
          selectedBureaus.length > 0
            ? `Bureau · ${selectedBureaus.length} selected`
            : "Bureau"
        }
        defaultOpen={selectedBureaus.length > 0}
        source="omb"
      >
        <div className="mb-2">
          <Input
            value={bureauQuery}
            onChange={(e) => setBureauQuery(e.currentTarget.value)}
            placeholder="Find bureau…"
            className="h-7 border-border bg-transparent font-mono text-[11px]"
          />
        </div>
        <div className="max-h-56 overflow-y-auto pr-1">
          {filteredBureaus.map((b) => (
            <CheckRow
              key={b}
              checked={selectedBureaus.includes(b)}
              onToggle={() => toggleMulti("bureau", b)}
              label={b}
            />
          ))}
          {filteredBureaus.length === 0 && (
            <p className="py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              No matches
            </p>
          )}
        </div>
      </FilterGroup>

      {/* Agency maturity tier — IFP rubric, applied to the row's agency. */}
      <FilterGroup
        title="Maturity tier (agency)"
        defaultOpen={false}
        source="derived"
      >
        {facets.maturityTiers.map((v) => (
          <CheckRow
            key={v}
            checked={selectedMaturityTiers.includes(v)}
            onToggle={() => toggleMulti("tier", v)}
            label={labelFor(v)}
          />
        ))}
        {facets.maturityTiers.length === 0 && (
          <p className="py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            No tiers computed
          </p>
        )}
      </FilterGroup>

      {/* Entry type */}
      <FilterGroup title="Entry type" defaultOpen={false} source="derived">
        {facets.tagEntryTypes.map((v) => (
          <CheckRow
            key={v}
            checked={selectedEntryTypes.includes(v)}
            onToggle={() => toggleMulti("entry_type", v)}
            label={labelFor(v)}
          />
        ))}
      </FilterGroup>

      {/* AI sophistication */}
      <FilterGroup title="AI sophistication" source="omb-derived">
        {facets.tagAISophistications.map((v) => (
          <CheckRow
            key={v}
            checked={selectedSophistication.includes(v)}
            onToggle={() => toggleMulti("sophistication", v)}
            label={labelFor(v)}
          />
        ))}
      </FilterGroup>

      {/* Integration depth — IFP-adjudicated 2026-07 labeling round. How deeply
          the AI is wired into the agency's work. "Not assessed" (NULL) covers
          every entry outside the labeled pilot+deployed population — the bulk
          of the inventory — so it is expected to be by far the largest bucket. */}
      <FilterGroup
        title={
          selectedIntegrationDepths.length > 0
            ? `Integration depth · ${selectedIntegrationDepths.length} selected`
            : "Integration depth"
        }
        defaultOpen={selectedIntegrationDepths.length > 0}
        source="derived"
      >
        {orderedIntegrationDepths.map((v) => (
          <CheckRow
            key={v}
            checked={selectedIntegrationDepths.includes(v)}
            onToggle={() => toggleMulti("integration_depth", v)}
            label={labelFor(v)}
          />
        ))}
        <p className="pt-2 font-mono text-[10px] leading-relaxed tracking-[0.06em] text-muted-foreground">
          IFP-adjudicated 2026-07. “Not assessed” = outside the labeled
          pilot/deployed population (distinct from “Unclear”).
        </p>
      </FilterGroup>

      {/* Product */}
      <FilterGroup
        title={
          selectedProductIds.length > 0
            ? `Product · ${selectedProductIds.length} selected`
            : "Product"
        }
        defaultOpen={selectedProductIds.length > 0}
        source="derived"
      >
        {/* Popular picks — one click to filter by a widely-deployed product. */}
        {topProductPicks.length > 0 && productQuery.trim() === "" && (
          <div className="mb-2">
            <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
              Popular
            </div>
            <div className="flex flex-wrap gap-1">
              {topProductPicks.map((p) => {
                const active = selectedProductIds.includes(String(p.id));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleMulti("product_ids", String(p.id))}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                    )}
                    title={`${p.canonical_name}${p.vendor ? ` · ${p.vendor}` : ""} — ${p.use_case_count ?? 0} use cases`}
                  >
                    <span className="truncate max-w-[140px]">
                      {p.canonical_name}
                    </span>
                    <span className="tabular-nums opacity-70">
                      {p.use_case_count ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-2">
          <Input
            value={productQuery}
            onChange={(e) => setProductQuery(e.currentTarget.value)}
            placeholder="Search product or vendor…"
            className="h-7 border-border bg-transparent font-mono text-[11px]"
          />
        </div>
        <div className="max-h-56 overflow-y-auto pr-1">
          {filteredProducts.map((p) => (
            <CheckRow
              key={p.id}
              checked={selectedProductIds.includes(String(p.id))}
              onToggle={() => toggleMulti("product_ids", String(p.id))}
              label={
                <span className="flex w-full items-start gap-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[12px] text-foreground">
                      {p.canonical_name}
                    </span>
                    {p.vendor && (
                      <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {p.vendor}
                      </span>
                    )}
                  </span>
                  {p.use_case_count != null && p.use_case_count > 0 && (
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {p.use_case_count}
                    </span>
                  )}
                </span>
              }
            />
          ))}
          {filteredProducts.length === 0 && (
            <p className="py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              No matches
            </p>
          )}
        </div>
      </FilterGroup>

      {/* Template — IFP-curated OMB Appendix B "common use case" pattern.
          Mirrors the Product picker (same searchable + count-ranked shape). */}
      <FilterGroup
        title={
          selectedTemplateIds.length > 0
            ? `Template · ${selectedTemplateIds.length} selected`
            : "Template"
        }
        defaultOpen={selectedTemplateIds.length > 0}
        source="derived"
      >
        <div className="mb-2">
          <Input
            value={templateQuery}
            onChange={(e) => setTemplateQuery(e.currentTarget.value)}
            placeholder="Search template…"
            className="h-7 border-border bg-transparent font-mono text-[11px]"
          />
        </div>
        <div className="max-h-56 overflow-y-auto pr-1">
          {filteredTemplates.map((t) => (
            <CheckRow
              key={t.id}
              checked={selectedTemplateIds.includes(String(t.id))}
              onToggle={() => toggleMulti("template_ids", String(t.id))}
              label={
                <span className="flex w-full items-start gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                    {t.short_name}
                  </span>
                  {t.use_case_count != null && t.use_case_count > 0 && (
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {t.use_case_count}
                    </span>
                  )}
                </span>
              }
            />
          ))}
          {filteredTemplates.length === 0 && (
            <p className="py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              No matches
            </p>
          )}
        </div>
      </FilterGroup>

      {/* Vendor (substring) — OMB-filed `vendor_name` with a LIKE %v% match.
          Was previously drill-through-only from the LLM-vendor donut. */}
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <MonoLabel>Vendor (contains)</MonoLabel>
          <SourceChip source="omb" />
        </div>
        <form onSubmit={submitVendor}>
          <Input
            value={vendorDraft}
            onChange={(e) => setVendorDraft(e.currentTarget.value)}
            placeholder="e.g. Microsoft, Palantir…"
            className="h-7 border-border bg-transparent font-mono text-[11px]"
          />
        </form>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          ↵ Enter to query
        </p>
      </div>

      {/* Deployment scope */}
      <FilterGroup title="Deployment scope" defaultOpen={false} source="omb-derived">
        {facets.tagDeploymentScopes.map((v) => (
          <CheckRow
            key={v}
            checked={selectedScopes.includes(v)}
            onToggle={() => toggleMulti("scope", v)}
            label={labelFor(v)}
          />
        ))}
      </FilterGroup>

      {/* Architecture type */}
      <FilterGroup title="Architecture" defaultOpen={false} source="derived">
        {facets.tagArchitectureTypes.map((v) => (
          <CheckRow
            key={v}
            checked={selectedArchitectures.includes(v)}
            onToggle={() => toggleMulti("architecture", v)}
            label={labelFor(v)}
          />
        ))}
      </FilterGroup>

      {/* Use type */}
      <FilterGroup title="Use type" defaultOpen={false} source="derived">
        {facets.tagUseTypes.map((v) => (
          <CheckRow
            key={v}
            checked={selectedUseTypes.includes(v)}
            onToggle={() => toggleMulti("use_type", v)}
            label={labelFor(v)}
          />
        ))}
      </FilterGroup>

      {/* Topic area (OMB-filed). Long-tail facets are pre-filtered by
          getUseCaseFacets in @/lib/db. */}
      <FilterGroup
        title={
          selectedTopicAreas.length > 0
            ? `Topic area · ${selectedTopicAreas.length} selected`
            : "Topic area"
        }
        defaultOpen={selectedTopicAreas.length > 0}
        source="omb"
      >
        <div className="max-h-56 overflow-y-auto pr-1">
          {facets.topicAreas.map((v) => (
            <CheckRow
              key={v}
              checked={selectedTopicAreas.includes(v)}
              onToggle={() => toggleMulti("topic_area", v)}
              label={v}
            />
          ))}
        </div>
      </FilterGroup>

      {/* Product category (IFP-curated). Joins through use_case_products
          to products.product_type — independent of OMB ai_classification.
          Default-open when something is selected (e.g. arrived from a
          /products?category=X drill-through). */}
      <FilterGroup
        title={
          selectedProductCategories.length > 0
            ? `Product category · ${selectedProductCategories.length} selected`
            : "Product category"
        }
        defaultOpen={selectedProductCategories.length > 0}
        source="derived"
      >
        <div className="max-h-56 overflow-y-auto pr-1">
          {facets.productCategories.map((v) => (
            <CheckRow
              key={v}
              checked={selectedProductCategories.includes(v)}
              onToggle={() => toggleMulti("product_category", v)}
              label={labelFor(v)}
            />
          ))}
        </div>
      </FilterGroup>

      {/* Contracting usage — OMB-filed `contracting_usage` (DB:
          `development_type`). Build-vs-buy signal. */}
      <FilterGroup title="Contracting" defaultOpen={false} source="omb">
        {facets.contractingUsages.map((v) => (
          <CheckRow
            key={v}
            checked={selectedContractingUsages.includes(v)}
            onToggle={() => toggleMulti("contracting", v)}
            label={v}
          />
        ))}
      </FilterGroup>

      {/* Is withheld — OMB-filed `is_withheld`. */}
      <FilterGroup title="Withheld" defaultOpen={false} source="omb">
        {facets.isWithhelds.map((v) => (
          <CheckRow
            key={v}
            checked={selectedIsWithhelds.includes(v)}
            onToggle={() => toggleMulti("withheld", v)}
            label={v}
          />
        ))}
      </FilterGroup>

      {/* Year-over-year lineage — IFP-adjudicated 2024 ↔ 2025 matcher
          (scripts/match_inventories_yoy.py + LLM follow-up). Statuses that
          attach to a 2025 row only: continued, new_2025, renamed, split. */}
      <FilterGroup
        title={
          selectedLineageStatuses.length > 0
            ? `Lineage · ${selectedLineageStatuses.length} selected`
            : "Year-over-year lineage"
        }
        defaultOpen={selectedLineageStatuses.length > 0}
        source="derived"
      >
        {facets.lineageStatuses.map((v) => (
          <CheckRow
            key={v}
            checked={selectedLineageStatuses.includes(v)}
            onToggle={() => toggleMulti("lineage", v)}
            label={labelFor(v)}
          />
        ))}
        {facets.lineageStatuses.length === 0 && (
          <p className="py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            No lineage data
          </p>
        )}
      </FilterGroup>

      {/* High impact designation */}
      <FilterGroup title="High-impact" defaultOpen={false} source="omb-derived">
        {facets.tagHighImpactDesignations.map((v) => (
          <CheckRow
            key={v}
            checked={selectedHighImpact.includes(v)}
            onToggle={() => toggleMulti("high_impact", v)}
            label={labelFor(v)}
          />
        ))}
      </FilterGroup>

      {/* Boolean toggles */}
      <FilterGroup title="Attributes" defaultOpen={false} source="mixed">
        <CheckRow
          checked={currentParams.get("coding_tool") === "1"}
          onToggle={() => toggleBool("coding_tool")}
          label="Coding tool"
        />
        <CheckRow
          checked={currentParams.get("general_llm_access") === "1"}
          onToggle={() => toggleBool("general_llm_access")}
          label="General LLM access"
        />
        <CheckRow
          checked={currentParams.get("genai") === "1"}
          onToggle={() => toggleBool("genai")}
          label="Generative AI"
        />
        <CheckRow
          checked={currentParams.get("public_facing") === "1"}
          onToggle={() => toggleBool("public_facing")}
          label="Public facing"
        />
        <CheckRow
          checked={currentParams.get("has_ato") === "1"}
          onToggle={() => toggleBool("has_ato")}
          label="ATO / FedRAMP"
        />
        <CheckRow
          checked={currentParams.get("risk_docs") === "1"}
          onToggle={() => toggleBool("risk_docs")}
          label="Meaningful risk docs"
        />
        <CheckRow
          checked={currentParams.get("has_pii") === "1"}
          onToggle={() => toggleBool("has_pii")}
          label="Involves PII"
        />
        <CheckRow
          checked={currentParams.get("has_custom_code") === "1"}
          onToggle={() => toggleBool("has_custom_code")}
          label="Custom code"
        />
      </FilterGroup>
    </aside>
  );
}

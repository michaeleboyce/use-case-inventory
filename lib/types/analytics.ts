/**
 * Analytics view-model types returned by query helpers.
 */

export interface GlobalStats {
  total_use_cases: number;
  total_consolidated: number;
  total_agencies: number;
  total_agencies_with_data: number;
  total_products: number;
  total_templates: number;
  total_coding_entries: number;
  total_genai_entries: number;
  total_high_impact_entries: number;
  /** OMB M-25-21 stage buckets (canonical use_cases only; consolidated
   *  rows have no stage_of_development column). Keys: pre_deployment,
   *  pilot, deployed, retired, unknown. */
  stage_bucket_counts: Record<string, number>;
}

export interface BreakdownRow {
  label: string;
  count: number;
}

export interface BureauBreakdown extends BreakdownRow {
  bureau_component: string | null;
}

export interface YoYRow {
  agency_id: number;
  name: string;
  abbreviation: string;
  year_over_year_growth: number | null;
  total_use_cases: number | null;
}

export interface VendorShareRow {
  vendor: string;
  product_count: number;
  use_case_count: number;
  agency_count: number;
}

/** One row of the IFP-category distribution: how many canonical products
 *  fall into each category, and the use-case / agency reach of those
 *  products. Excludes the 'unclassified' placeholder. */
export interface CategoryDistributionRow {
  category: string;
  product_count: number;
  use_case_count: number;
  agency_count: number;
}

export interface HeatmapCell {
  product_id: number;
  product_name: string;
  agency_id: number;
  agency_abbreviation: string;
  count: number;
}

/** Discriminator for the supported cross-cut dimensions. Mirrors
 *  CrossCutDimension in lib/urls.ts but extended with `vendor` for the
 *  product-side cross-cut. */
export type CrossCutKey =
  | "entry_type"
  | "sophistication"
  | "scope"
  | "use_type"
  | "high_impact"
  | "topic_area"
  | "vendor"
  | "product_type";

export interface CrossCutValueRow {
  value: string;
  count: number;
  top_agencies: Array<{ id: number; abbreviation: string; count: number }>;
  top_products: Array<{ id: number; canonical_name: string; count: number }>;
}

export interface CrossCutHeatmapCell {
  value: string;
  agency_id: number;
  agency_abbreviation: string;
  count: number;
}

/** 2D rollup powering /browse/category-topic — IFP-curated product
 *  categories on rows × OMB-filed topic areas on columns. */
export interface CategoryTopicCrossTab {
  /** Top-N product categories (rows), ordered by total use-case count desc. */
  categories: Array<{ value: string; total: number }>;
  /** Top-N topic areas (columns), ordered by total use-case count desc. */
  topics: Array<{ value: string; total: number }>;
  /** Non-zero (category, topic, count) cells. */
  cells: Array<{ category: string; topic: string; count: number }>;
  /** TRUE per-category totals across ALL topics (incl. off-cap). */
  categoryTotals: Record<string, number>;
  /** TRUE per-topic totals across ALL categories (incl. off-cap). */
  topicTotals: Record<string, number>;
  /** Total distinct categories with at least one use case (incl. off-cap). */
  totalCategoryCount: number;
  /** Total distinct topics with at least one use case (incl. off-cap). */
  totalTopicCount: number;
  /** Distinct use-cases backing the visible cap × cap window. */
  visibleUseCaseCount: number;
  /** Distinct use-cases backing the full corpus (any category × any topic). */
  totalUseCaseCount: number;
}

/**
 * Command palette payload — small lists of agencies, products, templates, and
 * a capped list of use cases. The limit keeps the initial bundle small; fuzzy
 * matching happens client-side through cmdk.
 */
export interface CommandPaletteIndex {
  agencies: Array<{ id: number; abbreviation: string; name: string }>;
  products: Array<{ id: number; canonical_name: string; vendor: string | null }>;
  templates: Array<{ id: number; short_name: string | null; template_text: string }>;
  useCases: Array<{
    id: number;
    slug: string | null;
    use_case_name: string;
    agency_abbreviation: string;
  }>;
  /** Tag-dimension values ("agentic", "enterprise_wide", topic areas,
   *  product categories…) so the palette can jump straight to a filtered
   *  explorer view. `dimension` is a CrossCutDimension slug consumed by
   *  `tagFilterUrl`. */
  dimensions: Array<{ dimension: string; value: string; count: number }>;
}

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

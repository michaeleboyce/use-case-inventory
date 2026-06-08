/**
 * Row types for the 2024 ↔ 2025 cycle comparison (Phase 2 + Phase 4).
 *
 * `YearComparisonRow` mirrors the `year_comparison` table — aggregate YoY
 * rollups computed by the ETL. The lineage shapes mirror per-use-case
 * adjudication stored in `use_case_year_links`.
 */

/** A lineage_status value on `use_case_year_links`. */
export type LineageStatus =
  | "continued"
  | "renamed"
  | "split"
  | "retired_2024"
  | "new_2025";

/** One row of the `year_comparison` table. */
export interface YearComparisonRow {
  /** total | agency | stage | dev_method */
  dimension: string;
  /** Stage/dev-method label, agency abbreviation, or null for the total row. */
  bucket: string | null;
  agency_id: number | null;
  count_2024: number;
  count_2025: number;
  delta: number;
  pct_change: number | null;
  /** clean | lossy — how trustworthy the YoY comparison is. */
  comparability: string;
  notes: string | null;
}

/** One lineage_status with its use-case count. */
export interface LineageStatusCount {
  lineage_status: LineageStatus;
  count: number;
}

/** Per-agency rollup of lineage statuses, joined to agency names. */
export interface PerAgencyLineageRow {
  agency_id: number;
  abbreviation: string;
  name: string;
  count_2024: number;
  count_2025: number;
  delta: number;
  pct_change: number | null;
  continued: number;
  renamed: number;
  split: number;
  retired_2024: number;
  new_2025: number;
}

/**
 * Active-vs-already-retired split of the `retired_2024` links — the
 * "silently dropped" headline finding. `active` use cases were live in
 * 2024 (any non-Retired dev_stage) but absent from the 2025 inventory.
 */
export interface RetiredBreakdown {
  /** Total `retired_2024` links. */
  total: number;
  /** Of those, the count that were already filed as Retired in 2024. */
  alreadyRetired: number;
  /** Of those, the count that were active in 2024 and silently dropped. */
  active: number;
}

/** A representative use case for one lineage status (illustrative lists). */
export interface LineageSample {
  lineage_status: LineageStatus;
  agency_abbreviation: string | null;
  name_2024: string | null;
  name_2025: string | null;
  match_method: string | null;
  llm_reasoning: string | null;
}

/**
 * Headline bucketing of the `retired_2024` lineage population, for the
 * "silently-dropped" page. Computed live from `use_case_year_links` joined
 * to `use_cases_2024.dev_stage`.
 */
export interface SilentlyDroppedSummary {
  /** All `retired_2024` lineage links — use cases present in 2024 absent in 2025. */
  total: number;
  /** Of those, the count whose 2024 dev_stage was already "Retired". */
  alreadyRetired: number;
  /** The rest: active in 2024 (Pre-deployment, Pilot, Deployed) and dropped silently. */
  activeDropped: number;
  /** Subset of activeDropped attributable to USAID (agency dissolved in 2025). */
  usaidActiveDropped: number;
  /** activeDropped minus USAID — the compliance gap among agencies that did file in 2025. */
  nonUsaidActiveDropped: number;
}

/**
 * Recode of the 2024 deployment-stage taxonomy onto a four-bucket scale used
 * on the silently-dropped page. `already_retired` is excluded from this row
 * set — the breakdown is over *active* 2024 use cases only.
 */
export type SilentlyDroppedStageBucket =
  | "deployed"
  | "pilot"
  | "pre_deployment"
  | "other";

/** One bucket of the by-stage table on the silently-dropped page. */
export interface SilentlyDroppedStageRow {
  bucket: SilentlyDroppedStageBucket;
  count: number;
}

/** One agency-level row of the silently-dropped page's per-agency ledger. */
export interface SilentlyDroppedAgencyRow {
  agency_id: number | null;
  abbreviation: string;
  name: string;
  /** Use cases this agency filed in 2024. */
  filed_2024: number;
  /** Of those, how many silently dropped (active in 2024, absent in 2025). */
  dropped: number;
  /** dropped / filed_2024 — null when filed_2024 is 0. */
  pct_dropped: number | null;
  /** True for USAID, dissolved in 2025 and shown out-of-band. */
  is_dissolved: boolean;
}

/** One row of the full silently-dropped list (and the §IV example pool). */
export interface SilentlyDroppedRow {
  uc_2024_id: number;
  agency_abbreviation: string | null;
  agency_name: string | null;
  use_case_name: string | null;
  dev_stage: string | null;
  bureau: string | null;
  purpose_benefits: string | null;
  outputs: string | null;
  /** True for USAID rows — caller can render with a marker or filter out. */
  is_dissolved: boolean;
}

/**
 * IFP-tagged 2024 headline counts from `use_case_tags_2024_canonical` — the
 * canonical (highest-wave) tag per 2024 use case. Surfaced alongside the 2025
 * numbers so readers can see the prior-cycle baseline.
 */
export interface Tags2024Headlines {
  /** All 2024 use cases with a canonical IFP tag. */
  total: number;
  /** Of those, tagged is_generative_ai = 1. */
  genai: number;
  /** Of those, tagged is_enterprise_wide = 1. */
  enterprise_wide: number;
}

/**
 * One silently-dropped use case that IFP tagged as generative AI and that was
 * in a live (production/implementation) 2024 deployment stage — i.e. an active
 * GenAI capability that vanished from the 2025 inventory without being filed as
 * Retired.
 */
export interface SilentlyDroppedGenAiRow {
  uc_2024_id: number;
  agency_abbreviation: string | null;
  agency_name: string | null;
  use_case_name: string | null;
  dev_stage: string | null;
  bureau: string | null;
  /** 2024 free-text narrative — shown when a row is expanded. */
  purpose_benefits: string | null;
  /** 2024 reported system outputs — shown when a row is expanded. */
  outputs: string | null;
  tool_product_name: string | null;
  ai_sophistication: string | null;
}

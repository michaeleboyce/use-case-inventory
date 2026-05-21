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

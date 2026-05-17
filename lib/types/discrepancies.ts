/**
 * OMB consolidated discrepancy and resolution types.
 */

// ─── OMB consolidated discrepancy types ────────────────────────────────────
// Populated by load_omb_consolidated.py (omb_match_audit table). Read by the
// /discrepancies page. See docs/plans/2026-05-03-omb-consolidated-ingest.md.

export type DiscrepancyStatus =
  | "matched_exact"
  | "matched_fuzzy"
  | "suggested_rename"
  | "omb_only"
  | "db_only"
  | "duplicate_in_omb"
  | "consolidated_upstream";

export interface DiscrepancySummary {
  matched_exact: number;
  matched_fuzzy: number;
  suggested_rename: number;
  omb_only: number;
  db_only: number;
  duplicate_in_omb: number;
  consolidated_upstream: number;
  total_with_drift: number;
  total_pairs_compared: number;
}

export interface DiscrepancyRow {
  audit_id: number;
  match_status: DiscrepancyStatus;
  match_score: number | null;
  agency_abbreviation: string | null;
  use_case_name: string | null;
  /** FK into use_cases.id; null for omb_only and duplicate_in_omb statuses. */
  db_use_case_id: number | null;
  /** Agency-as-filed string id from use_cases.use_case_id. */
  db_use_case_id_text: string | null;
  /** Slug for linking to /use-cases/[slug]. */
  db_use_case_slug: string | null;
  /** FK into omb_consolidated_rows.id; null for db_only status. */
  omb_row_id: number | null;
  /** OMB-assigned use case id from the consolidated XLSX (may be null/empty). */
  omb_use_case_id: string | null;
  drift_field_count: number;
  resolved_at: string | null;
  /** Set when match_status='consolidated_upstream' — FK into
   *  omb_consolidated_rows.id pointing at the OMB aggregator row this DB
   *  row was rolled into. Null otherwise. */
  consolidated_into_omb_id?: number | null;
}

// ─── Resolution reason codes ──────────────────────────────────────────────
// Replaces free-text notes with a fixed-vocabulary reason. The note field
// remains an optional free-text supplement. Backward-compatible: existing
// rows in discrepancy_resolutions.json missing `reason` are treated as null.

export type ResolutionReason =
  | "consolidated_upstream"
  | "renamed"
  | "genuine_duplicate"
  | "legitimately_distinct"
  | "data_entry_error"
  | "intentionally_omitted"
  | "pending_omb_correction"
  | "other";

export const RESOLUTION_REASON_LABELS: Record<ResolutionReason, string> = {
  consolidated_upstream: "Consolidated upstream by OMB",
  renamed: "Renamed (same use case, different name)",
  genuine_duplicate: "Genuine OMB-side duplicate",
  legitimately_distinct: "Legitimately distinct (e.g., bureau split)",
  data_entry_error: "Data-entry error",
  intentionally_omitted: "Intentionally omitted",
  pending_omb_correction: "Pending OMB correction",
  other: "Other (see note)",
};

// ─── Detected discrepancy patterns ────────────────────────────────────────
// Auto-detected clusters that explain large chunks of the audit table at
// once. Drives the pattern-cards row at the top of /discrepancies.

export type DiscrepancyPatternKind =
  | "consolidation"
  | "bureau_split"
  | "omb_duplicate_cluster"
  | "name_drift_cluster";

export interface DiscrepancyPattern {
  /** Stable slug, e.g. "ed-copilot-consolidation". Safe to use as React key. */
  id: string;
  kind: DiscrepancyPatternKind;
  agency: string;
  /** Short human-friendly card title. */
  title: string;
  /** One-sentence diagnostic. */
  hypothesis: string;
  /** All audit ids belonging to this pattern. */
  affected_audit_ids: number[];
  /** Up to 3 representative audit ids for the evidence card. */
  sample_audit_ids: number[];
  /** = affected_audit_ids.length. Convenience field. */
  count: number;
  /** Recommended ResolutionReason when the user accepts the pattern. */
  suggested_reason: ResolutionReason;
  /** Pre-built /discrepancies?... link that scopes the table to this pattern. */
  filter_url: string;
}

export interface DiscrepancyDriftField {
  field: string;
  db_value: string | null;
  omb_value: string | null;
}

export interface DiscrepancyDetail {
  audit: DiscrepancyRow;
  drift: DiscrepancyDriftField[];
  /** Side-by-side render values for the 10 canonical fields. Null when the
   * use case has no DB row (i.e., omb_only) or no OMB row (db_only). */
  db_row: Record<string, string | null> | null;
  omb_row: Record<string, string | null> | null;
  /** Triage note from data/discrepancy_resolutions.json, if any. */
  resolution_note: string | null;
  /** Resolution reason from data/discrepancy_resolutions.json, if any. */
  resolution_reason: ResolutionReason | null;
  /** Pointer to the OMB aggregator row when this DB row was rolled into
   *  a generic OMB category. Null otherwise. */
  consolidated_into_omb_id: number | null;
  consolidated_into_omb_name: string | null;
  consolidated_into_omb_bureau: string | null;
  /** Provenance — DB side. May be null if the use_cases table doesn't
   *  carry the column or no DB row was matched. */
  db_source_file: string | null;
  db_source_row: number | null;
  db_ingested_at: string | null;
  /** Provenance — OMB side. Always the consolidated XLSX path; null when
   *  no OMB row was matched (db_only). */
  omb_source_file: string | null;
  omb_source_row: number | null;
  omb_ingested_at: string | null;
}

export interface DiscrepancyFilter {
  status?: DiscrepancyStatus[];
  agency?: string;
  hasDrift?: boolean;
  unresolvedOnly?: boolean;
}

/**
 * Shared TypeScript types for the Federal AI Use Case Inventory dashboard.
 *
 * These mirror the SQLite schema in `../data/federal_ai_inventory_2025.db`.
 * All nullable DB columns are modeled as `T | null` (better-sqlite3 returns
 * `null` for SQL NULL, not `undefined`). Integer boolean flags are typed as
 * `number | null` (0/1) since SQLite has no native boolean type.
 */

// -----------------------------------------------------------------------------
// Core tables
// -----------------------------------------------------------------------------

export interface Agency {
  id: number;
  name: string;
  abbreviation: string;
  agency_type: string | null;
  inventory_page_url: string | null;
  csv_download_url: string | null;
  inventory_year: number | null;
  status: string | null;
  schema_compliance: number | null;
  notes: string | null;
  last_modified: string | null;
  date_accessed: string | null;
}

export interface Product {
  id: number;
  canonical_name: string;
  vendor: string | null;
  product_type: string | null;
  is_generative_ai: number | null;
  is_frontier_llm: number | null;
  parent_product_id: number | null;
  description: string | null;
  notes: string | null;
  product_origin: "commercial" | "agency_internal_platform" | null;
}

export interface ProductAlias {
  id: number;
  product_id: number;
  alias_text: string;
}

export interface UseCaseTemplate {
  id: number;
  template_text: string;
  short_name: string | null;
  capability_category: string | null;
  is_omb_standard: number | null;
  notes: string | null;
}

export interface UseCase {
  id: number;
  agency_id: number;
  source_file: string;
  slug: string | null;

  // Section 1
  use_case_id: string | null;
  use_case_name: string;
  bureau_component: string | null;
  email_address: string | null;
  is_withheld: string | null;
  stage_of_development: string | null;
  is_high_impact: string | null;
  justification: string | null;

  // Section 2
  topic_area: string | null;
  ai_classification: string | null;
  problem_statement: string | null;
  expected_benefits: string | null;
  system_outputs: string | null;
  operational_date: string | null;

  // Section 3
  development_type: string | null;
  vendor_name: string | null;
  has_ato: string | null;
  system_name: string | null;
  training_data_description: string | null;

  // Section 4
  link_to_data: string | null;
  has_pii: string | null;
  pia_url: string | null;
  demographic_features: string | null;
  has_custom_code: string | null;
  code_url: string | null;

  // Section 5
  hi_testing_conducted: string | null;
  hi_assessment_completed: string | null;
  hi_potential_impacts: string | null;
  hi_independent_review: string | null;
  hi_ongoing_monitoring: string | null;
  hi_training_established: string | null;
  hi_failsafe_presence: string | null;
  hi_appeal_process: string | null;
  hi_public_consultation: string | null;

  product_id: number | null;
  template_id: number | null;

  // Hierarchy FKs (populated by scripts/backfill_bureau_orgs.py)
  organization_id: number | null;
  bureau_organization_id: number | null;

  raw_json: string | null;
  created_at: string | null;

  // OMB consolidated provenance (m004; populated by load_omb_consolidated.py).
  // Null when the use case wasn't matched to any OMB row, or when OMB filed
  // an empty Use Case ID column (true for ED, GSA, HHS, SSA, STATE, TVA).
  omb_consolidated_id: string | null;
  omb_consolidated_source: string | null;
  omb_consolidated_first_seen: string | null;
  omb_consolidated_last_seen: string | null;
}

export interface ConsolidatedUseCase {
  id: number;
  agency_id: number;
  source_file: string;
  slug: string | null;

  ai_use_case: string;
  commercial_product: string | null;
  commercial_examples: string | null;
  agency_uses: string | null;
  estimated_licenses_users: string | null;

  product_id: number | null;
  template_id: number | null;

  organization_id: number | null;
  bureau_organization_id: number | null;

  raw_json: string | null;
  created_at: string | null;
}

export interface UseCaseTag {
  id: number;
  use_case_id: number | null;
  consolidated_use_case_id: number | null;

  entry_type: string | null;
  is_product_capability_entry: number | null;
  product_capability: string | null;

  is_general_llm_access: number | null;
  is_coding_tool: number | null;
  is_cots_commercial: number | null;
  tool_product_name: string | null;
  tool_vendor: string | null;

  ai_sophistication: string | null;
  is_generative_ai: number | null;
  is_frontier_model: number | null;

  deployment_scope: string | null;
  scope_detail: string | null;
  is_enterprise_wide: number | null;
  estimated_user_count: string | null;

  architecture_type: string | null;
  has_model_training: number | null;

  cots_product_name: string | null;
  cots_vendor: string | null;
  is_microsoft_copilot: number | null;
  is_openai: number | null;
  is_anthropic: number | null;
  is_google: number | null;
  is_github_copilot: number | null;
  is_aws_ai: number | null;

  use_type: string | null;
  is_public_facing: number | null;

  has_meaningful_risk_docs: number | null;
  high_impact_designation: string | null;
  deployment_environment: string | null;
  has_ato_or_fedramp: number | null;

  created_at: string | null;
}

export interface AgencyMaturity {
  id: number;
  agency_id: number;
  total_use_cases: number | null;
  total_consolidated_entries: number | null;
  distinct_products_deployed: number | null;
  generative_ai_count: number | null;
  coding_tool_count: number | null;
  general_llm_count: number | null;
  classical_ml_count: number | null;
  agentic_ai_count: number | null;
  custom_system_count: number | null;
  has_enterprise_llm: number | null;
  has_coding_assistants: number | null;
  has_agentic_ai: number | null;
  has_custom_ai: number | null;
  pct_deployed: number | null;
  pct_high_impact: number | null;
  pct_with_risk_docs: number | null;
  year_over_year_growth: number | null;
  maturity_tier: string | null;
  notes: string | null;
  updated_at: string | null;
}

// -----------------------------------------------------------------------------
// Joined / aggregate types used by query helpers
// -----------------------------------------------------------------------------

export interface AgencyWithMaturity extends Agency {
  maturity: AgencyMaturity | null;
}

export interface UseCaseWithTags extends UseCase {
  tags: UseCaseTag | null;
  agency_name?: string;
  agency_abbreviation?: string;
  product_name?: string | null;
  template_short_name?: string | null;
}

export type ExternalEvidenceStatus =
  | "corroborated"
  | "searched_no_source"
  | "inventory_only";

export type ExternalEvidenceTopic =
  | "general_llm"
  | "coding"
  | "data_analysis"
  | string;

export interface UseCaseExternalEvidence {
  id: number;
  use_case_id: number | null;
  consolidated_use_case_id: number | null;
  topic: ExternalEvidenceTopic;
  status: ExternalEvidenceStatus;
  source_url: string | null;
  source_quote: string | null;
  confidence: "high" | "medium" | "low" | null;
  search_method: string | null;
  captured_at: string;
  captured_by: string;
  notes: string | null;
}

// -----------------------------------------------------------------------------
// Federal organization hierarchy
// -----------------------------------------------------------------------------

export type OrgLevel =
  | "department"
  | "independent"
  | "sub_agency"
  | "office"
  | "component";

export interface FederalOrganization {
  id: number;
  name: string;
  short_name: string | null;
  abbreviation: string | null;
  slug: string;
  parent_id: number | null;
  level: OrgLevel;
  hierarchy_path: string | null;
  depth: number;
  is_cfo_act_agency: number;
  is_cabinet_department: number;
  is_active: number;
  display_order: number | null;
  description: string | null;
  website: string | null;
  legacy_agency_id: number | null;
}

export interface HierarchyBreadcrumb {
  id: number;
  name: string;
  abbreviation: string | null;
  slug: string;
  level: OrgLevel;
}

export interface OrgWithUseCaseCount extends FederalOrganization {
  use_case_count: number;
  descendant_use_case_count: number;
  child_count: number;
}

export interface ConsolidatedWithTags extends ConsolidatedUseCase {
  tags: UseCaseTag | null;
  agency_name?: string;
  agency_abbreviation?: string;
}

export interface ProductWithCounts extends Product {
  use_case_count: number;
  agency_count: number;
}

export interface ProductDetail extends Product {
  aliases: string[];
  agencies: Array<{ id: number; name: string; abbreviation: string; count: number }>;
  use_case_count: number;
}

export interface ProductCatalogStats {
  canonical_products: number;
  commercial_products: number;
  agency_internal_products: number;
  distinct_vendors: number;
  linked_entry_product_edges: number;
  linked_entries: number;
  pending_product_reviews: number;
}

export interface TemplateWithCounts extends UseCaseTemplate {
  use_case_count: number;
  agency_count: number;
}

export interface TemplateDetail extends UseCaseTemplate {
  agencies: Array<{ id: number; name: string; abbreviation: string; count: number }>;
  products: Array<{ id: number; canonical_name: string; vendor: string | null; count: number }>;
  use_case_count: number;
}

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

/** Discriminated-union row returned by `getUseCasesFiltered`. The explorer
 *  defaults to `kind = "use_case"` only; drill-throughs from product / agency /
 *  template pages set `entryKind: "all"` to see both kinds. Consolidated rows
 *  carry only the fields present in `consolidated_use_cases` (much thinner than
 *  individual rows). Components branching on `kind` should source the title from
 *  `use_case_name` for individual rows and `ai_use_case` for consolidated. */
export type UseCaseRow =
  | ({ kind: "use_case" } & UseCaseWithTags)
  | ({ kind: "consolidated" } & ConsolidatedWithTags);

export interface UseCaseFilterInput {
  /** Which inventory tables to include. Absent or "use_case" → individual only
   *  (default — the explorer's full filter set is built around `use_cases`
   *  columns). "consolidated" → consolidated only. "all" → union. Drill-throughs
   *  from product / agency / template pages should pass "all". */
  entryKind?: "use_case" | "consolidated" | "all";
  agencyId?: number;
  agencyAbbr?: string;
  stage?: string;
  aiClassification?: string;
  isHighImpact?: string;
  productId?: number;
  templateId?: number;
  vendor?: string;
  search?: string;
  entryType?: string;
  deploymentScope?: string;
  aiSophistication?: string;
  isCodingTool?: boolean;
  isGenAI?: boolean;
  limit?: number;
  offset?: number;

  // Multi-value filters (appended by Agent 4 — explorer page).
  // All are OR within the list, AND across different filter fields.
  agencyIds?: number[];
  agencyTypes?: string[]; // CFO_ACT | INDEPENDENT | LEGISLATIVE
  entryTypes?: string[];
  deploymentScopes?: string[];
  aiSophistications?: string[];
  architectureTypes?: string[];
  useTypes?: string[];
  highImpactDesignations?: string[]; // tags.high_impact_designation
  productIds?: number[];
  templateIds?: number[];
  bureaus?: string[];
  maturityTiers?: string[]; // agency_ai_maturity.maturity_tier
  /** OMB-filed topic_area on use_cases (free-text enum: "Science",
   *  "Health & Medical", "Law Enforcement", …). Multiple values = OR.
   *  Exact-match against use_cases.topic_area. Consolidated rows have
   *  no topic_area, so this filter implicitly excludes them. */
  topicAreas?: string[];
  /** IFP-curated `products.product_type` (general_llm, security_tool,
   *  physical_security, etc.). NOT the OMB ai_classification field.
   *  Joins through use_case_products → products. Multiple values = OR. */
  productCategories?: string[];
  // Normalized OMB M-25-21 stage buckets: 'pre_deployment' | 'pilot' |
  // 'deployed' | 'retired' | 'unknown'. Bucketing is done via SQL CASE
  // against LOWER(uc.stage_of_development) because the raw column has 30+
  // formatting variants. Multiple values = OR.
  stageBuckets?: string[];
  isGeneralLLMAccess?: boolean;
  isPublicFacing?: boolean;
  hasATOorFedRAMP?: boolean;
  hasMeaningfulRiskDocs?: boolean;
}

/** Normalized stage-of-development bucket keys. Matches the SQL CASE
 *  statement in `stageBucketSql` in lib/db.ts. */
export type StageBucket =
  | "pre_deployment"
  | "pilot"
  | "deployed"
  | "retired"
  | "unknown";

// -----------------------------------------------------------------------------
// FedRAMP marketplace mirror (loaded from 2025-fedramp/data/fedramp_marketplace.db
// via load_fedramp.py). All `T | null` columns mirror the source schema exactly;
// nothing is invented. Naming convention: `Fedramp` prefix, snake_case fields
// (matching the DB) — same convention as the inventory tables above.
// -----------------------------------------------------------------------------

export interface FedrampProduct {
  fedramp_id: string;
  csp: string;
  csp_slug: string;
  cso: string;
  status: string;
  authorization_count: number | null;
  reuse_count: number | null;
  ready_date: string | null;
  ready_status: string | null;
  ip_jab_date: string | null;
  ip_jab_status: string | null;
  ip_prog_date: string | null;
  ip_prog_status: string | null;
  ip_prog_date2: string | null;
  ip_agency_date: string | null;
  ip_agency_status: string | null;
  ip_pmo_date: string | null;
  ip_pmo_status: string | null;
  auth_date: string | null;
  auth_type: string | null;
  partnering_agency: string | null;
  annual_assessment_date: string | null;
  independent_assessor: string | null;
  assessor_id: number | null;
  deployment_model: string | null;
  impact_level: string | null;
  impact_level_number: number | null;
  service_desc: string | null;
  fedramp_msg: string | null;
  sales_email: string | null;
  security_email: string | null;
  website: string | null;
  uei: string | null;
  small_business: number | null;
  logo: string | null;
  filter_classes: string | null;
  auth_category: string | null;
}

export interface FedrampAuthorization {
  id: number;
  fedramp_id: string;
  agency_id: number | null;
  sub_agency: string | null;
  ato_type: string | null;
  ato_issuance_date: string | null;
  fedramp_authorization_date: string | null;
  ato_expiration_date: string | null;
  annual_assessment_date: string | null;
}

export interface FedrampAgency {
  id: number;
  parent_agency: string;
  parent_slug: string;
}

export interface FedrampAssessor {
  id: number;
  name: string;
  slug: string;
}

export interface FedrampSnapshot {
  snapshot_date: string | null;
  product_count: number;
  ato_event_count: number;
  agency_count: number;
  csp_count: number;
  assessor_count: number;
  built_at: string | null;
}

// -----------------------------------------------------------------------------
// Coverage / cross-reference view-models (consumed by /fedramp/coverage/*)
// -----------------------------------------------------------------------------

/**
 * Coverage state of a single inventory use case relative to FedRAMP. Drives
 * the badge on `/use-cases/[slug]` and the panel on `/fedramp/coverage/`:
 *   - `covered`        — use case has a product that maps to a FedRAMP product
 *                        AND that product has at least one ATO at the using agency.
 *   - `outside_scope`  — use case's product is FedRAMP-listed, but the using
 *                        agency has no ATO for it (or the impact level is too low).
 *   - `no_fedramp`     — use case's product has no FedRAMP listing at all.
 *   - `no_link`        — no inventory product resolved (or no FedRAMP link
 *                        seeded yet) — i.e. unknown.
 */
export type FedrampCoverageState =
  | "covered"
  | "outside_scope"
  | "no_fedramp"
  | "no_link";

/** A single stat shown on the /fedramp/coverage hub. */
export interface CoverageStat {
  key: string;
  label: string;
  value: number;
  /** Optional secondary value, e.g. "of 3,616" — formatted by the consumer. */
  denominator?: number | null;
  /** Free-text description for the card subhead. */
  description?: string | null;
}

/** Panel 1: vendor coverage. Inventory product (with FedRAMP linkage). */
export interface CoverageVendorRow {
  inventory_product_id: number;
  canonical_name: string;
  vendor: string | null;
  use_case_count: number;
  agency_count: number;
  /** 1 iff this product has at least one effective FedRAMP link (direct or
   *  inherited via parent walk — see `fedramp_inherited`). */
  has_fedramp_link: number;
  fedramp_id: string | null;
  fedramp_csp: string | null;
  fedramp_cso: string | null;
  fedramp_impact_level: string | null;
  fedramp_status: string | null;
  fedramp_ato_count: number;
  /** Phase-5: 1 iff the surfaced link came from a parent walk (i.e. the
   *  product itself has no direct fedramp_product_links row). 0 for
   *  direct links. Undefined when no link exists. */
  fedramp_inherited?: number;
}

/**
 * Panel 2: rights/safety × impact-level grid cell. One row per
 * (high_impact_designation × impact_level) combination found in the data.
 */
export interface CoverageFitCell {
  high_impact_designation: string | null;
  fedramp_impact_level: string | null;
  use_case_count: number;
  /** Ratio for the cell heat (0..1). Optional — consumer may compute. */
  share?: number | null;
}

/**
 * Panel 3: agency coverage. One row per inventory agency that has data.
 * Joins through fedramp_agency_links → authorizations → fedramp_products.
 */
export interface CoverageAgencyRow {
  inventory_agency_id: number;
  agency_name: string;
  agency_abbreviation: string;
  use_case_count: number;
  /** Distinct FedRAMP-mapped products this agency *uses* (per its inventory). */
  fedramp_used_count: number;
  /** Distinct FedRAMP products this agency has an ATO for. */
  fedramp_authorized_count: number;
  /** Authorizations the agency has but where the product never shows up
   *  in its inventory — proxy for "sitting on capability you aren't using". */
  authorized_but_unreported: number;
}

/**
 * Per-agency drill (the VA-style story). Three lists of products plus a
 * raw token report for unresolved cases.
 */
export interface CoverageAgencyDrill {
  agency: { id: number; name: string; abbreviation: string };
  authorized_but_unreported: Array<{
    fedramp_id: string;
    csp: string;
    cso: string;
    impact_level: string | null;
    ato_issuance_date: string | null;
  }>;
  mentioned_without_ato: Array<{
    inventory_product_id: number;
    canonical_name: string;
    use_case_count: number;
    fedramp_id: string | null;
    csp: string | null;
    cso: string | null;
  }>;
  /** Inventory product token strings that didn't resolve to any FedRAMP
   *  product — surfaces what's missing from the alias seed. */
  unresolved_tokens: Array<{ token: string; count: number }>;
}

/**
 * One queue row for the curation page + CSV export. `candidates` is the
 * decoded `candidate_fedramp_ids` JSON; consumers decide how to render it.
 */
export interface LinkQueueRow {
  id: number;
  link_kind: "product" | "agency";
  inventory_id: number;
  source_text: string | null;
  reason: string;
  status: string;
  decision_notes: string | null;
  candidates: Array<{
    fedramp_id?: string;
    csp?: string;
    cso?: string;
    parent_agency?: string;
    parent_slug?: string;
    score?: number;
  }>;
  created_at: string | null;
  updated_at: string | null;
  /** Convenience join — the inventory entity's display name (product
   *  canonical_name or agency name). */
  inventory_name: string | null;
  /** Convenience join — vendor / agency_type for grouping. */
  inventory_group: string | null;
}

// ─── OMB consolidated discrepancy types ────────────────────────────────────
// Populated by load_omb_consolidated.py (omb_match_audit table). Read by the
// /discrepancies page. See docs/plans/2026-05-03-omb-consolidated-ingest.md.

export type DiscrepancyStatus =
  | "matched_exact"
  | "matched_fuzzy"
  | "suggested_rename"
  | "omb_only"
  | "db_only"
  | "duplicate_in_omb";

export interface DiscrepancySummary {
  matched_exact: number;
  matched_fuzzy: number;
  suggested_rename: number;
  omb_only: number;
  db_only: number;
  duplicate_in_omb: number;
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
}

export interface DiscrepancyFilter {
  status?: DiscrepancyStatus[];
  agency?: string;
  hasDrift?: boolean;
  unresolvedOnly?: boolean;
}

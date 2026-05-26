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
// Joined / aggregate inventory types used by query helpers
// -----------------------------------------------------------------------------

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
  /** OMB-filed `is_withheld` — multi-select on the canonical values (a/b/c/d).
   *  Multiple values = OR. Use-case arm only. */
  isWithhelds?: string[];
  /** OMB-filed `contracting_usage` (DB: `development_type`) — Purchased /
   *  In-house / Both. Multiple values = OR. Use-case arm only. */
  contractingUsages?: string[];
  /** OMB-filed `has_pii` — when true, restricts to rows where the agency
   *  affirmed PII. Use-case arm only. */
  hasPii?: boolean;
  /** OMB-filed `has_custom_code` — when true, restricts to rows where the
   *  agency reported custom code. Use-case arm only. */
  hasCustomCode?: boolean;
  /** IFP-curated year-over-year lineage status from `use_case_year_links`
   *  (the 2024↔2025 deterministic + LLM-adjudicated matcher). Multiple
   *  values = OR. Use-case arm only — consolidated rows are not in the
   *  lineage table. Valid: continued, new_2025, renamed, split. */
  lineageStatuses?: string[];
  /** Drill-through-only: individual use cases that name neither a vendor nor a
   *  product (the "Vendor unspecified" bucket on the LLM-vendor donut). Applies
   *  the same vendor/product normalization as `LLM_NORMALIZED_FIELDS`. Like
   *  `vendor`, this is a use-case-only filter with no filter-rail control. */
  vendorUnspecified?: boolean;
}

/** Normalized stage-of-development bucket keys. Matches `STAGE_BUCKET_SQL`
 *  in `lib/db/shared/sql-fragments.ts`. */
export type StageBucket =
  | "pre_deployment"
  | "pilot"
  | "deployed"
  | "retired"
  | "unknown";

// -----------------------------------------------------------------------------
// Agency Readiness Scorecard (IFP-facing rubric — see
// scripts/compute_agency_readiness.py and lib/readiness-rubric.ts)
// -----------------------------------------------------------------------------

export type ReadinessTier = "A" | "B" | "C" | "D" | "F";

export interface AgencyReadiness {
  agency_id: number;
  internal_capacity: number;
  frontier_capability: number;
  procurement_hygiene: number;
  risk_relevant_governance: number;
  adoption_breadth: number;
  composite_score: number;
  tier: ReadinessTier;
  tier_label: string;
  rank: number;
  headline_inputs: Record<string, Record<string, number | boolean>>;
  computed_at: string;
}

export interface AgencyReadinessWithName extends AgencyReadiness {
  agency_abbreviation: string;
  agency_name: string;
  agency_slug: string;
}

/**
 * Full comparison payload for a single agency — everything the /compare grid
 * needs, in one round trip.
 */
export interface AgencyCompareData {
  id: number;
  name: string;
  abbreviation: string;
  agency_type: string | null;
  status: string | null;
  maturity_tier: string | null;
  total_use_cases: number;
  distinct_products_deployed: number;
  general_llm_count: number;
  coding_tool_count: number;
  agentic_ai_count: number;
  custom_system_count: number;
  pct_deployed: number | null;
  pct_high_impact: number | null;
  pct_with_risk_docs: number | null;
  year_over_year_growth: number | null;
  has_enterprise_llm: number | null;
  has_coding_assistants: number | null;
  entry_type_mix: {
    custom_system: number;
    product_deployment: number;
    bespoke_application: number;
    generic_use_pattern: number;
    product_feature: number;
    unknown: number;
  };
  ai_sophistication_mix: Array<{ label: string; count: number }>;
  top_products: Array<{
    id: number;
    canonical_name: string;
    vendor: string | null;
    use_case_count: number;
  }>;
}

// -----------------------------------------------------------------------------
// AI Access & Scale — researched public evidence of how widely each agency
// has deployed a general-purpose AI tool. Backs /readiness/access.
// Source table: agency_ai_access_evidence (ETL migration m008).
// -----------------------------------------------------------------------------

/** Availability tier — who CAN use the tool, not who actively does.
 *  `latent`: a Microsoft 365 Copilot Chat entitlement exists (any
 *  M365-licensed user can reach it) but no deliberate agency-wide
 *  rollout is documented. */
export type AgencyAiAccessCoverage =
  | "all"
  | "most"
  | "partial"
  | "pilot"
  | "latent"
  | "unknown"
  | "none";

/** One researched finding: an agency + tool + availability assessment,
 *  backed by a verbatim quote and a source URL (or a recorded gap). */
export interface AgencyAiAccessRow {
  id: number;
  agency_id: number | null;
  agency_abbreviation: string;
  agency_name: string | null;
  tool_name: string | null;
  finding: string;
  estimated_users: string | null;
  coverage_assessment: AgencyAiAccessCoverage | null;
  exact_quote: string | null;
  source_url: string | null;
  source_title: string | null;
  source_date: string | null;
  source_type: string | null;
  confidence: "high" | "medium" | "low" | null;
  status: "corroborated" | "searched_no_source";
  notes: string | null;
  captured_at: string;
}

/** Rollup for the /readiness/access header + the /readiness teaser. */
export interface AiAccessSummary {
  total_agencies: number;
  by_coverage: Record<AgencyAiAccessCoverage, number>;
  corroborated_findings: number;
  searched_no_source: number;
  computed_at: string | null;
}

/** Peer use case row surfaced in the similarity sidebar on the detail page. */
export interface PeerUseCaseRow {
  id: number;
  slug: string | null;
  use_case_name: string;
  agency_id: number;
  agency_abbreviation: string;
  agency_name: string;
  ai_sophistication: string | null;
  deployment_scope: string | null;
  stage_of_development: string | null;
  topic_area: string | null;
  shared_dimensions: number;
}

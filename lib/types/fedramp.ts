/**
 * FedRAMP marketplace and coverage view-model types.
 */

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
 * One use case as surfaced by the expandable coverage drills (vendors row
 * → its use cases, fit cell → its use cases, per-agency drill → use cases
 * per product). `problem_snippet` is the first ≤200 chars of
 * `problem_statement`, used inline on coverage pages.
 */
export interface CoverageUseCaseRow {
  id: number;
  slug: string | null;
  agency_abbreviation: string;
  use_case_name: string;
  stage_of_development: string | null;
  problem_snippet: string | null;
}

/**
 * Same as `CoverageUseCaseRow` but tagged with whether the entry comes
 * from the individual `use_cases` table or the `consolidated_use_cases`
 * batch table. Used by the product detail page's "Who runs it" expand,
 * which surfaces both kinds (some products are reported only via the
 * consolidated batch file). `kind` is needed both for unique React keys
 * across UNIONed result sets and to route slugs correctly — both kinds
 * share `/use-cases/[slug]` so routing is the same, but the field is
 * still useful for downstream callers.
 */
export interface ProductAgencyEntryRow extends CoverageUseCaseRow {
  kind: "use_case" | "consolidated";
  /** `'strong'` = source explicitly named this product. `'inferred'` =
   *  source named only the vendor (e.g. "Microsoft" with no specific
   *  product), so the edge is preserved as a vendor signal but
   *  rendered with a "Vendor-only mention" affordance on the
   *  dashboard. See the 2026-05 generic-vendor-links retag pass. */
  link_confidence: "strong" | "inferred" | null;
}

/**
 * One agency that holds a FedRAMP authorization for a product but reports
 * zero AI use cases naming it. Returned by
 * `getAgenciesWithoutUseForFedrampProduct` for the "FedRAMP → AI" inverse
 * drill on /fedramp/coverage/products.
 */
export interface AgencyAtoRow {
  inventory_agency_id: number;
  agency_name: string;
  agency_abbreviation: string;
  ato_issuance_date: string | null;
  authorization_type: string | null;
}

/**
 * Counts behind the "Sleeping authorizations" hub stat — agencies sitting
 * on a FedRAMP ATO for an AI tool their peers use for AI but they themselves
 * report no AI use of. Drives the headline value (`sleeping_pairs`) plus the
 * secondary "N of M AI-used products" line on the hub card.
 */
export interface SleepingAuthorizationCounts {
  /** Raw count of (agency × product) pairs that are sleeping. */
  sleeping_pairs: number;
  /** Distinct FedRAMP products with at least one sleeping authorizer. */
  products_with_gap: number;
  /**
   * Distinct FedRAMP products that have at least one AI use case anywhere
   * in the inventory (the denominator for "of M AI-used products").
   */
  ai_used_products: number;
}

/**
 * One row of the /fedramp/coverage/sleeping table: a FedRAMP product where
 * at least one agency uses it for an AI use case and at least one other
 * agency holds an ATO for it without reporting any AI use.
 */
export interface SleepingAuthorizationRow {
  fedramp_id: string;
  csp: string;
  cso: string;
  impact_level: string | null;
  /** Distinct inventory agencies that report ≥1 AI use case using this product. */
  lead_user_count: number;
  /** Distinct inventory agencies that hold an ATO but report no AI use case
   *  for this product. The "sleeping" number — the gap. */
  sleeping_count: number;
  /** Total distinct inventory agencies that hold an ATO for this product. */
  total_ato_count: number;
}

/** One use case under a lead-user agency. Slug + name link directly to
 *  `/use-cases/[slug]`; both entry kinds (individual and consolidated)
 *  share that routing. */
export interface LeadUserUseCase {
  kind: "use_case" | "consolidated";
  use_case_id: number;
  slug: string | null;
  use_case_name: string;
  stage_of_development: string | null;
}

/** One lead-user agency for the row-expansion panel. */
export interface LeadUserAgencyRow {
  inventory_agency_id: number;
  agency_name: string;
  agency_abbreviation: string;
  /** Count of AI use cases from this agency referencing the product (or any
   *  child product, via the effective_fedramp_links walk). */
  use_case_count: number;
  /** The actual use cases this agency reports using the product for. */
  use_cases: LeadUserUseCase[];
}

/** One sleeping-authorizer agency for the row-expansion panel. */
export interface SleepingAuthorizerRow {
  inventory_agency_id: number;
  agency_name: string;
  agency_abbreviation: string;
  ato_issuance_date: string | null;
  authorization_type: string | null;
  /** Maturity tier from agency_ai_maturity, when available. */
  maturity_tier: string | null;
  /** Total AI use cases this agency has in its inventory across all products
   *  (sanity context — "are they a heavy AI agency that just hasn't used
   *  this tool, or barely using AI at all"). */
  total_ai_use_cases: number;
}

/** Expansion payload for a sleeping-authorizations row. */
export interface SleepingAuthorizationDetail {
  fedramp_id: string;
  leadUsers: LeadUserAgencyRow[];
  sleepingAuthorizers: SleepingAuthorizerRow[];
}

/** One bar in the "by impact level" chart on /fedramp/coverage/sleeping. */
export interface SleepingByImpactRow {
  impact_level: string;
  sleeping_count: number;
}

/** One bar in the "top sleeping agencies" chart on /fedramp/coverage/sleeping. */
export interface SleepingByAgencyRow {
  inventory_agency_id: number;
  agency_name: string;
  agency_abbreviation: string;
  sleeping_count: number;
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

// -----------------------------------------------------------------------------
// Independent AI classification of FedRAMP products (fedramp_ai_classification,
// produced by the ETL repo's scripts/classify_fedramp_ai.py LLM pass). This is
// orthogonal to fedramp_product_links: a product is "AI by classification" if
// the LLM judged its listing to be an AI/ML offering, regardless of whether it
// links to a curated inventory product ("AI by linkage"). The unlinked-AI gap
// board surfaces products that are AI-by-classification but have NO inventory
// link — FedRAMP-authorized AI tools absent from agency use-case inventories.
// All consumers tolerate the table being absent (stale DB / pre-classification
// build) and degrade to empty.
// -----------------------------------------------------------------------------

/** AI taxonomy tier assigned to a FedRAMP product. */
export type FedrampAiCategory = "core_ai" | "ai_featured" | "not_ai";

/** One row of fedramp_ai_classification. */
export interface FedrampAiClassification {
  fedramp_id: string;
  category: FedrampAiCategory;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  /** Decoded `signals` JSON — verbatim evidence phrases from service_desc. */
  signals: string[];
  model: string;
  classified_at: string;
}

/** One bar in the homepage "AI products by FedRAMP impact level" chart. */
export interface AiByImpactRow {
  impact_level: string;
  count: number;
}

/** Per-category + linkage rollup behind the unlinked-AI hub stat. */
export interface AiClassificationCounts {
  core_ai: number;
  ai_featured: number;
  not_ai: number;
  /** AI products (core_ai|ai_featured) that DO have an inventory link. */
  ai_linked: number;
  /** AI products (core_ai|ai_featured) with NO inventory link — the gap. */
  ai_unlinked: number;
  /** Unlinked AI products whose marketplace status is "FedRAMP Authorized". */
  ai_unlinked_authorized: number;
  /** Unlinked AI products still in the pipeline (Ready / In Process). */
  ai_unlinked_pipeline: number;
}

/* --------------------------------------------------------------------- */
/* Spread board (/fedramp/coverage/spread): does authorization spread     */
/* into multi-agency adoption, or stall at one ATO?                       */
/* --------------------------------------------------------------------- */

/** One authorized core-AI product with its spread signals. */
export interface CoreAiSpreadRow {
  fedramp_id: string;
  csp: string;
  cso: string;
  impact_level: string | null;
  auth_date: string | null;
  /** Distinct FedRAMP agencies holding an authorization for the product. */
  ato_count: number;
  /** Marketplace reuse tally (fedramp_products.reuse_count). */
  reuse_count: number;
  /** 1 if the product links to a curated inventory product. */
  linked_to_inventory: number;
  /** Distinct inventory agencies with a reported use case naming it. */
  reporting_agency_count: number;
}

/** Headline cuts for the spread board. */
export interface SpreadCounts {
  authorized_core_ai: number;
  single_ato: number;
  multi_ato: number;
  /** (agency × product) ATO pairs mappable to an inventory agency. */
  ato_pairs: number;
  /** Of those, pairs where the agency reports a use case with the product. */
  ato_pairs_with_reported_use: number;
}

/**
 * One (core-AI service × host package) pair from the services-in-scope
 * catalog — the "shelf inside the shelf" table on /fedramp/coverage/spread.
 */
export interface AiServiceInScopeRow {
  service: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  /** Label provenance: llm | qc_confirmed | qc_corrected | adjudicated | manual_override. */
  source: string;
  host_fedramp_id: string;
  csp: string;
  cso: string;
  impact_level: string | null;
  recency: string;
  /** Distinct inventory-mapped agencies holding an ATO on the host package. */
  agencies_with_host_ato: number;
}

/** Headline counts for the shelf-inside-the-shelf section and hub card. */
export interface AiServiceShelfCounts {
  /** Distinct core-AI services in scope of ≥1 marketplace package. */
  core_ai_services: number;
  /** Distinct AI-featured services in scope (context stat). */
  ai_featured_services: number;
  /** Distinct packages hosting ≥1 core-AI service. */
  host_packages: number;
  /** Distinct inventory agencies with an ATO on ≥1 core-AI-bearing package. */
  agencies_in_reach: number;
}

/** One in-scope service of a single package, with its AI label if present. */
export interface AiServiceForProductRow {
  service: string;
  recency: string;
  /** null when the per-service classification is absent from this build. */
  category: FedrampAiCategory | null;
  confidence: "high" | "medium" | "low" | null;
  source: string | null;
}

/** One core-AI service in scope of a package a specific agency holds. */
export interface AiServiceInReachRow {
  service: string;
  host_fedramp_id: string;
  cso: string;
  impact_level: string | null;
  /** Latest ATO the agency holds on the host package. */
  ato_issuance_date: string | null;
  /** Label provenance of the service classification. */
  source: string;
}

/** Per-agency frontier-reach rollup for the coverage agencies list. */
export interface FrontierReachAgencyRow {
  inventory_agency_id: number;
  agency_name: string;
  agency_abbreviation: string;
  core_ai_services_in_reach: number;
  host_packages: number;
}

/** Status snapshot for one named frontier product (resolved by cso name). */
export interface FrontierProductStatus {
  fedramp_id: string;
  csp: string;
  cso: string;
  status: string;
  auth_date: string | null;
  impact_level: string | null;
  reuse_count: number;
  /** ATO-holding agencies (often just the FedRAMP PMO for 20x products). */
  ato_holders: UnlinkedAiAtoAgencyRow[];
}

/**
 * One FedRAMP product that is AI-by-classification but has no inventory link:
 * a FedRAMP-authorized AI tool absent from every agency use-case inventory.
 * Sorted by ato_count desc on /fedramp/coverage/unlinked-ai.
 */
export interface UnlinkedAiProductRow {
  fedramp_id: string;
  csp: string;
  cso: string;
  category: FedrampAiCategory;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  signals: string[];
  impact_level: string | null;
  status: string;
  /** Distinct agencies (ATO events) holding an authorization for the product. */
  ato_count: number;
  /** Distinct inventory-mapped agencies holding an ATO (subset of ato_count). */
  agency_count: number;
}

/** One agency that holds an ATO for an unlinked-AI product. Row expansion. */
export interface UnlinkedAiAtoAgencyRow {
  /** Inventory agency id when the FedRAMP agency maps to one, else null. */
  inventory_agency_id: number | null;
  agency_name: string;
  agency_abbreviation: string | null;
  ato_issuance_date: string | null;
  authorization_type: string | null;
}

/**
 * Leaderboard row: an agency and how many unlinked-AI FedRAMP products it
 * holds ATOs for but never reports in its AI inventory.
 */
export interface UnlinkedAiByAgencyRow {
  inventory_agency_id: number;
  agency_name: string;
  agency_abbreviation: string;
  unlinked_ai_ato_count: number;
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

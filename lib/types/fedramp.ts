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

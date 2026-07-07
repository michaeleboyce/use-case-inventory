import { getDb } from "../shared/init";

// -----------------------------------------------------------------------------
// Filter facets (sidebar lists)
// -----------------------------------------------------------------------------

/**
 * Facet counts useful to the filter sidebar (lightweight — just enum lists
 * actually present in the DB so we don't show filters for missing values).
 * Returned as maps keyed by the column we filter on.
 */
export function getUseCaseFacets(): {
  stages: string[];
  aiClassifications: string[];
  highImpact: string[];
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
} {
  const db = getDb();
  const distinct = (table: string, col: string) =>
    db
      .prepare<[], { v: string }>(
        `SELECT DISTINCT ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY v COLLATE NOCASE ASC`,
      )
      .all()
      .map((r) => r.v);

  // Topic-area distinct list, ranked by use-case count rather than name.
  // The OMB filings have a long-tail (30+ values, many one-offs and case
  // variants); count-ranked makes the sidebar facet usable without the
  // long tail crowding the top.
  const topicAreas = db
    .prepare<[], { v: string }>(
      `SELECT topic_area AS v
         FROM use_cases
        WHERE topic_area IS NOT NULL AND topic_area <> ''
        GROUP BY topic_area
       HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC, topic_area COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.v);

  // IFP-curated product_type, ranked by reach (distinct use-cases that
  // reference any product in that category). Excludes 'unclassified' since
  // that's a placeholder, not a real category — the recategorization
  // proposal in audit/product_categorization assigned every product to a
  // concrete bucket.
  const productCategories = db
    .prepare<[], { v: string }>(
      `SELECT p.product_type AS v
         FROM use_case_products ucp
         JOIN products p ON p.id = ucp.product_id
        WHERE p.product_type IS NOT NULL
          AND TRIM(p.product_type) <> ''
          AND LOWER(TRIM(p.product_type)) <> 'unclassified'
        GROUP BY p.product_type
        ORDER BY COUNT(DISTINCT ucp.use_case_id) DESC,
                 p.product_type COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.v);

  // Bureau facet — count-ranked, threshold to suppress the long tail of
  // single-row variants (bureau_component is one of the messiest source
  // columns with parenthetical org codes, pipe-delimited multi-bureau lists,
  // etc. — see scripts/backfill_bureau_orgs.py for the per-agency parsers).
  const bureaus = db
    .prepare<[], { v: string }>(
      `SELECT bureau_component AS v
         FROM use_cases
        WHERE bureau_component IS NOT NULL AND bureau_component <> ''
        GROUP BY bureau_component
       HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC, bureau_component COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.v);

  // Maturity tier — IFP-computed rubric. Small enum.
  const maturityTiers = db
    .prepare<[], { v: string }>(
      `SELECT DISTINCT maturity_tier AS v
         FROM agency_ai_maturity
        WHERE maturity_tier IS NOT NULL AND maturity_tier <> ''
        ORDER BY maturity_tier COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.v);

  // is_withheld / development_type — surface the OMB-canonical values that
  // actually appear in the DB, count-ranked. Filtering matches exact value
  // so the user sees and picks the same string the SQL will compare against.
  const isWithhelds = db
    .prepare<[], { v: string }>(
      `SELECT is_withheld AS v
         FROM use_cases
        WHERE is_withheld IS NOT NULL AND is_withheld <> ''
        GROUP BY is_withheld
       HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC, is_withheld COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.v);

  const contractingUsages = db
    .prepare<[], { v: string }>(
      `SELECT development_type AS v
         FROM use_cases
        WHERE development_type IS NOT NULL AND development_type <> ''
        GROUP BY development_type
       HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC, development_type COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.v);

  // Year-over-year lineage — only statuses that attach to a 2025 use case
  // (i.e. have a non-null uc_2025_id). `retired_2024` rows have no 2025
  // counterpart, so they'd never match a row in the explorer; filter them out
  // of the facet rather than show a 0-result option.
  const lineageStatuses = db
    .prepare<[], { v: string }>(
      `SELECT lineage_status AS v
         FROM use_case_year_links
        WHERE uc_2025_id IS NOT NULL AND lineage_status IS NOT NULL
        GROUP BY lineage_status
        ORDER BY COUNT(*) DESC, lineage_status COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.v);

  return {
    // Normalized enum columns (ETL m016/m019) — the raw source columns
    // carry 40+ formatting variants each and must never drive a facet.
    stages: distinct("use_cases", "stage_normalized"),
    aiClassifications: distinct("use_cases", "ai_classification_normalized"),
    highImpact: distinct("use_cases", "high_impact_normalized"),
    agencyTypes: distinct("agencies", "agency_type"),
    tagEntryTypes: distinct("use_case_tags", "entry_type"),
    tagDeploymentScopes: distinct("use_case_tags", "deployment_scope"),
    tagAISophistications: distinct("use_case_tags", "ai_sophistication"),
    // IFP-adjudicated 2026-07 integration_depth. Distinct labeled values only;
    // the "Not assessed" (NULL) option is appended in the filter UI since NULL
    // is not returned by the DISTINCT scan.
    tagIntegrationDepths: distinct("use_case_tags", "integration_depth"),
    tagArchitectureTypes: distinct("use_case_tags", "architecture_type"),
    tagUseTypes: distinct("use_case_tags", "use_type"),
    tagHighImpactDesignations: distinct("use_case_tags", "high_impact_designation"),
    topicAreas,
    productCategories,
    bureaus,
    maturityTiers,
    isWithhelds,
    contractingUsages,
    lineageStatuses,
  };
}

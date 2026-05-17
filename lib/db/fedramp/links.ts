import { getDb } from "../shared/init";
import { EFFECTIVE_FEDRAMP_LINKS_CTE } from "../shared/sql-fragments";
import type { FedrampCoverageState, FedrampProduct } from "../../types";

// -----------------------------------------------------------------------------
// Cross-reference / coverage
// -----------------------------------------------------------------------------

/**
 * All FedRAMP products linked to a given inventory product. Strong
 * `alias_match` rows + `manual_csv` overrides + `research_w1_w2_w3` rows
 * are surfaced through the same helper so consumers don't have to know
 * about the source distinction.
 *
 * Phase-5 inheritance: when no direct link exists, we walk up
 * `parent_product_id` (cap = 5 hops) and surface the parent's links with
 * `inherited_from_parent_id` set to the ancestor whose row matched. Direct
 * links return `inherited_from_parent_id = null`.
 */
export function getFedrampLinksForInventoryProduct(
  inventoryProductId: number,
): Array<FedrampProduct & {
  confidence: string;
  source: string;
  score: number | null;
  inherited_from_parent_id: number | null;
  inherited_from_parent_name: string | null;
}> {
  return getDb()
    .prepare<
      [number],
      FedrampProduct & {
        confidence: string;
        source: string;
        score: number | null;
        inherited_from_parent_id: number | null;
        inherited_from_parent_name: string | null;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE},
      -- Dedupe to one row per (inventory_product_id, fedramp_id): prefer the
      -- shallowest depth (direct over inherited), then 'manual' confidence,
      -- then highest score. Keeps the React-key invariant on the consumer.
      ranked AS (
        SELECT efl.*,
               ROW_NUMBER() OVER (
                 PARTITION BY efl.inventory_product_id, efl.fedramp_id
                 ORDER BY efl.inherited_depth ASC,
                          CASE efl.confidence
                            WHEN 'manual' THEN 0
                            WHEN 'strong' THEN 1
                            WHEN 'weak'   THEN 2
                            ELSE 3
                          END,
                          efl.score DESC NULLS LAST
               ) AS rn
          FROM effective_fedramp_links efl
      )
      SELECT p.*,
             r.confidence AS confidence,
             r.source AS source,
             r.score AS score,
             r.inherited_from_parent_id AS inherited_from_parent_id,
             parent.canonical_name AS inherited_from_parent_name
        FROM ranked r
        JOIN fedramp_products p ON p.fedramp_id = r.fedramp_id
        LEFT JOIN products parent ON parent.id = r.inherited_from_parent_id
       WHERE r.inventory_product_id = ?
         AND r.rn = 1
       ORDER BY r.inherited_depth ASC, r.confidence DESC, r.score DESC
    `)
    .all(inventoryProductId);
}

/** Reverse direction — every inventory product linked to a single FedRAMP id. */
export function getInventoryProductsForFedrampProduct(
  fedrampId: string,
): Array<{
  id: number;
  canonical_name: string;
  vendor: string | null;
  use_case_count: number;
  agency_count: number;
}> {
  return getDb()
    .prepare<
      [string],
      {
        id: number;
        canonical_name: string;
        vendor: string | null;
        use_case_count: number;
        agency_count: number;
      }
    >(`
      SELECT p.id,
             p.canonical_name,
             p.vendor,
             COALESCE(uc_counts.use_case_count, 0) AS use_case_count,
             COALESCE(uc_counts.agency_count, 0) AS agency_count
        FROM fedramp_product_links l
        JOIN products p ON p.id = l.inventory_product_id
        LEFT JOIN (
          SELECT product_id,
                 COUNT(*) AS use_case_count,
                 COUNT(DISTINCT agency_id) AS agency_count
            FROM entry_product_edges
           GROUP BY product_id
        ) uc_counts ON uc_counts.product_id = p.id
       WHERE l.fedramp_id = ?
       ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
    `)
    .all(fedrampId);
}

/**
 * Multi-valued FedRAMP attributes (one CSO can have many business functions
 * and serve as multiple service models). Returned as Maps keyed by
 * fedramp_id for efficient join in the products listing.
 */
export function getFedrampProductBusinessFunctions(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const rows = getDb()
    .prepare<[], { fedramp_id: string; function: string }>(
      `SELECT fedramp_id, function FROM fedramp_business_functions ORDER BY function COLLATE NOCASE ASC`,
    )
    .all();
  for (const r of rows) {
    const arr = result.get(r.fedramp_id);
    if (arr) arr.push(r.function);
    else result.set(r.fedramp_id, [r.function]);
  }
  return result;
}

export function getFedrampProductServiceModels(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const rows = getDb()
    .prepare<[], { fedramp_id: string; model: string }>(
      `SELECT fedramp_id, model FROM fedramp_service_models ORDER BY model COLLATE NOCASE ASC`,
    )
    .all();
  for (const r of rows) {
    const arr = result.get(r.fedramp_id);
    if (arr) arr.push(r.model);
    else result.set(r.fedramp_id, [r.model]);
  }
  return result;
}

/** Distinct values for facet dropdowns (alphabetized). */
export function getDistinctBusinessFunctions(): string[] {
  return getDb()
    .prepare<[], { function: string }>(
      `SELECT DISTINCT function FROM fedramp_business_functions ORDER BY function COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.function);
}

export function getDistinctServiceModels(): string[] {
  return getDb()
    .prepare<[], { model: string }>(
      `SELECT DISTINCT model FROM fedramp_service_models ORDER BY model COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.model);
}

/**
 * Forward supply-chain edge: the other CSOs this product `leverages` (depends
 * on). The source data's `system_name` is free text and only resolves to a
 * fedramp_id for ~half the rows; unresolved rows render as plain labels.
 * Resolution is case-insensitive against `fedramp_products.cso`.
 */
export function getLeveragedSystemsForFedrampProduct(
  fedrampId: string,
): Array<{
  system_name: string;
  target_fedramp_id: string | null;
  target_csp: string | null;
  target_cso: string | null;
  target_status: string | null;
  target_impact_level: string | null;
}> {
  return getDb()
    .prepare<
      [string],
      {
        system_name: string;
        target_fedramp_id: string | null;
        target_csp: string | null;
        target_cso: string | null;
        target_status: string | null;
        target_impact_level: string | null;
      }
    >(`
      SELECT ls.system_name,
             p.fedramp_id   AS target_fedramp_id,
             p.csp          AS target_csp,
             p.cso          AS target_cso,
             p.status       AS target_status,
             p.impact_level AS target_impact_level
        FROM fedramp_leveraged_systems ls
        LEFT JOIN fedramp_products p
          ON LOWER(p.cso) = LOWER(ls.system_name)
       WHERE ls.fedramp_id = ?
       ORDER BY ls.system_name COLLATE NOCASE ASC
    `)
    .all(fedrampId);
}

/**
 * Reverse supply-chain edge: which other CSOs `leverage` THIS product. Joins
 * back via the same fuzzy `system_name`↔`cso` match used in the forward
 * direction. Empty when the product is a leaf (nothing depends on it).
 */
export function getProductsLeveragedBy(
  fedrampId: string,
): Array<{
  source_fedramp_id: string;
  source_csp: string;
  source_cso: string;
  source_csp_slug: string;
  source_status: string;
  source_impact_level: string | null;
}> {
  return getDb()
    .prepare<
      [string],
      {
        source_fedramp_id: string;
        source_csp: string;
        source_cso: string;
        source_csp_slug: string;
        source_status: string;
        source_impact_level: string | null;
      }
    >(`
      SELECT src.fedramp_id   AS source_fedramp_id,
             src.csp          AS source_csp,
             src.cso          AS source_cso,
             src.csp_slug     AS source_csp_slug,
             src.status       AS source_status,
             src.impact_level AS source_impact_level
        FROM fedramp_products tgt
        JOIN fedramp_leveraged_systems ls
          ON LOWER(ls.system_name) = LOWER(tgt.cso)
        JOIN fedramp_products src
          ON src.fedramp_id = ls.fedramp_id
       WHERE tgt.fedramp_id = ?
       ORDER BY src.csp COLLATE NOCASE ASC, src.cso COLLATE NOCASE ASC
    `)
    .all(fedrampId);
}

/**
 * The full ATO scope for a single inventory agency. Joins inventory agency →
 * fedramp_agency_links → fedramp_authorizations → fedramp_products, and
 * cross-references which of those products the agency *also* mentions in its
 * inventory (via fedramp_product_links → use_cases/consolidated_use_cases).
 */
/**
 * AI-FILTERED: only returns FedRAMP products that have a row in
 * `fedramp_product_links` (i.e., are linked to a curated AI inventory
 * product). The unfiltered view would include the agency's full ATO
 * portfolio — out of scope for this AI-inventory dashboard's cross-reference
 * surfaces. Marketplace explorer helpers are intentionally NOT filtered.
 */
export function getAgencyAtoScope(
  inventoryAgencyId: number,
): Array<{
  fedramp_id: string;
  csp: string;
  cso: string;
  csp_slug: string;
  impact_level: string | null;
  status: string;
  ato_issuance_date: string | null;
  ato_expiration_date: string | null;
  appears_in_inventory: number;
}> {
  return getDb()
    .prepare<
      [number, number],
      {
        fedramp_id: string;
        csp: string;
        cso: string;
        csp_slug: string;
        impact_level: string | null;
        status: string;
        ato_issuance_date: string | null;
        ato_expiration_date: string | null;
        appears_in_inventory: number;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT p.fedramp_id,
             p.csp,
             p.cso,
             p.csp_slug,
             p.impact_level,
             p.status,
             MAX(auth.ato_issuance_date) AS ato_issuance_date,
             MAX(auth.ato_expiration_date) AS ato_expiration_date,
             CASE WHEN EXISTS (
               SELECT 1
                 FROM effective_fedramp_links fpl
                 JOIN entry_product_edges epe
                   ON epe.product_id = fpl.inventory_product_id
                WHERE fpl.fedramp_id = p.fedramp_id
                  AND epe.agency_id = ?
             ) THEN 1 ELSE 0 END AS appears_in_inventory
        FROM fedramp_agency_links al
        JOIN fedramp_authorizations auth ON auth.agency_id = al.fedramp_agency_id
        JOIN fedramp_products p ON p.fedramp_id = auth.fedramp_id
       WHERE al.inventory_agency_id = ?
         AND auth.fedramp_id IN (SELECT fedramp_id FROM effective_fedramp_links)
       GROUP BY p.fedramp_id
       ORDER BY p.impact_level_number DESC, p.csp COLLATE NOCASE ASC, p.cso COLLATE NOCASE ASC
    `)
    .all(inventoryAgencyId, inventoryAgencyId);
}

/**
 * Resolve a single use case's FedRAMP coverage state. Walks
 *   use_case → product (or use_case_products) → fedramp_product_links
 *   → fedramp_authorizations (filtered to the using agency).
 */
export function getUseCaseFedrampCoverage(
  useCaseId: number,
): {
  state: FedrampCoverageState;
  fedramp_products: FedrampProduct[];
  authorized_at_using_agency: boolean;
  /** True when ALL surfaced FedRAMP coverage came via a parent product walk
   *  (i.e. no direct link on the inventory product itself). Drives the
   *  "via parent platform" caveat on /use-cases/[slug]. */
  inherited_via_parent: boolean;
} {
  const db = getDb();
  const useCase = db
    .prepare<[number], { product_id: number | null; agency_id: number }>(
      `SELECT product_id, agency_id FROM use_cases WHERE id = ? LIMIT 1`,
    )
    .get(useCaseId);
  if (!useCase) {
    return {
      state: "no_link",
      fedramp_products: [],
      authorized_at_using_agency: false,
      inherited_via_parent: false,
    };
  }
  // Collect candidate inventory product ids from authoritative product edges.
  const productIds = new Set<number>();
  const extras = db
    .prepare<[number], { product_id: number }>(
      `SELECT product_id
         FROM entry_product_edges
        WHERE entry_kind = 'use_case'
          AND entry_id = ?`,
    )
    .all(useCaseId);
  for (const r of extras) productIds.add(r.product_id);

  if (productIds.size === 0) {
    return {
      state: "no_link",
      fedramp_products: [],
      authorized_at_using_agency: false,
      inherited_via_parent: false,
    };
  }
  const ids = [...productIds];
  const ph = ids.map(() => "?").join(",");
  const fedrampProducts = db
    .prepare<number[], FedrampProduct>(
      `WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
       SELECT DISTINCT p.*
         FROM effective_fedramp_links efl
         JOIN fedramp_products p ON p.fedramp_id = efl.fedramp_id
        WHERE efl.inventory_product_id IN (${ph})`,
    )
    .all(...ids);

  if (fedrampProducts.length === 0) {
    return {
      state: "no_fedramp",
      fedramp_products: [],
      authorized_at_using_agency: false,
      inherited_via_parent: false,
    };
  }

  // Coverage is "inherited" when every (inventory_product_id, fedramp_id) row
  // surfaced for these product ids came from a parent walk — i.e. no direct
  // link exists at any of the candidate inventory products.
  const directRow = db
    .prepare<number[], { c: number }>(
      `SELECT COUNT(*) AS c FROM fedramp_product_links
        WHERE inventory_product_id IN (${ph})`,
    )
    .get(...ids);
  const inheritedViaParent = (directRow?.c ?? 0) === 0;

  // Has the using agency authorized any of these FedRAMP products?
  const authRow = db
    .prepare<[number, ...string[]], { c: number }>(
      `SELECT COUNT(*) AS c
         FROM fedramp_authorizations auth
         JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
        WHERE al.inventory_agency_id = ?
          AND auth.fedramp_id IN (${fedrampProducts.map(() => "?").join(",")})`,
    )
    .get(useCase.agency_id, ...fedrampProducts.map((p) => p.fedramp_id));
  const authorized = (authRow?.c ?? 0) > 0;

  return {
    state: authorized ? "covered" : "outside_scope",
    fedramp_products: fedrampProducts,
    authorized_at_using_agency: authorized,
    inherited_via_parent: inheritedViaParent,
  };
}

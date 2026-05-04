/**
 * FedRAMP queries — reads from the `fedramp_*` mirror tables (loaded by
 * `python load_fedramp.py`) plus the link/queue tables populated by
 * `python link_fedramp.py --apply`.
 *
 * Two halves:
 *   1. Marketplace — replicates the standalone 2025-fedramp dashboard's
 *      shape (products, CSPs, agencies, assessors, authorizations, snapshot).
 *   2. Cross-reference / coverage — joins inventory tables (`use_cases`,
 *      `consolidated_use_cases`, `products`, `agencies`) against the
 *      FedRAMP mirror to drive `/fedramp/coverage/*` and the supply-chain
 *      panel on `/fedramp/marketplace/products/[id]`.
 *
 * Phase 4 of the lib/db.ts split (virtual-sniffing-peacock.md). Functions
 * are moved verbatim — no behavioral changes in this file. lib/db.ts
 * re-exports everything here so existing `import { x } from '@/lib/db'`
 * callers keep working.
 */

import { getDb } from "./shared/init";
import { EFFECTIVE_FEDRAMP_LINKS_CTE } from "./shared/sql-fragments";
import type {
  CoverageAgencyDrill,
  CoverageAgencyRow,
  CoverageFitCell,
  CoverageStat,
  CoverageVendorRow,
  FedrampAgency,
  FedrampAssessor,
  FedrampAuthorization,
  FedrampCoverageState,
  FedrampProduct,
  FedrampSnapshot,
  LinkQueueRow,
} from "../types";

// =============================================================================
// FEDRAMP MARKETPLACE + COVERAGE HELPERS
//
// These read from the FedRAMP mirror tables (fedramp_products,
// fedramp_authorizations, fedramp_agencies, fedramp_assessors,
// fedramp_snapshot) populated by `python load_fedramp.py`, plus the link/queue
// tables (fedramp_product_links, fedramp_agency_links, fedramp_link_queue)
// populated by `python link_fedramp.py --apply`.
//
// Convention: marketplace helpers replicate the shape of the standalone
// 2025-fedramp dashboard; coverage helpers cross-reference the inventory
// (`use_cases`, `consolidated_use_cases`, `products`, `agencies`) with the
// FedRAMP mirror to produce the four panels of /fedramp/coverage/.
//
// Phase-5 inheritance model:
//   `products.parent_product_id` lets a child product inherit its parent's
//   FedRAMP link without duplicating the row. Coverage queries below use
//   `effective_fedramp_links`, a recursive CTE (cap = 5 levels) that walks
//   each product up its parent chain and emits (inventory_product_id,
//   fedramp_id, inherited_from_parent_id) — the latter is NULL for direct
//   links and set to the ancestor whose row was actually matched.
// =============================================================================

/**
 * Recursive-CTE fragment that resolves every `products.id` to its effective
 * set of FedRAMP links: direct links plus any links found by walking up
 * `parent_product_id` (capped at 5 hops to guard against accidental cycles).
 *
 * The CTE emits one row per (inventory_product_id, fedramp_id) pair with
 * `inherited_from_parent_id` set to NULL when the link is direct, or the
 * ancestor product id when it came from the parent walk. Use as:
 *
 *   WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
 *   SELECT ... FROM effective_fedramp_links ...
 */
// EFFECTIVE_FEDRAMP_LINKS_CTE now lives in `lib/db/shared/sql-fragments.ts`.

// -----------------------------------------------------------------------------
// FedRAMP marketplace
// -----------------------------------------------------------------------------

export function getFedrampProducts(): FedrampProduct[] {
  return getDb()
    .prepare<[], FedrampProduct>(
      `SELECT * FROM fedramp_products ORDER BY csp COLLATE NOCASE ASC, cso COLLATE NOCASE ASC`,
    )
    .all();
}

export function getFedrampProductById(
  fedrampId: string,
): FedrampProduct | null {
  return (
    getDb()
      .prepare<[string], FedrampProduct>(
        `SELECT * FROM fedramp_products WHERE fedramp_id = ? LIMIT 1`,
      )
      .get(fedrampId) ?? null
  );
}

export function getFedrampProductsByVendor(csp: string): FedrampProduct[] {
  return getDb()
    .prepare<[string], FedrampProduct>(
      `SELECT * FROM fedramp_products
        WHERE LOWER(csp) = LOWER(?)
        ORDER BY cso COLLATE NOCASE ASC`,
    )
    .all(csp);
}

/** Distinct CSPs with offering counts. */
export function getFedrampCsps(): Array<{
  csp: string;
  csp_slug: string;
  offering_count: number;
  authorized_count: number;
  total_authorizations: number;
  total_reuses: number;
}> {
  return getDb()
    .prepare<
      [],
      {
        csp: string;
        csp_slug: string;
        offering_count: number;
        authorized_count: number;
        total_authorizations: number;
        total_reuses: number;
      }
    >(`
      SELECT csp,
             csp_slug,
             COUNT(*) AS offering_count,
             SUM(CASE WHEN status = 'FedRAMP Authorized' THEN 1 ELSE 0 END) AS authorized_count,
             COALESCE(SUM(authorization_count), 0) AS total_authorizations,
             COALESCE(SUM(reuse_count), 0) AS total_reuses
        FROM fedramp_products
       GROUP BY csp_slug
       ORDER BY total_authorizations DESC, offering_count DESC
    `)
    .all();
}

export function getFedrampCspBySlug(slug: string): {
  csp: string;
  csp_slug: string;
  offering_count: number;
  authorized_count: number;
  total_authorizations: number;
  total_reuses: number;
} | null {
  return (
    getDb()
      .prepare<
        [string],
        {
          csp: string;
          csp_slug: string;
          offering_count: number;
          authorized_count: number;
          total_authorizations: number;
          total_reuses: number;
        }
      >(`
        SELECT MAX(csp) AS csp,
               csp_slug,
               COUNT(*) AS offering_count,
               SUM(CASE WHEN status = 'FedRAMP Authorized' THEN 1 ELSE 0 END) AS authorized_count,
               COALESCE(SUM(authorization_count), 0) AS total_authorizations,
               COALESCE(SUM(reuse_count), 0) AS total_reuses
          FROM fedramp_products
         WHERE csp_slug = ?
         GROUP BY csp_slug
      `)
      .get(slug) ?? null
  );
}

export function getFedrampProductsByCsp(slug: string): FedrampProduct[] {
  return getDb()
    .prepare<[string], FedrampProduct>(
      `SELECT * FROM fedramp_products
        WHERE csp_slug = ?
        ORDER BY cso COLLATE NOCASE ASC`,
    )
    .all(slug);
}

export function getFedrampAgencies(): FedrampAgency[] {
  return getDb()
    .prepare<[], FedrampAgency>(
      `SELECT id, parent_agency, parent_slug
         FROM fedramp_agencies
        ORDER BY parent_agency COLLATE NOCASE ASC`,
    )
    .all();
}

/**
 * Look up a FedRAMP agency by parent_slug. Named `getFedrampAgencyByAbbr`
 * per the plan for symmetry with `getAgencyByAbbr`, but the FedRAMP
 * marketplace uses slugs (not abbreviations) as its primary lookup key
 * — so this accepts the slug.
 */
export function getFedrampAgencyByAbbr(
  parentSlug: string,
): FedrampAgency | null {
  return (
    getDb()
      .prepare<[string], FedrampAgency>(
        `SELECT id, parent_agency, parent_slug
           FROM fedramp_agencies
          WHERE parent_slug = ?
          LIMIT 1`,
      )
      .get(parentSlug) ?? null
  );
}

export function getFedrampAssessors(): FedrampAssessor[] {
  return getDb()
    .prepare<[], FedrampAssessor>(
      `SELECT id, name, slug FROM fedramp_assessors
        ORDER BY name COLLATE NOCASE ASC`,
    )
    .all();
}

export function getFedrampProductsByAssessor(
  assessorId: number,
): FedrampProduct[] {
  return getDb()
    .prepare<[number], FedrampProduct>(
      `SELECT * FROM fedramp_products
        WHERE assessor_id = ?
        ORDER BY csp COLLATE NOCASE ASC, cso COLLATE NOCASE ASC`,
    )
    .all(assessorId);
}

export function getFedrampAuthorizationsForProduct(
  fedrampId: string,
): Array<FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }> {
  return getDb()
    .prepare<
      [string],
      FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }
    >(`
      SELECT auth.*,
             a.parent_agency AS parent_agency,
             a.parent_slug AS parent_slug
        FROM fedramp_authorizations auth
        LEFT JOIN fedramp_agencies a ON a.id = auth.agency_id
       WHERE auth.fedramp_id = ?
       ORDER BY auth.ato_issuance_date DESC
    `)
    .all(fedrampId);
}

/**
 * Batched variant of `getFedrampAuthorizationsForProduct` — single SQL query
 * for many fedramp_ids, avoiding the N+1 in `/products/[id]`. Returns a Map
 * keyed by `fedramp_id`. The per-row shape matches the single-product helper
 * so consumers don't need to remap. Empty input → empty Map (no DB hit).
 */
export function getFedrampAuthorizationsForProducts(
  fedrampIds: string[],
): Map<
  string,
  Array<FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }>
> {
  const result = new Map<
    string,
    Array<FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }>
  >();
  if (fedrampIds.length === 0) return result;
  // Pre-seed every requested id so callers can safely look up missing ids.
  for (const id of fedrampIds) result.set(id, []);
  const placeholders = fedrampIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare<
      string[],
      FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }
    >(`
      SELECT auth.*,
             a.parent_agency AS parent_agency,
             a.parent_slug AS parent_slug
        FROM fedramp_authorizations auth
        LEFT JOIN fedramp_agencies a ON a.id = auth.agency_id
       WHERE auth.fedramp_id IN (${placeholders})
       ORDER BY auth.ato_issuance_date DESC
    `)
    .all(...fedrampIds);
  for (const row of rows) {
    const bucket = result.get(row.fedramp_id);
    if (bucket) bucket.push(row);
    else result.set(row.fedramp_id, [row]);
  }
  return result;
}

export function getFedrampAuthorizationsForAgency(
  agencyId: number,
): Array<FedrampAuthorization & { csp: string; cso: string; csp_slug: string; impact_level: string | null; status: string }> {
  return getDb()
    .prepare<
      [number],
      FedrampAuthorization & {
        csp: string;
        cso: string;
        csp_slug: string;
        impact_level: string | null;
        status: string;
      }
    >(`
      SELECT auth.*,
             p.csp AS csp,
             p.cso AS cso,
             p.csp_slug AS csp_slug,
             p.impact_level AS impact_level,
             p.status AS status
        FROM fedramp_authorizations auth
        JOIN fedramp_products p ON p.fedramp_id = auth.fedramp_id
       WHERE auth.agency_id = ?
       ORDER BY auth.ato_issuance_date DESC
    `)
    .all(agencyId);
}

export function getFedrampSnapshot(): FedrampSnapshot | null {
  return (
    getDb()
      .prepare<[], FedrampSnapshot>(
        `SELECT snapshot_date, product_count, ato_event_count, agency_count,
                csp_count, assessor_count, built_at
           FROM fedramp_snapshot WHERE id = 1`,
      )
      .get() ?? null
  );
}

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

/** Hub stats for /fedramp/coverage. */
export function getCoverageHubStats(): CoverageStat[] {
  const db = getDb();

  const totalInventoryProducts = (
    db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM products`).get() ?? { c: 0 }
  ).c;
  const matchedProducts = (
    db
      .prepare<[], { c: number }>(
        `WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
         SELECT COUNT(DISTINCT inventory_product_id) AS c FROM effective_fedramp_links`,
      )
      .get() ?? { c: 0 }
  ).c;

  // Mismatched: use cases whose product is FedRAMP-listed (directly or via
  // parent walk) but the using agency lacks an ATO for it.
  const mismatched = (
    db
      .prepare<[], { c: number }>(`
        WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
        SELECT COUNT(*) AS c
          FROM entry_product_edges epe
          JOIN effective_fedramp_links fpl ON fpl.inventory_product_id = epe.product_id
         WHERE NOT EXISTS (
           SELECT 1
             FROM fedramp_authorizations auth
             JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
            WHERE auth.fedramp_id = fpl.fedramp_id
              AND al.inventory_agency_id = epe.agency_id
         )
      `)
      .get() ?? { c: 0 }
  ).c;

  // Agencies with at least one mismatched use case.
  const agenciesWithGaps = (
    db
      .prepare<[], { c: number }>(`
        WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
        SELECT COUNT(DISTINCT epe.agency_id) AS c
          FROM entry_product_edges epe
          JOIN effective_fedramp_links fpl ON fpl.inventory_product_id = epe.product_id
         WHERE NOT EXISTS (
           SELECT 1
             FROM fedramp_authorizations auth
             JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
            WHERE auth.fedramp_id = fpl.fedramp_id
              AND al.inventory_agency_id = epe.agency_id
         )
      `)
      .get() ?? { c: 0 }
  ).c;

  // Inventory products that are FedRAMP-mapped but not used in any use case.
  // Phase-5: a product that gets its coverage via a parent walk also counts
  // as "mapped". A child whose parent is FedRAMP-linked is NOT "unused" if
  // any descendant of it is referenced; conversely the unused metric here
  // operates per-row so it still surfaces e.g. the platform parent rows
  // when nothing references them directly. Using effective_fedramp_links so
  // children whose parent is mapped are caught.
  const unusedProducts = (
    db
      .prepare<[], { c: number }>(`
        WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
        SELECT COUNT(DISTINCT fpl.inventory_product_id) AS c
         FROM effective_fedramp_links fpl
         WHERE NOT EXISTS (
           SELECT 1 FROM entry_product_edges epe
            WHERE epe.product_id = fpl.inventory_product_id
         )
      `)
      .get() ?? { c: 0 }
  ).c;

  const snapshot = getFedrampSnapshot();

  return [
    {
      key: "matched",
      label: "Inventory products mapped to FedRAMP",
      value: matchedProducts,
      denominator: totalInventoryProducts,
      description: "Inventory products with at least one FedRAMP authorization link.",
    },
    {
      key: "mismatched",
      label: "Use cases outside agency ATO scope",
      value: mismatched,
      description:
        "Use cases whose product is FedRAMP-listed but where the using agency has no matching ATO.",
    },
    {
      key: "agencies_with_gaps",
      label: "Agencies with FedRAMP gaps",
      value: agenciesWithGaps,
      description: "Agencies with at least one use case outside their own ATO scope.",
    },
    {
      key: "unused_products",
      label: "Mapped products with zero use cases",
      value: unusedProducts,
      description: "Products linked to FedRAMP but not referenced in any agency inventory.",
    },
    {
      key: "snapshot_date",
      label: "FedRAMP snapshot date",
      value: 0,
      description: snapshot?.snapshot_date ?? null,
    },
  ];
}

/** Panel 1 — vendor coverage rows. One per inventory product.
 *  Phase-5: links flow through `effective_fedramp_links` so children with
 *  inherited coverage are NOT shown as "no FedRAMP". `has_fedramp_link`
 *  counts both direct and inherited; `fedramp_inherited` flags inheritance. */
export function getCoverageVendorRows(): CoverageVendorRow[] {
  return getDb()
    .prepare<[], CoverageVendorRow>(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT p.id AS inventory_product_id,
             p.canonical_name,
             p.vendor,
             COALESCE(uc.use_case_count, 0) AS use_case_count,
             COALESCE(uc.agency_count, 0) AS agency_count,
             CASE WHEN fpl.fedramp_id IS NOT NULL THEN 1 ELSE 0 END AS has_fedramp_link,
             fpl.fedramp_id AS fedramp_id,
             fp.csp AS fedramp_csp,
             fp.cso AS fedramp_cso,
             fp.impact_level AS fedramp_impact_level,
             fp.status AS fedramp_status,
             COALESCE(ato.ato_count, 0) AS fedramp_ato_count,
             CASE WHEN fpl.inherited_from_parent_id IS NOT NULL THEN 1 ELSE 0 END
               AS fedramp_inherited
        FROM products p
        LEFT JOIN (
          SELECT product_id,
                 COUNT(*) AS use_case_count,
                 COUNT(DISTINCT agency_id) AS agency_count
            FROM entry_product_edges
           GROUP BY product_id
        ) uc ON uc.product_id = p.id
        LEFT JOIN (
          -- One representative effective link per inventory product. We
          -- prefer the shallowest (depth=0 = direct) and lowest fedramp_id
          -- as a deterministic tiebreaker.
          SELECT inventory_product_id,
                 MIN(fedramp_id) AS fedramp_id,
                 MIN(inherited_from_parent_id) AS inherited_from_parent_id
            FROM effective_fedramp_links
           GROUP BY inventory_product_id
        ) fpl ON fpl.inventory_product_id = p.id
        LEFT JOIN fedramp_products fp ON fp.fedramp_id = fpl.fedramp_id
        LEFT JOIN (
          SELECT fedramp_id, COUNT(*) AS ato_count
            FROM fedramp_authorizations
           GROUP BY fedramp_id
        ) ato ON ato.fedramp_id = fpl.fedramp_id
       ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Panel 2 — rights/safety × impact-level grid. One row per
 * (high_impact_designation, fedramp_impact_level) bucket reachable from
 * inventory use cases that *do* link to a FedRAMP product. Use cases
 * without a FedRAMP link are excluded; they belong on Panel 1's "no
 * FedRAMP" segment.
 */
export function getCoverageFitGrid(): CoverageFitCell[] {
  return getDb()
    .prepare<[], CoverageFitCell>(`
      SELECT t.high_impact_designation AS high_impact_designation,
             fp.impact_level AS fedramp_impact_level,
             COUNT(*) AS use_case_count
        FROM use_cases uc
        JOIN use_case_tags t ON t.use_case_id = uc.id
        JOIN entry_product_edges epe
          ON epe.entry_kind = 'use_case'
         AND epe.entry_id = uc.id
        JOIN fedramp_product_links fpl ON fpl.inventory_product_id = epe.product_id
        JOIN fedramp_products fp ON fp.fedramp_id = fpl.fedramp_id
       GROUP BY t.high_impact_designation, fp.impact_level
       ORDER BY t.high_impact_designation, fp.impact_level
    `)
    .all();
}

/** Panel 3 — agency coverage. */
/**
 * AI-FILTERED: `fedramp_authorized_count` only counts FedRAMP products with
 * a row in `fedramp_product_links` (linked to an AI-inventory product). The
 * unfiltered count would balloon to the agency's full ATO portfolio (e.g.
 * DOJ ~127) and miscompute the unreported gap. Marketplace explorer helpers
 * are intentionally NOT filtered.
 */
export function getCoverageAgencyRows(): CoverageAgencyRow[] {
  return getDb()
    .prepare<[], CoverageAgencyRow>(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT a.id AS inventory_agency_id,
             a.name AS agency_name,
             a.abbreviation AS agency_abbreviation,
             COALESCE(uc.use_case_count, 0) AS use_case_count,
             COALESCE(used.fedramp_used_count, 0) AS fedramp_used_count,
             COALESCE(authd.fedramp_authorized_count, 0) AS fedramp_authorized_count,
             CASE
               WHEN COALESCE(authd.fedramp_authorized_count, 0) >
                    COALESCE(used.fedramp_used_count, 0)
               THEN COALESCE(authd.fedramp_authorized_count, 0)
                  - COALESCE(used.fedramp_used_count, 0)
               ELSE 0
             END AS authorized_but_unreported
        FROM agencies a
        LEFT JOIN (
          SELECT agency_id, COUNT(*) AS use_case_count
            FROM (
              SELECT agency_id FROM use_cases
              UNION ALL
              SELECT agency_id FROM consolidated_use_cases
            )
           GROUP BY agency_id
        ) uc ON uc.agency_id = a.id
        LEFT JOIN (
          SELECT sub.agency_id,
                 COUNT(DISTINCT fpl.fedramp_id) AS fedramp_used_count
            FROM entry_product_edges sub
            JOIN effective_fedramp_links fpl ON fpl.inventory_product_id = sub.product_id
           GROUP BY sub.agency_id
        ) used ON used.agency_id = a.id
        LEFT JOIN (
          SELECT al.inventory_agency_id,
                 COUNT(DISTINCT auth.fedramp_id) AS fedramp_authorized_count
            FROM fedramp_authorizations auth
            JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
           WHERE auth.fedramp_id IN (SELECT fedramp_id FROM effective_fedramp_links)
           GROUP BY al.inventory_agency_id
        ) authd ON authd.inventory_agency_id = a.id
       WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
       ORDER BY use_case_count DESC, a.name COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Per-agency drill — the VA-style story page.
 *
 * AI-FILTERED: the `authorized_but_unreported` subquery only considers
 * FedRAMP products with a row in `fedramp_product_links` (i.e. linked to
 * a curated AI inventory product). Without this filter, the gap balloons
 * to the agency's full ATO portfolio (DOJ shows 127 ATOs, only ~20
 * AI-linked). Marketplace explorer helpers are intentionally NOT filtered.
 */
export function getCoverageAgencyDrill(
  agencyAbbr: string,
): CoverageAgencyDrill | null {
  const db = getDb();
  const agency = db
    .prepare<[string], { id: number; name: string; abbreviation: string }>(
      `SELECT id, name, abbreviation FROM agencies
        WHERE LOWER(abbreviation) = LOWER(?) LIMIT 1`,
    )
    .get(agencyAbbr);
  if (!agency) return null;

  const authorizedButUnreported = db
    .prepare<
      [number, number],
      {
        fedramp_id: string;
        csp: string;
        cso: string;
        impact_level: string | null;
        ato_issuance_date: string | null;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT p.fedramp_id,
             p.csp,
             p.cso,
             p.impact_level,
             MAX(auth.ato_issuance_date) AS ato_issuance_date
        FROM fedramp_agency_links al
        JOIN fedramp_authorizations auth ON auth.agency_id = al.fedramp_agency_id
        JOIN fedramp_products p ON p.fedramp_id = auth.fedramp_id
       WHERE al.inventory_agency_id = ?
         AND auth.fedramp_id IN (SELECT fedramp_id FROM effective_fedramp_links)
         AND NOT EXISTS (
           SELECT 1
             FROM effective_fedramp_links fpl
             JOIN entry_product_edges epe ON epe.product_id = fpl.inventory_product_id
            WHERE fpl.fedramp_id = p.fedramp_id
              AND epe.agency_id = ?
         )
       GROUP BY p.fedramp_id
       ORDER BY p.impact_level_number DESC, p.csp COLLATE NOCASE ASC
    `)
    .all(agency.id, agency.id);

  // Mentioned-without-ATO: use cases at this agency whose product is
  // FedRAMP-listed (directly or via parent walk) but where the agency
  // has no ATO for it.
  const mentionedWithoutAto = db
    .prepare<
      [number, number],
      {
        inventory_product_id: number;
        canonical_name: string;
        use_case_count: number;
        fedramp_id: string | null;
        csp: string | null;
        cso: string | null;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE},
      one_eff_link_per_product AS (
        SELECT inventory_product_id, MIN(fedramp_id) AS fedramp_id
          FROM effective_fedramp_links
         GROUP BY inventory_product_id
      )
      SELECT p.id AS inventory_product_id,
             p.canonical_name,
             COUNT(*) AS use_case_count,
             fpl.fedramp_id AS fedramp_id,
             fp.csp AS csp,
             fp.cso AS cso
        FROM entry_product_edges sub
        JOIN products p ON p.id = sub.product_id
        LEFT JOIN one_eff_link_per_product fpl ON fpl.inventory_product_id = p.id
        LEFT JOIN fedramp_products fp ON fp.fedramp_id = fpl.fedramp_id
       WHERE sub.agency_id = ?
         AND fpl.fedramp_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
             FROM fedramp_authorizations auth
             JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
            WHERE auth.fedramp_id = fpl.fedramp_id
              AND al.inventory_agency_id = ?
         )
       GROUP BY p.id
       ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
    `)
    .all(agency.id, agency.id);

  // Unresolved tokens: surface the most-frequent vendor strings present at
  // this agency that lack a product link entirely. (Cheap proxy: count
  // free-text vendor_name occurrences on use_cases without a product_id.)
  const unresolvedTokens = db
    .prepare<
      [number],
      { token: string; count: number }
    >(`
      SELECT TRIM(LOWER(vendor_name)) AS token, COUNT(*) AS count
        FROM use_cases
       WHERE agency_id = ?
         AND product_id IS NULL
         AND vendor_name IS NOT NULL
         AND TRIM(vendor_name) <> ''
       GROUP BY TRIM(LOWER(vendor_name))
       ORDER BY count DESC
       LIMIT 20
    `)
    .all(agency.id);

  return {
    agency,
    authorized_but_unreported: authorizedButUnreported,
    mentioned_without_ato: mentionedWithoutAto,
    unresolved_tokens: unresolvedTokens,
  };
}

/** Panel 4 — FedRAMP-mapped inventory products with zero inventory mentions. */
export function getCoverageUnusedProducts(): Array<{
  inventory_product_id: number;
  canonical_name: string;
  vendor: string | null;
  fedramp_id: string;
  fedramp_csp: string;
  fedramp_cso: string;
  fedramp_impact_level: string | null;
  fedramp_ato_count: number;
}> {
  return getDb()
    .prepare<
      [],
      {
        inventory_product_id: number;
        canonical_name: string;
        vendor: string | null;
        fedramp_id: string;
        fedramp_csp: string;
        fedramp_cso: string;
        fedramp_impact_level: string | null;
        fedramp_ato_count: number;
      }
    >(`
      WITH RECURSIVE descendant_chain(root_id, descendant_id) AS (
        SELECT id, id FROM products
        UNION ALL
        SELECT dc.root_id, p.id
          FROM descendant_chain dc
          JOIN products p ON p.parent_product_id = dc.descendant_id
      )
      SELECT p.id AS inventory_product_id,
             p.canonical_name,
             p.vendor,
             fp.fedramp_id,
             fp.csp AS fedramp_csp,
             fp.cso AS fedramp_cso,
             fp.impact_level AS fedramp_impact_level,
             COALESCE(ato.c, 0) AS fedramp_ato_count
        FROM fedramp_product_links fpl
        JOIN products p ON p.id = fpl.inventory_product_id
        JOIN fedramp_products fp ON fp.fedramp_id = fpl.fedramp_id
        LEFT JOIN (
          SELECT fedramp_id, COUNT(*) AS c FROM fedramp_authorizations GROUP BY fedramp_id
        ) ato ON ato.fedramp_id = fp.fedramp_id
       -- A product is "unused" only if NO descendant (incl. self) is referenced
       -- from any authoritative product edge.
       WHERE NOT EXISTS (
         SELECT 1 FROM descendant_chain dc
          JOIN entry_product_edges epe ON epe.product_id = dc.descendant_id
         WHERE dc.root_id = p.id
       )
       ORDER BY ato.c DESC NULLS LAST, p.canonical_name COLLATE NOCASE ASC
    `)
    .all();
}

// -----------------------------------------------------------------------------
// Link curation queue
// -----------------------------------------------------------------------------

function _hydrateQueueRow(row: {
  id: number;
  link_kind: "product" | "agency";
  inventory_id: number;
  source_text: string | null;
  candidate_fedramp_ids: string | null;
  reason: string;
  status: string;
  decision_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  inventory_name: string | null;
  inventory_group: string | null;
}): LinkQueueRow {
  let candidates: LinkQueueRow["candidates"] = [];
  if (row.candidate_fedramp_ids) {
    try {
      const parsed = JSON.parse(row.candidate_fedramp_ids);
      if (Array.isArray(parsed)) candidates = parsed;
    } catch {
      // Malformed JSON — leave candidates empty rather than crash.
      candidates = [];
    }
  }
  return {
    id: row.id,
    link_kind: row.link_kind,
    inventory_id: row.inventory_id,
    source_text: row.source_text,
    reason: row.reason,
    status: row.status,
    decision_notes: row.decision_notes,
    candidates,
    created_at: row.created_at,
    updated_at: row.updated_at,
    inventory_name: row.inventory_name,
    inventory_group: row.inventory_group,
  };
}

const LINK_QUEUE_SELECT = `
  SELECT q.id,
         q.link_kind,
         q.inventory_id,
         q.source_text,
         q.candidate_fedramp_ids,
         q.reason,
         q.status,
         q.decision_notes,
         q.created_at,
         q.updated_at,
         CASE q.link_kind
           WHEN 'product' THEN p.canonical_name
           WHEN 'agency'  THEN a.name
         END AS inventory_name,
         CASE q.link_kind
           WHEN 'product' THEN p.vendor
           WHEN 'agency'  THEN a.agency_type
         END AS inventory_group
    FROM fedramp_link_queue q
    LEFT JOIN products p ON q.link_kind = 'product' AND p.id = q.inventory_id
    LEFT JOIN agencies a ON q.link_kind = 'agency'  AND a.id = q.inventory_id
`;

/** Group queue rows by vendor (product) / reason / agency. */
export function getLinkQueueGroups(
  groupBy: "vendor" | "reason" | "agency",
): Array<{ key: string; label: string; count: number }> {
  const db = getDb();
  if (groupBy === "vendor") {
    return db
      .prepare<[], { key: string; label: string; count: number }>(`
        SELECT COALESCE(p.vendor, '(no vendor)') AS key,
               COALESCE(p.vendor, '(no vendor)') AS label,
               COUNT(*) AS count
          FROM fedramp_link_queue q
          LEFT JOIN products p ON p.id = q.inventory_id
         WHERE q.link_kind = 'product' AND q.status = 'pending'
         GROUP BY COALESCE(p.vendor, '(no vendor)')
         ORDER BY count DESC, label COLLATE NOCASE ASC
      `)
      .all();
  }
  if (groupBy === "reason") {
    return db
      .prepare<[], { key: string; label: string; count: number }>(`
        SELECT reason AS key,
               reason AS label,
               COUNT(*) AS count
          FROM fedramp_link_queue
         WHERE status = 'pending'
         GROUP BY reason
         ORDER BY count DESC
      `)
      .all();
  }
  // agency
  return db
    .prepare<[], { key: string; label: string; count: number }>(`
      SELECT COALESCE(a.abbreviation, '(no agency)') AS key,
             COALESCE(a.name, '(no agency)') AS label,
             COUNT(*) AS count
        FROM fedramp_link_queue q
        LEFT JOIN agencies a ON a.id = q.inventory_id
       WHERE q.link_kind = 'agency' AND q.status = 'pending'
       GROUP BY COALESCE(a.abbreviation, '(no agency)')
       ORDER BY count DESC, label COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Queue rows for a single group (used by the curation page and CSV export).
 * `value` is the group key returned by `getLinkQueueGroups`. Pass
 * `filter.group = '*'` and any value to fetch all pending rows.
 */
export function getLinkQueueRows(filter: {
  group: "vendor" | "reason" | "agency" | "*";
  value: string;
}): LinkQueueRow[] {
  const db = getDb();
  type Row = Parameters<typeof _hydrateQueueRow>[0];
  let rows: Row[];
  if (filter.group === "*") {
    rows = db
      .prepare<[], Row>(
        `${LINK_QUEUE_SELECT} WHERE q.status = 'pending' ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all();
  } else if (filter.group === "vendor") {
    rows = db
      .prepare<[string], Row>(
        `${LINK_QUEUE_SELECT}
         WHERE q.link_kind = 'product'
           AND q.status = 'pending'
           AND COALESCE(p.vendor, '(no vendor)') = ?
         ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all(filter.value);
  } else if (filter.group === "reason") {
    rows = db
      .prepare<[string], Row>(
        `${LINK_QUEUE_SELECT}
         WHERE q.status = 'pending' AND q.reason = ?
         ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all(filter.value);
  } else {
    rows = db
      .prepare<[string], Row>(
        `${LINK_QUEUE_SELECT}
         WHERE q.link_kind = 'agency'
           AND q.status = 'pending'
           AND COALESCE(a.abbreviation, '(no agency)') = ?
         ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all(filter.value);
  }
  return rows.map(_hydrateQueueRow);
}


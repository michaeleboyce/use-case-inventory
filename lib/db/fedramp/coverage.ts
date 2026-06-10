import { getDb } from "../shared/init";
import { EFFECTIVE_FEDRAMP_LINKS_CTE } from "../shared/sql-fragments";
import type {
  AgencyAtoRow,
  CoverageAgencyDrill,
  CoverageAgencyRow,
  CoverageFitCell,
  CoverageStat,
  CoverageUseCaseRow,
  CoverageVendorRow,
  LeadUserAgencyRow,
  LeadUserUseCase,
  ProductAgencyEntryRow,
  SleepingAuthorizationCounts,
  SleepingAuthorizationDetail,
  SleepingAuthorizationRow,
  SleepingAuthorizerRow,
  SleepingByAgencyRow,
  SleepingByImpactRow,
} from "../../types";
import { getFedrampSnapshot } from "./marketplace";

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

  // Sleeping authorizations: (agency × product) pairs where the agency has an
  // ATO for a FedRAMP product its peers use for AI, but reports no AI use case
  // using it. Reuses the SLEEPING_CTES building block defined below.
  const sleeping = getSleepingAuthorizationsCounts();

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
      key: "sleeping_authorizations",
      label: "Sleeping authorizations",
      value: sleeping.sleeping_pairs,
      denominator: sleeping.ai_used_products,
      description:
        sleeping.products_with_gap > 0
          ? `Agencies holding an ATO for a FedRAMP product their peers use for AI but reporting no AI use case using it. ${sleeping.products_with_gap} of ${sleeping.ai_used_products} AI-used products have a peer gap.`
          : "Agencies holding an ATO for a FedRAMP product their peers use for AI but reporting no AI use case using it.",
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
 *  counts both direct and inherited; `fedramp_inherited` flags inheritance.
 *
 *  When `agencyId` is set, `use_case_count` / `agency_count` scope to rows
 *  reported by that agency only — letting the page filter by "show me the
 *  AI products DOD names without FedRAMP".
 */
export function getCoverageVendorRows(opts: { agencyId?: number } = {}): CoverageVendorRow[] {
  const { agencyId } = opts;
  if (agencyId == null) {
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
  // Agency-scoped variant: per-product counts limited to this agency's
  // edges. Products with zero rows from this agency are dropped.
  return getDb()
    .prepare<[number], CoverageVendorRow>(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT p.id AS inventory_product_id,
             p.canonical_name,
             p.vendor,
             uc.use_case_count,
             uc.agency_count,
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
        JOIN (
          SELECT product_id,
                 COUNT(*) AS use_case_count,
                 COUNT(DISTINCT agency_id) AS agency_count
            FROM entry_product_edges
           WHERE agency_id = ?
           GROUP BY product_id
        ) uc ON uc.product_id = p.id
        LEFT JOIN (
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
       ORDER BY uc.use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
    `)
    .all(agencyId);
}

/**
 * Panel 2 — rights/safety × impact-level grid. One row per
 * (high_impact_designation, fedramp_impact_level) bucket reachable from
 * inventory use cases that *do* link to a FedRAMP product. Use cases
 * without a FedRAMP link are excluded; they belong on Panel 1's "no
 * FedRAMP" segment.
 */
export function getCoverageFitGrid(opts: { agencyId?: number } = {}): CoverageFitCell[] {
  const { agencyId } = opts;
  const where = agencyId != null ? `WHERE uc.agency_id = ?` : "";
  const stmt = getDb().prepare<unknown[], CoverageFitCell>(`
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
      ${where}
     GROUP BY t.high_impact_designation, fp.impact_level
     ORDER BY t.high_impact_designation, fp.impact_level
  `);
  return agencyId != null ? stmt.all(agencyId) : stmt.all();
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

/** Panel 4 — FedRAMP-mapped inventory products with zero inventory mentions.
 *
 *  When `agencyId` is set, narrows to products that ALSO sit in this
 *  agency's ATO scope. Useful for "show me FedRAMP products DHS is
 *  authorized to use but never reports in its AI inventory."
 */
export function getCoverageUnusedProducts(opts: { agencyId?: number } = {}): Array<{
  inventory_product_id: number;
  canonical_name: string;
  vendor: string | null;
  fedramp_id: string;
  fedramp_csp: string;
  fedramp_cso: string;
  fedramp_impact_level: string | null;
  fedramp_ato_count: number;
}> {
  const { agencyId } = opts;
  const agencyFilter =
    agencyId != null
      ? `AND EXISTS (
           SELECT 1 FROM fedramp_authorizations auth
             JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
            WHERE auth.fedramp_id = fp.fedramp_id
              AND al.inventory_agency_id = ?
         )`
      : "";
  const stmt = getDb().prepare<
    unknown[],
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
     WHERE NOT EXISTS (
       SELECT 1 FROM descendant_chain dc
        JOIN entry_product_edges epe ON epe.product_id = dc.descendant_id
       WHERE dc.root_id = p.id
     )
     ${agencyFilter}
     ORDER BY ato.c DESC NULLS LAST, p.canonical_name COLLATE NOCASE ASC
  `);
  return agencyId != null ? stmt.all(agencyId) : stmt.all();
}

/* --------------------------------------------------------------------- */
/* New drill helpers for the expandable coverage UI.                     */
/* Each returns per-use-case detail (top N, Deployed-first) for a single */
/* product-or-cell, with an optional agency scope.                       */
/* --------------------------------------------------------------------- */

/** Stable sort key: Deployed first, then Pilot, then Pre-deployment,
 *  then Retired. Reads the ETL-computed `stage_normalized` column (m016)
 *  rather than re-deriving from the free-text stage. */
const STAGE_ORDER_SQL = `
  CASE COALESCE(uc.stage_normalized, 'unknown')
    WHEN 'deployed'       THEN 0
    WHEN 'pilot'          THEN 1
    WHEN 'pre_deployment' THEN 2
    WHEN 'retired'        THEN 3
    ELSE 4
  END
`;

/** Top-N use cases referencing a given inventory product. Used by the
 *  vendors-page row expansion and the per-agency drill page. */
export function getUseCasesForCoverageProduct(
  productId: number,
  opts: { agencyId?: number; limit?: number } = {},
): CoverageUseCaseRow[] {
  const { agencyId, limit = 10 } = opts;
  const where = agencyId != null ? "AND uc.agency_id = ?" : "";
  const stmt = getDb().prepare<unknown[], CoverageUseCaseRow>(`
    SELECT uc.id,
           uc.slug,
           a.abbreviation AS agency_abbreviation,
           uc.use_case_name,
           uc.stage_of_development,
           SUBSTR(COALESCE(uc.problem_statement, ''), 1, 200) AS problem_snippet
      FROM use_cases uc
      JOIN agencies a ON a.id = uc.agency_id
      JOIN entry_product_edges epe
        ON epe.entry_kind = 'use_case'
       AND epe.entry_id = uc.id
     WHERE epe.product_id = ?
       ${where}
     ORDER BY ${STAGE_ORDER_SQL}, uc.use_case_name COLLATE NOCASE ASC
     LIMIT ?
  `);
  return agencyId != null
    ? stmt.all(productId, agencyId, limit)
    : stmt.all(productId, limit);
}

/** Distinct agencies that hold an ATO for the given FedRAMP product but
 *  do NOT report a use case for it (directly or via the parent-product
 *  walk that the rest of the dashboard uses). The inverse drill for the
 *  /fedramp/coverage/products "authorized but unused" view. */
export function getAgenciesWithoutUseForFedrampProduct(
  fedrampId: string,
): AgencyAtoRow[] {
  return getDb()
    .prepare<[string, string], AgencyAtoRow>(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT a.id          AS inventory_agency_id,
             a.name        AS agency_name,
             a.abbreviation AS agency_abbreviation,
             MAX(auth.ato_issuance_date) AS ato_issuance_date,
             MIN(auth.ato_type)          AS authorization_type
        FROM fedramp_authorizations auth
        JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
        JOIN agencies a ON a.id = al.inventory_agency_id
       WHERE auth.fedramp_id = ?
         AND NOT EXISTS (
           SELECT 1
             FROM effective_fedramp_links fpl
             JOIN entry_product_edges epe ON epe.product_id = fpl.inventory_product_id
            WHERE fpl.fedramp_id = ?
              AND epe.agency_id = a.id
         )
       GROUP BY a.id
       ORDER BY a.name COLLATE NOCASE ASC
    `)
    .all(fedrampId, fedrampId);
}

/* --------------------------------------------------------------------- */
/* "Sleeping authorizations" — the FedRAMP → AI gap at the product level. */
/* For each FedRAMP product where at least one inventory agency reports an */
/* AI use case using it, surface other agencies that hold an ATO for the   */
/* same product but report no AI use case using it. Backs the new hub     */
/* card + /fedramp/coverage/sleeping drill-down.                          */
/* --------------------------------------------------------------------- */

/** SQL building block: the four CTEs that scope the "sleeping" gap to
 *  AI-used FedRAMP products. Reused across the three query helpers below
 *  so one definition stays canonical. */
const SLEEPING_CTES = `
  ${EFFECTIVE_FEDRAMP_LINKS_CTE},
  ai_used AS (
    SELECT DISTINCT fpl.fedramp_id
      FROM effective_fedramp_links fpl
      JOIN entry_product_edges epe ON epe.product_id = fpl.inventory_product_id
  ),
  authorized_pairs AS (
    SELECT DISTINCT auth.fedramp_id, fal.inventory_agency_id
      FROM fedramp_authorizations auth
      JOIN fedramp_agency_links fal ON fal.fedramp_agency_id = auth.agency_id
     WHERE auth.fedramp_id IN (SELECT fedramp_id FROM ai_used)
  ),
  using_pairs AS (
    SELECT DISTINCT fpl.fedramp_id, epe.agency_id AS inventory_agency_id
      FROM effective_fedramp_links fpl
      JOIN entry_product_edges epe ON epe.product_id = fpl.inventory_product_id
     WHERE fpl.fedramp_id IN (SELECT fedramp_id FROM ai_used)
  ),
  sleeping_pairs AS (
    SELECT a.fedramp_id, a.inventory_agency_id
      FROM authorized_pairs a
     WHERE NOT EXISTS (
       SELECT 1 FROM using_pairs u
        WHERE u.fedramp_id = a.fedramp_id
          AND u.inventory_agency_id = a.inventory_agency_id
     )
  )
`;

/** Counts behind the "Sleeping authorizations" hub stat card. */
export function getSleepingAuthorizationsCounts(): SleepingAuthorizationCounts {
  return (
    getDb()
      .prepare<[], SleepingAuthorizationCounts>(`
        WITH RECURSIVE ${SLEEPING_CTES}
        SELECT
          (SELECT COUNT(*) FROM sleeping_pairs) AS sleeping_pairs,
          (SELECT COUNT(DISTINCT fedramp_id) FROM sleeping_pairs) AS products_with_gap,
          (SELECT COUNT(*) FROM ai_used) AS ai_used_products
      `)
      .get() ?? { sleeping_pairs: 0, products_with_gap: 0, ai_used_products: 0 }
  );
}

/** One row per FedRAMP product with at least one sleeping authorizer.
 *  Sorted by gap size descending so the biggest peer-adoption gaps surface
 *  first. */
export function getSleepingAuthorizationRows(): SleepingAuthorizationRow[] {
  return getDb()
    .prepare<[], SleepingAuthorizationRow>(`
      WITH RECURSIVE ${SLEEPING_CTES}
      SELECT
        fp.fedramp_id,
        fp.csp,
        fp.cso,
        fp.impact_level,
        (SELECT COUNT(DISTINCT inventory_agency_id)
           FROM using_pairs WHERE fedramp_id = fp.fedramp_id) AS lead_user_count,
        (SELECT COUNT(*)
           FROM sleeping_pairs WHERE fedramp_id = fp.fedramp_id) AS sleeping_count,
        (SELECT COUNT(DISTINCT inventory_agency_id)
           FROM authorized_pairs WHERE fedramp_id = fp.fedramp_id) AS total_ato_count
      FROM fedramp_products fp
      WHERE fp.fedramp_id IN (SELECT fedramp_id FROM ai_used)
        AND EXISTS (SELECT 1 FROM sleeping_pairs WHERE fedramp_id = fp.fedramp_id)
      ORDER BY sleeping_count DESC, total_ato_count DESC, fp.csp COLLATE NOCASE ASC
    `)
    .all();
}

/** Row-expansion payload for the sleeping table: lead users (left column)
 *  + sleeping authorizers (right column). */
export function getSleepingAuthorizationDetail(
  fedrampId: string,
): SleepingAuthorizationDetail {
  const db = getDb();

  // Per-agency aggregate (count + identity).
  const leadUserAgencies = db
    .prepare<
      [string],
      {
        inventory_agency_id: number;
        agency_name: string;
        agency_abbreviation: string;
        use_case_count: number;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT
        a.id AS inventory_agency_id,
        a.name AS agency_name,
        a.abbreviation AS agency_abbreviation,
        COUNT(*) AS use_case_count
      FROM effective_fedramp_links fpl
      JOIN entry_product_edges epe ON epe.product_id = fpl.inventory_product_id
      JOIN agencies a ON a.id = epe.agency_id
      WHERE fpl.fedramp_id = ?
      GROUP BY a.id
      ORDER BY use_case_count DESC, a.name COLLATE NOCASE ASC
    `)
    .all(fedrampId);

  // Per-use-case rows; merged below into each lead user's `use_cases` array.
  // Unions across individual and consolidated entries (both routed via the
  // shared /use-cases/[slug] page).
  const useCaseRows = db
    .prepare<
      [string],
      {
        inventory_agency_id: number;
        kind: "use_case" | "consolidated";
        use_case_id: number;
        slug: string | null;
        use_case_name: string;
        stage_of_development: string | null;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT
        epe.agency_id AS inventory_agency_id,
        epe.entry_kind AS kind,
        epe.entry_id AS use_case_id,
        CASE WHEN epe.entry_kind = 'use_case' THEN uc.slug ELSE cuc.slug END AS slug,
        CASE WHEN epe.entry_kind = 'use_case' THEN uc.use_case_name ELSE cuc.ai_use_case END AS use_case_name,
        CASE WHEN epe.entry_kind = 'use_case' THEN uc.stage_of_development ELSE NULL END AS stage_of_development
      FROM effective_fedramp_links fpl
      JOIN entry_product_edges epe ON epe.product_id = fpl.inventory_product_id
      LEFT JOIN use_cases uc ON epe.entry_kind = 'use_case' AND uc.id = epe.entry_id
      LEFT JOIN consolidated_use_cases cuc ON epe.entry_kind = 'consolidated' AND cuc.id = epe.entry_id
      WHERE fpl.fedramp_id = ?
      ORDER BY use_case_name COLLATE NOCASE ASC
    `)
    .all(fedrampId);

  const useCasesByAgency = new Map<number, LeadUserUseCase[]>();
  for (const r of useCaseRows) {
    const list = useCasesByAgency.get(r.inventory_agency_id) ?? [];
    list.push({
      kind: r.kind,
      use_case_id: r.use_case_id,
      slug: r.slug,
      use_case_name: r.use_case_name,
      stage_of_development: r.stage_of_development,
    });
    useCasesByAgency.set(r.inventory_agency_id, list);
  }

  const leadUsers: LeadUserAgencyRow[] = leadUserAgencies.map((a) => ({
    ...a,
    use_cases: useCasesByAgency.get(a.inventory_agency_id) ?? [],
  }));

  const sleepingAuthorizers = db
    .prepare<[string, string], SleepingAuthorizerRow>(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT
        a.id AS inventory_agency_id,
        a.name AS agency_name,
        a.abbreviation AS agency_abbreviation,
        MAX(auth.ato_issuance_date) AS ato_issuance_date,
        MIN(auth.ato_type) AS authorization_type,
        am.maturity_tier AS maturity_tier,
        (SELECT COUNT(*) FROM use_cases uc WHERE uc.agency_id = a.id) AS total_ai_use_cases
      FROM fedramp_authorizations auth
      JOIN fedramp_agency_links fal ON fal.fedramp_agency_id = auth.agency_id
      JOIN agencies a ON a.id = fal.inventory_agency_id
      LEFT JOIN agency_ai_maturity am ON am.agency_id = a.id
      WHERE auth.fedramp_id = ?
        AND NOT EXISTS (
          SELECT 1
            FROM effective_fedramp_links fpl
            JOIN entry_product_edges epe ON epe.product_id = fpl.inventory_product_id
           WHERE fpl.fedramp_id = ?
             AND epe.agency_id = a.id
        )
      GROUP BY a.id
      ORDER BY a.name COLLATE NOCASE ASC
    `)
    .all(fedrampId, fedrampId);

  return { fedramp_id: fedrampId, leadUsers, sleepingAuthorizers };
}

/** Sleeping (agency × product) pair counts grouped by FedRAMP impact level.
 *  Drives the "by impact" chart on /fedramp/coverage/sleeping. */
export function getSleepingByImpactLevel(): SleepingByImpactRow[] {
  return getDb()
    .prepare<[], SleepingByImpactRow>(`
      WITH RECURSIVE ${SLEEPING_CTES}
      SELECT
        COALESCE(fp.impact_level, 'Unknown') AS impact_level,
        COUNT(*) AS sleeping_count
      FROM sleeping_pairs sp
      JOIN fedramp_products fp ON fp.fedramp_id = sp.fedramp_id
      GROUP BY COALESCE(fp.impact_level, 'Unknown')
      ORDER BY
        CASE COALESCE(fp.impact_level, '')
          WHEN 'High' THEN 0
          WHEN 'Moderate' THEN 1
          WHEN 'Li-SaaS' THEN 2
          WHEN 'Low' THEN 3
          ELSE 4
        END
    `)
    .all();
}

/** Top sleeping-agencies leaderboard — agencies sitting on the most ATOs
 *  for AI products their peers are using. Drives the second chart. */
export function getTopSleepingAgencies(limit = 15): SleepingByAgencyRow[] {
  return getDb()
    .prepare<[number], SleepingByAgencyRow>(`
      WITH RECURSIVE ${SLEEPING_CTES}
      SELECT
        a.id AS inventory_agency_id,
        a.name AS agency_name,
        a.abbreviation AS agency_abbreviation,
        COUNT(*) AS sleeping_count
      FROM sleeping_pairs sp
      JOIN agencies a ON a.id = sp.inventory_agency_id
      GROUP BY a.id
      ORDER BY sleeping_count DESC, a.name COLLATE NOCASE ASC
      LIMIT ?
    `)
    .all(limit);
}

/** Top-N use cases sitting in a (high_impact_designation, impact_level)
 *  fit-grid cell, optionally agency-scoped. Used by the fit page when a
 *  user wants to inspect "which use cases live in the rights-impacting ×
 *  Low impact-level misfit bucket." */
export function getUseCasesForFitCell(
  highImpactDesignation: string | null,
  fedrampImpactLevel: string | null,
  opts: { agencyId?: number; limit?: number } = {},
): CoverageUseCaseRow[] {
  const { agencyId, limit = 10 } = opts;
  const designationClause =
    highImpactDesignation == null
      ? "t.high_impact_designation IS NULL"
      : "t.high_impact_designation = ?";
  const impactClause =
    fedrampImpactLevel == null
      ? "fp.impact_level IS NULL"
      : "fp.impact_level = ?";
  const agencyClause = agencyId != null ? "AND uc.agency_id = ?" : "";
  const params: unknown[] = [];
  if (highImpactDesignation != null) params.push(highImpactDesignation);
  if (fedrampImpactLevel != null) params.push(fedrampImpactLevel);
  if (agencyId != null) params.push(agencyId);
  params.push(limit);
  const stmt = getDb().prepare<unknown[], CoverageUseCaseRow>(`
    SELECT uc.id,
           uc.slug,
           a.abbreviation AS agency_abbreviation,
           uc.use_case_name,
           uc.stage_of_development,
           SUBSTR(COALESCE(uc.problem_statement, ''), 1, 200) AS problem_snippet
      FROM use_cases uc
      JOIN agencies a ON a.id = uc.agency_id
      JOIN use_case_tags t ON t.use_case_id = uc.id
      JOIN entry_product_edges epe
        ON epe.entry_kind = 'use_case'
       AND epe.entry_id = uc.id
      JOIN fedramp_product_links fpl ON fpl.inventory_product_id = epe.product_id
      JOIN fedramp_products fp ON fp.fedramp_id = fpl.fedramp_id
     WHERE ${designationClause}
       AND ${impactClause}
       ${agencyClause}
     ORDER BY ${STAGE_ORDER_SQL}, uc.use_case_name COLLATE NOCASE ASC
     LIMIT ?
  `);
  return stmt.all(...params);
}

/** Top-N entries at a specific agency that reference a specific product.
 *  UNIONs the two entry tables (individual `use_cases` and the
 *  `consolidated_use_cases` batch file) so that products reported only
 *  through the consolidated channel — which is the case for many
 *  large vendor products — still surface their backing entries in the
 *  expand panels on /products/[id] and /fedramp/coverage/agencies/[abbr].
 *
 *  `stage_of_development` and `problem_snippet` are null on consolidated
 *  rows (the consolidated schema doesn't record either). Deployed-first
 *  ordering still works because the CASE expression falls through to the
 *  "ELSE 4" bucket for null stages — those sort after all named stages
 *  but together as a stable group. */
export function getUseCasesForCoverageAgencyProduct(
  agencyId: number,
  productId: number,
  opts: { limit?: number } = {},
): ProductAgencyEntryRow[] {
  const { limit = 10 } = opts;
  return getDb()
    .prepare<[number, number, number, number, number], ProductAgencyEntryRow>(`
      WITH src AS (
        SELECT 'use_case' AS kind,
               uc.id AS id,
               uc.slug AS slug,
               uc.use_case_name AS use_case_name,
               uc.stage_of_development AS stage_of_development,
               SUBSTR(COALESCE(uc.problem_statement, ''), 1, 200) AS problem_snippet,
               uc.agency_id AS agency_id,
               epe.product_id AS product_id,
               epe.confidence AS link_confidence
          FROM use_cases uc
          JOIN entry_product_edges epe
            ON epe.entry_kind = 'use_case'
           AND epe.entry_id = uc.id
         WHERE epe.product_id = ?
           AND uc.agency_id = ?
        UNION ALL
        SELECT 'consolidated' AS kind,
               cuc.id AS id,
               cuc.slug AS slug,
               cuc.ai_use_case AS use_case_name,
               NULL AS stage_of_development,
               NULL AS problem_snippet,
               cuc.agency_id AS agency_id,
               epe.product_id AS product_id,
               epe.confidence AS link_confidence
          FROM consolidated_use_cases cuc
          JOIN entry_product_edges epe
            ON epe.entry_kind = 'consolidated'
           AND epe.entry_id = cuc.id
         WHERE epe.product_id = ?
           AND cuc.agency_id = ?
      )
      SELECT s.kind,
             s.id,
             s.slug,
             a.abbreviation AS agency_abbreviation,
             s.use_case_name,
             s.stage_of_development,
             s.problem_snippet,
             s.link_confidence
        FROM src s
        JOIN agencies a ON a.id = s.agency_id
       ORDER BY
         CASE
           WHEN s.stage_of_development LIKE '%Deployed%' THEN 0
           WHEN s.stage_of_development LIKE '%Pilot%'    THEN 1
           WHEN s.stage_of_development LIKE '%Pre-deployment%' OR s.stage_of_development LIKE '%pre-deployment%' THEN 2
           WHEN s.stage_of_development LIKE '%Retired%'  THEN 3
           ELSE 4
         END,
         s.use_case_name COLLATE NOCASE ASC
       LIMIT ?
    `)
    .all(productId, agencyId, productId, agencyId, limit);
}

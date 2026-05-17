import { getDb } from "../shared/init";
import { EFFECTIVE_FEDRAMP_LINKS_CTE } from "../shared/sql-fragments";
import type { CoverageAgencyDrill, CoverageAgencyRow, CoverageFitCell, CoverageStat, CoverageVendorRow } from "../../types";
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

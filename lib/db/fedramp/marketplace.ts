import { getDb } from "../shared/init";
import type { FedrampAgency, FedrampAssessor, FedrampAuthorization, FedrampProduct, FedrampSnapshot } from "../../types";

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

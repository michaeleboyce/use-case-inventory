/**
 * Hierarchy query layer for the federal_organizations table.
 *
 * Pattern adapted from federal-ai-platform/frontend/lib/hierarchy-db.ts —
 * same materialized-path approach, ported from Drizzle/Postgres to
 * better-sqlite3.
 *
 * The materialized path lets us answer "all descendants of CDC" with a single
 * indexed LIKE query instead of recursive CTEs:
 *     hierarchy_path LIKE '/<HHS_id>/<CDC_id>/%'
 *
 * Returns plain objects from sqlite — null is preserved as JS null.
 */

import { rawDb } from "./db";
import type {
  FederalOrganization,
  HierarchyBreadcrumb,
  OrgLevel,
  OrgWithUseCaseCount,
} from "./types";

// ---------------------------------------------------------------------------
// SELECT projections
// ---------------------------------------------------------------------------

const ORG_SELECT = `
  SELECT id, name, short_name, abbreviation, slug, parent_id, level,
         hierarchy_path, depth, is_cfo_act_agency, is_cabinet_department,
         is_active, display_order, description, website, legacy_agency_id
    FROM federal_organizations
`;

// ---------------------------------------------------------------------------
// Basic lookups
// ---------------------------------------------------------------------------

export function getOrganizationById(id: number): FederalOrganization | null {
  const stmt = rawDb().prepare<[number], FederalOrganization>(
    `${ORG_SELECT} WHERE id = ? LIMIT 1`,
  );
  return stmt.get(id) ?? null;
}

export function getOrganizationBySlug(slug: string): FederalOrganization | null {
  const stmt = rawDb().prepare<[string], FederalOrganization>(
    `${ORG_SELECT} WHERE slug = ? LIMIT 1`,
  );
  return stmt.get(slug) ?? null;
}

/**
 * Resolve a URL segment to an organization. Accepts either a slug
 * ("hhs", "hhs-cdc") or a legacy agency abbreviation ("HHS", "DHS"). The
 * abbreviation lookup is case-insensitive and only matches top-level orgs
 * (departments + independents) — sub-agency abbreviations like "CDC" without
 * a parent prefix are deliberately ambiguous and resolve via slug only.
 */
export function getOrganizationBySlugOrAbbr(
  segment: string,
): FederalOrganization | null {
  const direct = getOrganizationBySlug(segment.toLowerCase());
  if (direct) return direct;
  const stmt = rawDb().prepare<[string], FederalOrganization>(
    `${ORG_SELECT}
     WHERE parent_id IS NULL
       AND UPPER(abbreviation) = UPPER(?)
     LIMIT 1`,
  );
  return stmt.get(segment) ?? null;
}

export function getOrganizationByAbbreviation(
  abbreviation: string,
): FederalOrganization | null {
  const stmt = rawDb().prepare<[string], FederalOrganization>(
    `${ORG_SELECT}
     WHERE UPPER(abbreviation) = UPPER(?)
     ORDER BY depth ASC LIMIT 1`,
  );
  return stmt.get(abbreviation) ?? null;
}

/** Look up the org corresponding to a legacy `agencies.id`. */
export function getOrganizationForAgencyId(
  agencyId: number,
): FederalOrganization | null {
  const stmt = rawDb().prepare<[number], FederalOrganization>(
    `${ORG_SELECT} WHERE legacy_agency_id = ? AND parent_id IS NULL LIMIT 1`,
  );
  return stmt.get(agencyId) ?? null;
}

// ---------------------------------------------------------------------------
// Tree traversal
// ---------------------------------------------------------------------------

export function getTopLevelOrganizations(): FederalOrganization[] {
  return rawDb()
    .prepare<[], FederalOrganization>(
      `${ORG_SELECT}
       WHERE parent_id IS NULL
       ORDER BY is_cabinet_department DESC, display_order ASC, name COLLATE NOCASE ASC`,
    )
    .all();
}

export function getChildren(parentId: number): FederalOrganization[] {
  return rawDb()
    .prepare<[number], FederalOrganization>(
      `${ORG_SELECT}
       WHERE parent_id = ?
       ORDER BY level ASC, name COLLATE NOCASE ASC`,
    )
    .all(parentId);
}

/**
 * All descendants of an org via materialized-path LIKE. Excludes the org
 * itself. Sorted by depth then name for predictable rendering.
 */
export function getDescendants(id: number): FederalOrganization[] {
  const org = getOrganizationById(id);
  if (!org || !org.hierarchy_path) return [];
  return rawDb()
    .prepare<[string, number], FederalOrganization>(
      `${ORG_SELECT}
       WHERE hierarchy_path LIKE ? || '%'
         AND id != ?
       ORDER BY depth ASC, name COLLATE NOCASE ASC`,
    )
    .all(org.hierarchy_path, id);
}

/** Includes the org plus all descendants, useful for "filter to this subtree". */
export function getOrgAndDescendantIds(id: number): number[] {
  const org = getOrganizationById(id);
  if (!org || !org.hierarchy_path) return [id];
  return rawDb()
    .prepare<[string], { id: number }>(
      `SELECT id FROM federal_organizations WHERE hierarchy_path LIKE ? || '%'`,
    )
    .all(org.hierarchy_path)
    .map((r) => r.id);
}

/** Ancestor chain (root → org's parent), parsed from hierarchy_path. */
export function getAncestors(id: number): FederalOrganization[] {
  const org = getOrganizationById(id);
  if (!org || !org.hierarchy_path) return [];
  const ids = org.hierarchy_path
    .split("/")
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n !== id);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  return rawDb()
    .prepare<number[], FederalOrganization>(
      `${ORG_SELECT}
       WHERE id IN (${placeholders})
       ORDER BY depth ASC`,
    )
    .all(...ids);
}

/** Breadcrumb chain — ancestors plus the org itself, in display order. */
export function getOrganizationBreadcrumbs(id: number): HierarchyBreadcrumb[] {
  const ancestors = getAncestors(id);
  const org = getOrganizationById(id);
  if (!org) return [];
  return [...ancestors, org].map((o) => ({
    id: o.id,
    name: o.name,
    abbreviation: o.abbreviation,
    slug: o.slug,
    level: o.level as OrgLevel,
  }));
}

// ---------------------------------------------------------------------------
// Hierarchy-aware aggregates (use cases + maturity)
// ---------------------------------------------------------------------------

/**
 * Children of an org, each with its own use-case count plus an inclusive
 * descendant rollup. Used for the "Sub-agencies" rollup section on agency
 * detail pages.
 */
export function getChildOrgRollups(parentId: number): OrgWithUseCaseCount[] {
  const stmt = rawDb().prepare<[number], OrgWithUseCaseCount>(
    `
    WITH children AS (
      ${ORG_SELECT.replace(/^\s+SELECT/, "SELECT")}
      WHERE parent_id = ?
    )
    SELECT c.*,
	           (
	             SELECT COUNT(*)
	               FROM use_cases u
	              WHERE COALESCE(u.bureau_organization_id, u.organization_id) = c.id
	           ) AS use_case_count,
	           (
	             SELECT COUNT(*)
	               FROM use_cases u
	               JOIN federal_organizations fo
	                 ON fo.id = COALESCE(u.bureau_organization_id, u.organization_id)
	              WHERE fo.hierarchy_path LIKE c.hierarchy_path || '%'
	           ) AS descendant_use_case_count,
           (
             SELECT COUNT(*)
               FROM federal_organizations fc
              WHERE fc.parent_id = c.id
           ) AS child_count
      FROM children c
     ORDER BY descendant_use_case_count DESC, c.name COLLATE NOCASE ASC
    `,
  );
  return stmt.all(parentId);
}

/**
 * Use-case count for an org, optionally rolling up descendants. Uses
 * bureau_organization_id, falling back to organization_id for rows where no
 * bureau-level mapping is available.
 */
export function getOrgUseCaseCount(
  orgId: number,
  includeDescendants = true,
): number {
  if (!includeDescendants) {
    const r = rawDb()
	      .prepare<[number], { n: number }>(
	        `SELECT COUNT(*) AS n
	           FROM use_cases
	          WHERE COALESCE(bureau_organization_id, organization_id) = ?`,
	      )
      .get(orgId);
    return r?.n ?? 0;
  }
  const ids = getOrgAndDescendantIds(orgId);
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(",");
  const r = rawDb()
    .prepare<number[], { n: number }>(
      `SELECT COUNT(*) AS n
         FROM use_cases
        WHERE COALESCE(bureau_organization_id, organization_id) IN (${placeholders})`,
    )
    .get(...ids);
  return r?.n ?? 0;
}

export interface OrgMaturity {
  organization_id: number;
  total_use_cases: number;
  distinct_products_deployed: number;
  generative_ai_count: number;
  coding_tool_count: number;
  general_llm_count: number;
  classical_ml_count: number;
  agentic_ai_count: number;
  custom_system_count: number;
  has_enterprise_llm: number;
  has_coding_assistants: number;
  has_agentic_ai: number;
  has_custom_ai: number;
  pct_deployed: number;
  pct_high_impact: number;
  pct_with_risk_docs: number;
  maturity_tier: string | null;
}

/**
 * Sub-agency maturity row from org_ai_maturity. Returns null if this org
 * doesn't meet the use-case threshold or hasn't been computed yet. Top-level
 * orgs (departments / independents) keep their maturity in agency_ai_maturity
 * via the legacy join — call getAgencyById(org.legacy_agency_id) for those.
 */
export function getMaturityForOrg(orgId: number): OrgMaturity | null {
  return (
    rawDb()
      .prepare<[number], OrgMaturity>(
        `SELECT * FROM org_ai_maturity WHERE organization_id = ? LIMIT 1`,
      )
      .get(orgId) ?? null
  );
}

/**
 * Every org plus its direct-bureau use-case count and descendant rollup.
 * Used by the tree view on the agencies index. One query, sorted by depth
 * so callers can build a parent-child map in a single pass.
 */
export function getFullHierarchyWithCounts(): OrgWithUseCaseCount[] {
  return rawDb()
    .prepare<[], OrgWithUseCaseCount>(
      `
      SELECT fo.id, fo.name, fo.short_name, fo.abbreviation, fo.slug,
             fo.parent_id, fo.level, fo.hierarchy_path, fo.depth,
             fo.is_cfo_act_agency, fo.is_cabinet_department, fo.is_active,
             fo.display_order, fo.description, fo.website, fo.legacy_agency_id,
             COALESCE(direct.n, 0) AS use_case_count,
             COALESCE(subtree.n, 0) AS descendant_use_case_count,
             COALESCE(kids.n, 0) AS child_count
        FROM federal_organizations fo
        LEFT JOIN (
	          SELECT COALESCE(bureau_organization_id, organization_id) AS id, COUNT(*) AS n
	            FROM use_cases
	           WHERE COALESCE(bureau_organization_id, organization_id) IS NOT NULL
	           GROUP BY COALESCE(bureau_organization_id, organization_id)
	        ) direct ON direct.id = fo.id
        LEFT JOIN (
          SELECT fo2.id, COUNT(uc.id) AS n
            FROM federal_organizations fo2
            LEFT JOIN federal_organizations descs
              ON descs.hierarchy_path LIKE fo2.hierarchy_path || '%'
	            LEFT JOIN use_cases uc
	              ON COALESCE(uc.bureau_organization_id, uc.organization_id) = descs.id
           GROUP BY fo2.id
        ) subtree ON subtree.id = fo.id
        LEFT JOIN (
          SELECT parent_id AS id, COUNT(*) AS n
            FROM federal_organizations
           WHERE parent_id IS NOT NULL
           GROUP BY parent_id
        ) kids ON kids.id = fo.id
       ORDER BY fo.depth ASC, fo.is_cabinet_department DESC,
                fo.is_cfo_act_agency DESC, fo.name COLLATE NOCASE ASC
      `,
    )
    .all();
}

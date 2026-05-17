import { getDb } from "../shared/init";
import type { BreakdownRow, BureauBreakdown } from "../../types";

export function getBureauBreakdown(agencyId: number): BureauBreakdown[] {
  const stmt = getDb().prepare<[number], BureauBreakdown>(`
    SELECT COALESCE(bureau_component, '(Unassigned)') AS label,
           bureau_component,
           COUNT(*) AS count
      FROM use_cases
     WHERE agency_id = ?
     GROUP BY bureau_component
     ORDER BY count DESC
  `);
  return stmt.all(agencyId);
}

/*
 * The per-agency breakdown helpers below union use_case_tags rows from BOTH
 * source tables (individual and consolidated) so the donuts on the agency
 * detail page reflect every entry the agency filed — not just the individual
 * ones. `use_case_tags` carries either `use_case_id` OR
 * `consolidated_use_case_id`, never both, so the CHECK constraint on the
 * table guarantees a clean union.
 */
export function getEntryTypeBreakdown(agencyId: number): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT COALESCE(entry_type, 'unknown') AS label, COUNT(*) AS count
      FROM (
        SELECT t.entry_type FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT t.entry_type FROM use_case_tags t
          JOIN consolidated_use_cases c ON c.id = t.consolidated_use_case_id
         WHERE c.agency_id = ?
      )
     GROUP BY entry_type
     ORDER BY count DESC
  `);
  return stmt.all(agencyId, agencyId);
}

export function getAISophisticationBreakdown(
  agencyId: number,
): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT COALESCE(ai_sophistication, 'unknown') AS label, COUNT(*) AS count
      FROM (
        SELECT t.ai_sophistication FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT t.ai_sophistication FROM use_case_tags t
          JOIN consolidated_use_cases c ON c.id = t.consolidated_use_case_id
         WHERE c.agency_id = ?
      )
     GROUP BY ai_sophistication
     ORDER BY count DESC
  `);
  return stmt.all(agencyId, agencyId);
}

export function getDeploymentScopeBreakdown(
  agencyId: number,
): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT COALESCE(deployment_scope, 'unknown') AS label, COUNT(*) AS count
      FROM (
        SELECT t.deployment_scope FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT t.deployment_scope FROM use_case_tags t
          JOIN consolidated_use_cases c ON c.id = t.consolidated_use_case_id
         WHERE c.agency_id = ?
      )
     GROUP BY deployment_scope
     ORDER BY count DESC
  `);
  return stmt.all(agencyId, agencyId);
}

/** Per-agency rollup of distinct entries by IFP product category. Excludes
 *  the 'unclassified' placeholder. */
export function getCategoryDistributionForAgency(
  agencyId: number,
): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT p.product_type AS label, COUNT(*) AS count
      FROM (
        SELECT ucp.use_case_id AS entry_id, ucp.product_id
          FROM use_case_products ucp
          JOIN use_cases uc ON uc.id = ucp.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT cucp.consolidated_use_case_id AS entry_id, cucp.product_id
          FROM consolidated_use_case_products cucp
          JOIN consolidated_use_cases c ON c.id = cucp.consolidated_use_case_id
         WHERE c.agency_id = ?
      ) edges
      JOIN products p ON p.id = edges.product_id
     WHERE p.product_type IS NOT NULL
       AND TRIM(p.product_type) <> ''
       AND LOWER(TRIM(p.product_type)) <> 'unclassified'
     GROUP BY p.product_type
     ORDER BY count DESC, p.product_type COLLATE NOCASE ASC
  `);
  return stmt.all(agencyId, agencyId);
}

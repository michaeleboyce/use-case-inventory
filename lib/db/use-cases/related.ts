import { getDb } from "../shared/init";
import type { PeerUseCaseRow } from "../../types";

// -----------------------------------------------------------------------------
// Related-entries discovery (sidebar on the detail page)
// -----------------------------------------------------------------------------

/** Small list of related use cases within the same agency, excluding the given id. */
export function getRelatedByAgency(
  agencyId: number,
  excludeId: number,
  limit = 5,
): Array<{ id: number; slug: string | null; use_case_name: string; agency_abbreviation: string }> {
  return getDb()
    .prepare<
      [number, number, number],
      { id: number; slug: string | null; use_case_name: string; agency_abbreviation: string }
    >(`
      SELECT uc.id, uc.slug, uc.use_case_name, a.abbreviation AS agency_abbreviation
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
       WHERE uc.agency_id = ? AND uc.id <> ?
       ORDER BY uc.use_case_name COLLATE NOCASE ASC
       LIMIT ?
    `)
    .all(agencyId, excludeId, limit);
}

/** Small list of related use cases that share the same product. */
export function getRelatedByProduct(
  productId: number,
  excludeId: number,
  limit = 5,
): Array<{
  id: number;
  slug: string | null;
  use_case_name: string;
  agency_abbreviation: string;
}> {
  return getDb()
    .prepare<
      [number, number, number],
      { id: number; slug: string | null; use_case_name: string; agency_abbreviation: string }
    >(`
      SELECT uc.id, uc.slug, uc.use_case_name, a.abbreviation AS agency_abbreviation
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
       WHERE uc.id IN (
         SELECT entry_id FROM entry_product_edges
          WHERE entry_kind = 'use_case' AND product_id = ?
       )
         AND uc.id <> ?
       ORDER BY uc.use_case_name COLLATE NOCASE ASC
       LIMIT ?
    `)
    .all(productId, excludeId, limit);
}

/** Small list of related use cases that share the same template. */
// (getRelatedByTemplate removed: individual rows never carry a template —
// use_cases.template_id was 0-populated and is scheduled for physical drop.)

// -----------------------------------------------------------------------------
// Peer use cases (similarity sidebar on the detail page)
// -----------------------------------------------------------------------------

export function getPeerUseCases(
  useCaseId: number,
  limit = 6,
): PeerUseCaseRow[] {
  const db = getDb();
  const seed = db
    .prepare<
      [number],
      {
        agency_id: number;
        ai_sophistication: string | null;
        deployment_scope: string | null;
        use_type: string | null;
        high_impact_designation: string | null;
        entry_type: string | null;
        topic_area: string | null;
      }
    >(
      `SELECT uc.agency_id,
              tag.ai_sophistication,
              tag.deployment_scope,
              tag.use_type,
              tag.high_impact_designation,
              tag.entry_type,
              uc.topic_area
         FROM use_cases uc
         LEFT JOIN use_case_tags tag ON tag.use_case_id = uc.id
        WHERE uc.id = ?`,
    )
    .get(useCaseId);

  if (!seed) return [];

  const conds: string[] = [];
  const params: (string | number)[] = [];
  const push = (col: string, val: string | null) => {
    if (val == null || val === "") return;
    conds.push(`(CASE WHEN ${col} = ? THEN 1 ELSE 0 END)`);
    params.push(val);
  };
  push("tag2.ai_sophistication", seed.ai_sophistication);
  push("tag2.deployment_scope", seed.deployment_scope);
  push("tag2.use_type", seed.use_type);
  push("tag2.high_impact_designation", seed.high_impact_designation);
  push("tag2.entry_type", seed.entry_type);
  push("uc2.topic_area", seed.topic_area);

  // Need at least 2 dimensions populated on the seed to even attempt — a
  // use case with only entry_type set will match too many random peers.
  if (conds.length < 2) return [];

  const sumExpr = conds.join(" + ");

  const rows = db
    .prepare<
      (string | number)[],
      PeerUseCaseRow
    >(
      `SELECT uc2.id,
              uc2.slug,
              uc2.use_case_name,
              a.id AS agency_id,
              a.abbreviation AS agency_abbreviation,
              a.name AS agency_name,
              tag2.ai_sophistication,
              tag2.deployment_scope,
              uc2.stage_of_development,
              uc2.topic_area,
              (${sumExpr}) AS shared_dimensions
         FROM use_cases uc2
         JOIN agencies a ON a.id = uc2.agency_id
         LEFT JOIN use_case_tags tag2 ON tag2.use_case_id = uc2.id
        WHERE uc2.id <> ?
          AND uc2.agency_id <> ?
          AND (${sumExpr}) >= 3
        ORDER BY shared_dimensions DESC,
                 COALESCE(uc2.operational_date, '') DESC,
                 uc2.use_case_name COLLATE NOCASE ASC
        LIMIT ?`,
    )
    .all(...params, useCaseId, seed.agency_id, ...params, limit);

  return rows;
}

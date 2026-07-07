/**
 * Within-department bureau divergence — "enterprise access is decided below the
 * department." For every parent org with ≥3 scored bureaus, how many of those
 * bureaus independently clear the enterprise-LLM bar.
 *
 * Scope: `org_ai_maturity` rows at level sub_agency / office (a bureau is scored
 * only once it files ≥5 use cases), rolled up one hop to their immediate parent
 * (`federal_organizations.parent_id`). So HHS's row counts its operating
 * divisions; CMS's row (itself an opdiv) counts CMS's own scored offices.
 *
 * The story (see audit/article/fact_sheet.md §5b): HHS is a federation where
 * every scored opdiv independently has enterprise LLM (8/8); DOJ's bureaus
 * uniformly do not (0/14); DOE is bimodal across its labs (2/18); VA's only
 * enterprise-LLM bureau is OIT.
 *
 * Caveat carried by every caller: scored-bureau counts are FLOORS — a bureau
 * under 5 filed use cases isn't scored, so absence is not evidence of absence.
 */

import { getDb } from "../shared/init";

export interface BureauDivergenceRow {
  parentAbbr: string;
  parentName: string;
  /** department | independent | sub_agency (the rolled-up parent's level). */
  parentLevel: string;
  /** Bureaus (sub_agency/office) under this parent that are scored. */
  scored: number;
  withEnterpriseLLM: number;
  withCoding: number;
  /** Abbreviations of the scored bureaus that have enterprise LLM. */
  enterpriseLLMBureaus: string[];
}

export function getBureauDivergence(minScored = 3): BureauDivergenceRow[] {
  const rows = getDb()
    .prepare<
      [number],
      {
        parent_abbr: string | null;
        parent_name: string;
        parent_level: string;
        scored: number;
        ent_llm: number;
        coding: number;
        llm_bureaus: string | null;
      }
    >(
      `WITH scored AS (
         SELECT o.id,
                COALESCE(o.abbreviation, o.short_name, o.name) AS abbr,
                o.parent_id,
                COALESCE(m.has_enterprise_llm, 0) AS ent,
                COALESCE(m.has_coding_assistants, 0) AS cod
           FROM federal_organizations o
           JOIN org_ai_maturity m ON m.organization_id = o.id
          WHERE o.level IN ('sub_agency', 'office')
       )
       SELECT COALESCE(p.abbreviation, p.short_name, p.name) AS parent_abbr,
              p.name AS parent_name,
              p.level AS parent_level,
              COUNT(*) AS scored,
              SUM(s.ent) AS ent_llm,
              SUM(s.cod) AS coding,
              GROUP_CONCAT(CASE WHEN s.ent = 1 THEN s.abbr END, '|') AS llm_bureaus
         FROM scored s
         JOIN federal_organizations p ON p.id = s.parent_id
        GROUP BY s.parent_id
       HAVING scored >= ?
        ORDER BY (CAST(SUM(s.ent) AS REAL) / COUNT(*)) DESC,
                 scored DESC,
                 parent_abbr COLLATE NOCASE ASC`,
    )
    .all(minScored);

  return rows.map((r) => ({
    parentAbbr: r.parent_abbr ?? r.parent_name,
    parentName: r.parent_name,
    parentLevel: r.parent_level,
    scored: r.scored,
    withEnterpriseLLM: r.ent_llm,
    withCoding: r.coding,
    enterpriseLLMBureaus: (r.llm_bureaus ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  }));
}

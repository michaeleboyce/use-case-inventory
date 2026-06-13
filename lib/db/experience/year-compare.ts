/**
 * 2024 vs 2025 GenAI counts, aggregate and per-agency.
 */

import { getDb } from "../shared/init";
import type {
  AgencyYearCompareGenAiRow,
  GenAiDefinition,
  YearCompareGenAi,
} from "../../experience-shared";
import { getGenAiHeadlines } from "./headlines";

/**
 * 2024 now has an IFP tag layer (`use_case_tags_2024_canonical`, the
 * highest-wave tag per 2024 use case). `count_2024_tagged` is the
 * `is_generative_ai = 1` count there — directly comparable to the 2025
 * `ifp_genai` definition, since both are IFP narrative re-tags rather than
 * OMB self-classification.
 */
export function getYearCompareGenAi(): YearCompareGenAi {
  const headlines = getGenAiHeadlines();
  const total_2025 =
    getDb().prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM use_cases`).get()
      ?.n ?? 0;
  const total_2024 =
    getDb()
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM use_cases_2024`)
      .get()?.n ?? 0;
  const count_2024_tagged = getDb()
    .prepare<[], { n: number }>(`
      SELECT COUNT(*) AS n
        FROM use_case_tags_2024_canonical
       WHERE is_generative_ai = 1
    `)
    .get()?.n ?? 0;

  const counts_2025_by_definition = {} as Record<GenAiDefinition, number>;
  for (const h of headlines) counts_2025_by_definition[h.definition] = h.total;

  return {
    count_2024_tagged,
    total_2024,
    total_2025,
    counts_2025_by_definition,
  };
}

/**
 * Per-agency 2024-vs-2025 IFP-tagged GenAI counts plus net change. Both sides
 * use the IFP `is_generative_ai` tag (2024 from `use_case_tags_2024_canonical`,
 * 2025 from `use_case_tags`) so the comparison is like-for-like. Agencies with
 * at least one GenAI use case in either cycle appear; ordered by 2025 volume.
 */
export function getYearCompareGenAiByAgency(): AgencyYearCompareGenAiRow[] {
  return getDb()
    .prepare<[], AgencyYearCompareGenAiRow>(`
      WITH g24 AS (
        SELECT u.agency_id AS agency_id, COUNT(*) AS n
          FROM use_case_tags_2024_canonical c
          JOIN use_cases_2024 u ON u.id = c.use_case_id_2024
         WHERE c.is_generative_ai = 1
         GROUP BY u.agency_id
      ),
      g25 AS (
        SELECT uc.agency_id AS agency_id, COUNT(*) AS n
          FROM use_cases uc
          JOIN use_case_tags t ON t.use_case_id = uc.id
         WHERE t.is_generative_ai = 1
         GROUP BY uc.agency_id
      )
      SELECT a.id                       AS agency_id,
             a.abbreviation             AS abbreviation,
             a.name                     AS name,
             COALESCE(g24.n, 0)         AS genai_2024,
             COALESCE(g25.n, 0)         AS genai_2025,
             COALESCE(g25.n, 0) - COALESCE(g24.n, 0) AS delta
        FROM agencies a
        LEFT JOIN g24 ON g24.agency_id = a.id
        LEFT JOIN g25 ON g25.agency_id = a.id
       WHERE COALESCE(g24.n, 0) > 0 OR COALESCE(g25.n, 0) > 0
       ORDER BY genai_2025 DESC, a.name COLLATE NOCASE ASC
    `)
    .all();
}

// lib/db/adoption.ts
//
// Live GenAI-adoption series for the /adoption comparison page: per-cycle
// counts computed from the inventory tables so the page tracks every DB
// rebuild instead of hard-coding the fact-sheet numbers.
//
// Population discipline (see the ETL "population-attribution trap"): all
// counts here are INDIVIDUAL use cases only — 2025 tag rows are filtered to
// `use_case_id IS NOT NULL` so the 2024↔2025 comparison is like-for-like
// (the 900-row consolidated/Appendix-B grid has no 2024 counterpart).

import { DEPLOYED_STAGES_2024 } from "../stage-buckets";
import { getDb } from "./shared/init";
import type { GenAiCycleStats } from "../types/adoption";

const DEPLOYED_2024_SQL = DEPLOYED_STAGES_2024.map((s) => `'${s}'`).join(", ");

/**
 * One row per inventory cycle (2024, 2025), oldest first:
 *   total_use_cases            — individually filed use cases
 *   genai_use_cases            — IFP-tagged generative AI
 *   deployed_genai             — GenAI in a deployed stage
 *   enterprise_genai_agencies  — agencies with ≥1 enterprise-wide GenAI entry
 */
export function getGenAiAdoptionSeries(): GenAiCycleStats[] {
  const db = getDb();

  const row2024 = db
    .prepare<[], Omit<GenAiCycleStats, "inventory_year">>(`
      SELECT
        (SELECT COUNT(*) FROM use_cases_2024) AS total_use_cases,
        COALESCE(SUM(c.is_generative_ai), 0) AS genai_use_cases,
        COALESCE(SUM(CASE WHEN c.is_generative_ai = 1
                       AND u.dev_stage IN (${DEPLOYED_2024_SQL})
                     THEN 1 ELSE 0 END), 0) AS deployed_genai,
        COUNT(DISTINCT CASE WHEN c.is_generative_ai = 1
                         AND c.is_enterprise_wide = 1
                       THEN u.agency_id END) AS enterprise_genai_agencies
      FROM use_case_tags_2024_canonical c
      JOIN use_cases_2024 u ON u.id = c.use_case_id_2024
    `)
    .get()!;

  const row2025 = db
    .prepare<[], Omit<GenAiCycleStats, "inventory_year">>(`
      SELECT
        (SELECT COUNT(*) FROM use_cases) AS total_use_cases,
        COALESCE(SUM(t.is_generative_ai), 0) AS genai_use_cases,
        COALESCE(SUM(CASE WHEN t.is_generative_ai = 1
                       AND u.stage_normalized = 'deployed'
                     THEN 1 ELSE 0 END), 0) AS deployed_genai,
        COUNT(DISTINCT CASE WHEN t.is_generative_ai = 1
                         AND t.is_enterprise_wide = 1
                       THEN u.agency_id END) AS enterprise_genai_agencies
      FROM use_case_tags t
      JOIN use_cases u ON u.id = t.use_case_id
      WHERE t.use_case_id IS NOT NULL
    `)
    .get()!;

  return [
    { inventory_year: 2024, ...row2024 },
    { inventory_year: 2025, ...row2025 },
  ];
}

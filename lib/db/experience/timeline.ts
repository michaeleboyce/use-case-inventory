/**
 * GenAI go-live timeline and per-agency counts by definition.
 */

import { getDb } from "../shared/init";
import { STAGE_BUCKET_SQL } from "../shared/sql-fragments";
import {
  GENAI_DEFINITIONS,
  type AgencyGenAiRow,
  type GenAiEarlyTailRow,
  type GenAiTimelinePoint,
} from "../../experience-shared";
import { genaiPredicate } from "./shared";

/**
 * Operational dates are stored as 8+ different free-text formats — ISO,
 * `MM/DD/YYYY`, `Mon-YY`, `YYYY`, etc. We extract a 4-digit year by trying
 * an ISO prefix first, then scanning for any 19xx/20xx pattern, then
 * mapping `*-YY` two-digit-year suffixes onto the 20YY window. Anything
 * that doesn't yield a year buckets as "unknown".
 */
const OPERATIONAL_YEAR_SQL = `
  CASE
    WHEN uc.operational_date IS NULL OR TRIM(uc.operational_date) = '' OR uc.operational_date LIKE 'N/A%'
      THEN 'unknown'
    WHEN uc.operational_date GLOB '[12][09][0-9][0-9]-[01][0-9]*'
      THEN SUBSTR(uc.operational_date, 1, 4)
    WHEN uc.operational_date LIKE '%2026%' THEN '2026'
    WHEN uc.operational_date LIKE '%2025%' THEN '2025'
    WHEN uc.operational_date LIKE '%2024%' THEN '2024'
    WHEN uc.operational_date LIKE '%2023%' THEN '2023'
    WHEN uc.operational_date LIKE '%2022%' THEN '2022'
    WHEN uc.operational_date LIKE '%2021%' THEN '2021'
    WHEN uc.operational_date LIKE '%2020%' THEN '2020'
    WHEN uc.operational_date LIKE '%2019%' THEN '2019'
    WHEN uc.operational_date LIKE '%-26' THEN '2026'
    WHEN uc.operational_date LIKE '%-25' THEN '2025'
    WHEN uc.operational_date LIKE '%-24' THEN '2024'
    WHEN uc.operational_date LIKE '%-23' THEN '2023'
    WHEN uc.operational_date LIKE '%-22' THEN '2022'
    WHEN uc.operational_date LIKE '%-21' THEN '2021'
    WHEN uc.operational_date LIKE '%-20' THEN '2020'
    ELSE 'unknown'
  END
`;

export function getGenAiTimeline(): GenAiTimelinePoint[] {
  // One query per definition; merge into year-keyed rows. `declared` is
  // the subset the agency itself filed as Generative/Agentic AI — the
  // provenance toggle on the chart stacks counts into declared vs
  // IFP-tagged-beyond-declaration.
  const byYear = new Map<string, GenAiTimelinePoint>();
  for (const def of GENAI_DEFINITIONS) {
    const rows = getDb()
      .prepare<[], { yr: string; n: number; declared: number }>(`
        SELECT ${OPERATIONAL_YEAR_SQL} AS yr,
               COUNT(*) AS n,
               SUM(CASE WHEN uc.ai_classification_normalized
                          IN ('Generative AI','Agentic AI')
                        THEN 1 ELSE 0 END) AS declared
          FROM use_cases uc
          LEFT JOIN use_case_tags t ON t.use_case_id = uc.id
         WHERE ${genaiPredicate(def)}
           AND ${STAGE_BUCKET_SQL} = 'deployed'
         GROUP BY yr
      `)
      .all();
    for (const r of rows) {
      if (!byYear.has(r.yr)) {
        byYear.set(r.yr, {
          year: r.yr,
          counts: { omb: 0, ifp_genai: 0, ifp_llm_access: 0, ifp_enterprise: 0 },
          declared: { omb: 0, ifp_genai: 0, ifp_llm_access: 0, ifp_enterprise: 0 },
        });
      }
      byYear.get(r.yr)!.counts[def] = r.n;
      byYear.get(r.yr)!.declared[def] = r.declared;
    }
  }
  // Sort: numeric years ascending, "unknown" last.
  return Array.from(byYear.values()).sort((a, b) => {
    if (a.year === "unknown") return 1;
    if (b.year === "unknown") return -1;
    return Number(a.year) - Number(b.year);
  });
}

/**
 * The pre-2023 tail of the deployed-GenAI timeline, itemized: every
 * IFP-GenAI-tagged deployed use case whose operational year parses to
 * before `cutoffYear`. Renders as the collapsed "why is this here?" list
 * under the § 02 chart — these rows are a mix of genuinely-generative
 * pre-LLM tech (NLG, TTS, translation), systems that retrofitted GenAI
 * after go-live, and (pre-review) keyword over-tags.
 */
export function getGenAiEarlyTail(cutoffYear = 2023): GenAiEarlyTailRow[] {
  const rows = getDb()
    .prepare<[], GenAiEarlyTailRow & { year: string }>(`
      SELECT a.abbreviation AS agency_abbreviation,
             uc.use_case_name,
             uc.slug,
             ${OPERATIONAL_YEAR_SQL} AS year,
             COALESCE(uc.ai_classification_normalized, 'Unspecified')
               AS declared_classification,
             uc.system_name
        FROM use_cases uc
        LEFT JOIN use_case_tags t ON t.use_case_id = uc.id
        JOIN agencies a ON a.id = uc.agency_id
       WHERE ${genaiPredicate("ifp_genai")}
         AND ${STAGE_BUCKET_SQL} = 'deployed'
       ORDER BY year ASC, a.abbreviation ASC
    `)
    .all();
  return rows.filter(
    (r) => r.year !== "unknown" && Number(r.year) < cutoffYear,
  );
}

export function getAgencyGenAiCounts(): AgencyGenAiRow[] {
  const byAgency = new Map<number, AgencyGenAiRow>();
  for (const def of GENAI_DEFINITIONS) {
    const rows = getDb()
      .prepare<
        [],
        { agency_id: number; abbreviation: string; name: string; n: number }
      >(`
        SELECT a.id AS agency_id, a.abbreviation, a.name, COUNT(*) AS n
          FROM use_cases uc
          JOIN agencies a ON a.id = uc.agency_id
          LEFT JOIN use_case_tags t ON t.use_case_id = uc.id
         WHERE ${genaiPredicate(def)}
         GROUP BY a.id
      `)
      .all();
    for (const r of rows) {
      if (!byAgency.has(r.agency_id)) {
        byAgency.set(r.agency_id, {
          agency_id: r.agency_id,
          abbreviation: r.abbreviation,
          name: r.name,
          counts: { omb: 0, ifp_genai: 0, ifp_llm_access: 0, ifp_enterprise: 0 },
        });
      }
      byAgency.get(r.agency_id)!.counts[def] = r.n;
    }
  }
  return Array.from(byAgency.values());
}

/**
 * Queries for the /experience page — "What LLM access does an average civil
 * servant have, before and after the AI Action Plan?"
 *
 * Two ideas anchor every query here:
 *
 *   1. There is no single "is this GenAI?" answer. The OMB-filed
 *      `ai_classification` column disagrees with the IFP-tagged
 *      `use_case_tags.is_generative_ai` flag for ~890 of 3,549 use cases.
 *      Every count below is parametric on a `definition` so the page can
 *      render the same chart under four lenses and let the reader compare:
 *
 *        - "omb"            : ai_classification LIKE '%Generative%'
 *        - "ifp_genai"      : use_case_tags.is_generative_ai = 1
 *        - "ifp_llm_access" : use_case_tags.is_general_llm_access = 1
 *        - "ifp_enterprise" : is_enterprise_wide = 1 AND is_general_llm_access = 1
 *
 *   2. Use-case rows don't measure workforce-scale access. The license-band
 *      column on `consolidated_use_cases.estimated_licenses_users` does — but
 *      it's a band ("1001-5000"), not an exact number. We extrapolate seats
 *      via band midpoints, knowing the resulting total is the same employee
 *      counted once per tool they have. Reported as "estimated seats" not
 *      "estimated users".
 */

import { getDb } from "./shared/init";
import { STAGE_BUCKET_SQL } from "./shared/sql-fragments";
import {
  GENAI_DEFINITIONS,
  type AgencyGenAiRow,
  type AgencyToolMatrixRow,
  type GenAiDefinition,
  type GenAiHeadline,
  type GenAiTimelinePoint,
  type MatrixCell,
  type MatrixProductKey,
  type OmbIfpCrosstab,
  type SeatExtrapolationRow,
  type YearCompareGenAi,
} from "../experience-shared";

// Re-export for callers importing from @/lib/db.
export {
  GENAI_DEFINITIONS,
  GENAI_DEFINITION_LABELS,
  GENAI_DEFINITION_SHORT,
  GENAI_DEFINITION_SOURCE,
  MATRIX_PRODUCT_BUCKETS,
  type GenAiDefinition,
  type GenAiHeadline,
  type OmbIfpCrosstab,
  type GenAiTimelinePoint,
  type AgencyGenAiRow,
  type SeatExtrapolationRow,
  type AgencyToolMatrixRow,
  type MatrixCell,
  type MatrixProductKey,
  type YearCompareGenAi,
} from "../experience-shared";

/**
 * SQL predicate selecting use cases that match a given GenAI definition.
 * Always references `uc` (use_cases) and `t` (use_case_tags) — callers must
 * provide a LEFT JOIN to `use_case_tags AS t ON t.use_case_id = uc.id`.
 */
function genaiPredicate(def: GenAiDefinition): string {
  switch (def) {
    case "omb":
      return "uc.ai_classification LIKE '%Generative%'";
    case "ifp_genai":
      return "t.is_generative_ai = 1";
    case "ifp_llm_access":
      return "t.is_general_llm_access = 1";
    case "ifp_enterprise":
      return "t.is_enterprise_wide = 1 AND t.is_general_llm_access = 1";
  }
}

/* ------------------------------------------------------------------ */
/* Headline counts                                                     */
/* ------------------------------------------------------------------ */

export function getGenAiHeadlines(): GenAiHeadline[] {
  return GENAI_DEFINITIONS.map((def) => {
    const row = getDb()
      .prepare<
        [],
        {
          total: number;
          deployed: number;
          pilot: number;
          pre_deployment: number;
          retired: number;
        }
      >(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN ${STAGE_BUCKET_SQL} = 'deployed' THEN 1 ELSE 0 END) AS deployed,
          SUM(CASE WHEN ${STAGE_BUCKET_SQL} = 'pilot' THEN 1 ELSE 0 END) AS pilot,
          SUM(CASE WHEN ${STAGE_BUCKET_SQL} = 'pre_deployment' THEN 1 ELSE 0 END) AS pre_deployment,
          SUM(CASE WHEN ${STAGE_BUCKET_SQL} = 'retired' THEN 1 ELSE 0 END) AS retired
        FROM use_cases uc
        LEFT JOIN use_case_tags t ON t.use_case_id = uc.id
        WHERE ${genaiPredicate(def)}
      `)
      .get();
    return {
      definition: def,
      total: row?.total ?? 0,
      deployed: row?.deployed ?? 0,
      pilot: row?.pilot ?? 0,
      pre_deployment: row?.pre_deployment ?? 0,
      retired: row?.retired ?? 0,
    };
  });
}

/* ------------------------------------------------------------------ */
/* OMB ↔ IFP disagreement                                              */
/* ------------------------------------------------------------------ */

export function getOmbIfpCrosstab(): OmbIfpCrosstab {
  // COALESCE the ai_classification so NULL rows fall into the "not GenAI"
  // branch rather than evaluating to NULL on both LIKE and NOT LIKE.
  const row = getDb()
    .prepare<[], OmbIfpCrosstab>(`
      SELECT
        SUM(CASE WHEN COALESCE(uc.ai_classification,'') LIKE '%Generative%' AND t.is_generative_ai = 1 THEN 1 ELSE 0 END) AS omb_genai_ifp_genai,
        SUM(CASE WHEN COALESCE(uc.ai_classification,'') LIKE '%Generative%' AND COALESCE(t.is_generative_ai,0) = 0 THEN 1 ELSE 0 END) AS omb_genai_ifp_not,
        SUM(CASE WHEN COALESCE(uc.ai_classification,'') NOT LIKE '%Generative%' AND t.is_generative_ai = 1 THEN 1 ELSE 0 END) AS omb_not_ifp_genai,
        SUM(CASE WHEN COALESCE(uc.ai_classification,'') NOT LIKE '%Generative%' AND COALESCE(t.is_generative_ai,0) = 0 THEN 1 ELSE 0 END) AS omb_not_ifp_not
      FROM use_cases uc
      LEFT JOIN use_case_tags t ON t.use_case_id = uc.id
    `)
    .get();
  return (
    row ?? {
      omb_genai_ifp_genai: 0,
      omb_genai_ifp_not: 0,
      omb_not_ifp_genai: 0,
      omb_not_ifp_not: 0,
    }
  );
}

/* ------------------------------------------------------------------ */
/* GenAI go-live timeline                                              */
/* ------------------------------------------------------------------ */

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
  // One query per definition; merge into year-keyed rows.
  const byYear = new Map<string, GenAiTimelinePoint>();
  for (const def of GENAI_DEFINITIONS) {
    const rows = getDb()
      .prepare<[], { yr: string; n: number }>(`
        SELECT ${OPERATIONAL_YEAR_SQL} AS yr, COUNT(*) AS n
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
        });
      }
      byYear.get(r.yr)!.counts[def] = r.n;
    }
  }
  // Sort: numeric years ascending, "unknown" last.
  return Array.from(byYear.values()).sort((a, b) => {
    if (a.year === "unknown") return 1;
    if (b.year === "unknown") return -1;
    return Number(a.year) - Number(b.year);
  });
}

/* ------------------------------------------------------------------ */
/* Per-agency GenAI by definition                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* License-band extrapolation from consolidated_use_cases               */
/* ------------------------------------------------------------------ */

/**
 * Band midpoints used to convert the free-text license bands on
 * `consolidated_use_cases.estimated_licenses_users` into an integer seat
 * estimate. These are the midpoints of each OMB-defined band; "50,000+" gets
 * a 75k midpoint as a conservative estimate (the largest civilian agencies
 * top out around 250k staff, but most '50,000+' rows are at the lower end).
 */
const BAND_MIDPOINT_SQL = `
  CASE c.estimated_licenses_users
    WHEN '1-100'         THEN 50
    WHEN '101-1000'      THEN 550
    WHEN '1001-5000'     THEN 3000
    WHEN '5001-10,000'   THEN 7500
    WHEN '10,000-50,000' THEN 30000
    WHEN '50,000+'       THEN 75000
    ELSE 0
  END
`;

const BAND_LOWER_SQL = `
  CASE c.estimated_licenses_users
    WHEN '1-100'         THEN 1
    WHEN '101-1000'      THEN 101
    WHEN '1001-5000'     THEN 1001
    WHEN '5001-10,000'   THEN 5001
    WHEN '10,000-50,000' THEN 10000
    WHEN '50,000+'       THEN 50000
    ELSE 0
  END
`;

/** TS mirror of BAND_UPPER_SQL — used to re-sort entries inside a cell. */
function bandUpper(band: string): number {
  switch (band) {
    case "1-100":
      return 100;
    case "101-1000":
      return 1000;
    case "1001-5000":
      return 5000;
    case "5001-10,000":
      return 10000;
    case "10,000-50,000":
      return 50000;
    case "50,000+":
      return 100000;
    default:
      return 0;
  }
}

const BAND_UPPER_SQL = `
  CASE c.estimated_licenses_users
    WHEN '1-100'         THEN 100
    WHEN '101-1000'      THEN 1000
    WHEN '1001-5000'     THEN 5000
    WHEN '5001-10,000'   THEN 10000
    WHEN '10,000-50,000' THEN 50000
    WHEN '50,000+'       THEN 100000
    ELSE 0
  END
`;

/**
 * Per-agency seat extrapolation, using ALL consolidated_use_cases rows that
 * have a license band — not just LLM/GenAI rows. Most agencies' bands cover
 * a mix of LLM + classical-ML + computer-vision tools; the consolidated form
 * doesn't reliably distinguish them. Report as a workforce-AI seat estimate,
 * not an LLM-specific one.
 */
export function getSeatExtrapolationByAgency(): SeatExtrapolationRow[] {
  return getDb()
    .prepare<[], SeatExtrapolationRow>(`
      SELECT a.id            AS agency_id,
             a.abbreviation  AS abbreviation,
             a.name          AS name,
             COUNT(*)        AS rows_with_band,
             SUM(${BAND_LOWER_SQL})   AS lower_bound,
             SUM(${BAND_MIDPOINT_SQL}) AS midpoint,
             SUM(${BAND_UPPER_SQL})   AS upper_bound
        FROM consolidated_use_cases c
        JOIN agencies a ON a.id = c.agency_id
       WHERE c.estimated_licenses_users IS NOT NULL
         AND c.estimated_licenses_users != ''
       GROUP BY a.id
       ORDER BY midpoint DESC
    `)
    .all();
}

/* ------------------------------------------------------------------ */
/* Agency × LLM tool matrix from consolidated_use_cases                 */
/* ------------------------------------------------------------------ */

/**
 * Maps a `commercial_product` row to zero, one, or many buckets. A single
 * row often lists multiple products in one string (the consolidated form
 * concatenates them). Returns the keys this row matches.
 */
function productBucketsSql(): string {
  // Build a SQL expression that returns 1/0 for each bucket.
  // Mirrors the LIKE logic in lib/db/shared/sql-fragments.ts LLM_BUCKET_CASE
  // but operates on consolidated_use_cases.commercial_product (free text).
  return `
    LOWER(COALESCE(c.commercial_product, ''))
  `;
}

export function getAgencyToolMatrix(): AgencyToolMatrixRow[] {
  // Pull all consolidated rows with a band; bucket them in TS so we can match
  // the same row into multiple product columns.
  const rows = getDb()
    .prepare<
      [],
      {
        agency_id: number;
        abbreviation: string;
        name: string;
        consolidated_use_case_id: number;
        slug: string | null;
        ai_use_case: string;
        raw_product: string;
        commercial_product: string;
        band: string;
        upper: number;
        midpoint: number;
      }
    >(`
      SELECT a.id AS agency_id,
             a.abbreviation,
             a.name,
             c.id   AS consolidated_use_case_id,
             c.slug AS slug,
             COALESCE(c.ai_use_case, '')        AS ai_use_case,
             COALESCE(c.commercial_product, '') AS raw_product,
             ${productBucketsSql()} AS commercial_product,
             c.estimated_licenses_users AS band,
             ${BAND_UPPER_SQL}    AS upper,
             ${BAND_MIDPOINT_SQL} AS midpoint
        FROM consolidated_use_cases c
        JOIN agencies a ON a.id = c.agency_id
       WHERE c.estimated_licenses_users IS NOT NULL
         AND c.estimated_licenses_users != ''
    `)
    .all();

  function bucketsForProduct(p: string): MatrixProductKey[] {
    const out: MatrixProductKey[] = [];
    if (
      // M365 / Microsoft Copilot patterns; exclude bare "GitHub Copilot" and
      // "Copilot for Security" which have their own buckets / are not the
      // staff-facing M365 chat surface.
      (/copilot/.test(p) || /m365/.test(p) || /office 365/.test(p)) &&
      !/^\s*github copilot\s*$/.test(p)
    ) {
      if (
        /m365|m 365|office 365|microsoft ?365|ms ?365|365 copilot|microsoft copilot|ms copilot|copilot for microsoft|copilot studio|copilot chat/.test(
          p,
        )
      ) {
        out.push("ms_copilot");
      } else if (!/github/.test(p)) {
        // Bare "Copilot" — assume Microsoft Copilot per OMB filing convention
        out.push("ms_copilot");
      }
    }
    if (/github copilot/.test(p)) out.push("github_copilot");
    if (/chatgpt|openai|gpt-/.test(p)) out.push("chatgpt");
    if (/claude/.test(p)) out.push("claude");
    if (/gemini/.test(p) || /bard/.test(p)) out.push("gemini");
    if (/amazon q|bedrock|aws q/.test(p)) out.push("amazon_q");
    if (
      /gsai|usai\.gov|usai\b|edav|enerGPT|enerpod|parsgpt|nasagpt|elsa|chirp|camogpt|niprgpt/i.test(
        p,
      )
    )
      out.push("agency_built");
    return out;
  }

  const byAgency = new Map<number, AgencyToolMatrixRow>();
  const MAX_ENTRIES_PER_CELL = 8;
  for (const r of rows) {
    if (!byAgency.has(r.agency_id)) {
      byAgency.set(r.agency_id, {
        agency_id: r.agency_id,
        abbreviation: r.abbreviation,
        name: r.name,
        cells: {},
        estimated_seats: 0,
      });
    }
    const agencyRow = byAgency.get(r.agency_id)!;
    const buckets = bucketsForProduct(r.commercial_product ?? "");
    const entry = {
      consolidated_use_case_id: r.consolidated_use_case_id,
      slug: r.slug,
      ai_use_case: r.ai_use_case,
      commercial_product: r.raw_product,
      band_label: r.band,
    };
    for (const k of buckets) {
      const existing = agencyRow.cells[k];
      if (!existing) {
        agencyRow.cells[k] = {
          highest_band_upper: r.upper,
          highest_band_label: r.band,
          rows: 1,
          entries: [entry],
        };
      } else {
        existing.rows += 1;
        if (r.upper > existing.highest_band_upper) {
          existing.highest_band_upper = r.upper;
          existing.highest_band_label = r.band;
        }
        existing.entries.push(entry);
      }
    }
  }

  // Sort and trim entries per cell: largest band first, then shortest
  // description first so the prominent rows surface in the hover panel.
  for (const agencyRow of byAgency.values()) {
    for (const cell of Object.values(agencyRow.cells)) {
      if (!cell) continue;
      cell.entries.sort((a, b) => {
        const ba = bandUpper(a.band_label);
        const bb = bandUpper(b.band_label);
        if (bb !== ba) return bb - ba;
        return a.ai_use_case.length - b.ai_use_case.length;
      });
      if (cell.entries.length > MAX_ENTRIES_PER_CELL) {
        cell.entries = cell.entries.slice(0, MAX_ENTRIES_PER_CELL);
      }
    }
  }

  // Compute estimated_seats per agency as the SUM of midpoints across cells
  // (one midpoint contribution per matched product). This intentionally
  // diverges from `getSeatExtrapolationByAgency` (which sums every band row,
  // even unmatched ones) — here we only count seats that landed in a matrix
  // column.
  // We need to redo the midpoint lookup since cells stores upper-bound only.
  const upperToMidpoint = new Map<number, number>([
    [100, 50],
    [1000, 550],
    [5000, 3000],
    [10000, 7500],
    [50000, 30000],
    [100000, 75000],
  ]);
  for (const ar of byAgency.values()) {
    let seats = 0;
    for (const cell of Object.values(ar.cells)) {
      if (cell) seats += upperToMidpoint.get(cell.highest_band_upper) ?? 0;
    }
    ar.estimated_seats = seats;
  }

  return Array.from(byAgency.values()).sort(
    (a, b) => b.estimated_seats - a.estimated_seats,
  );
}

/* ------------------------------------------------------------------ */
/* 2024 vs 2025 GenAI counts (heuristic for 2024)                       */
/* ------------------------------------------------------------------ */

/**
 * 2024 has no IFP tag layer yet (see docs/plans/2024-tagging/PLAN.md). For now
 * we approximate GenAI in 2024 via a name/narrative LIKE-match — the same
 * heuristic the auto_tag.py seed uses on 2024 rows. This is intentionally a
 * single number, not a per-definition slice, because the four IFP definitions
 * only exist as derived columns on 2025.
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
  const heuristic = getDb()
    .prepare<[], { n: number }>(`
      SELECT COUNT(*) AS n FROM use_cases_2024
       WHERE LOWER(COALESCE(commercial_ai,''))     LIKE '%generative%'
          OR LOWER(COALESCE(purpose_benefits,''))  LIKE '%generative ai%'
          OR LOWER(COALESCE(outputs,''))           LIKE '%generative ai%'
          OR LOWER(COALESCE(outputs,''))           LIKE '%llm%'
          OR LOWER(COALESCE(outputs,''))           LIKE '%language model%'
          OR LOWER(COALESCE(use_case_name,''))     LIKE '%gpt%'
          OR LOWER(COALESCE(use_case_name,''))     LIKE '%copilot%'
          OR LOWER(COALESCE(use_case_name,''))     LIKE '%chatgpt%'
          OR LOWER(COALESCE(use_case_name,''))     LIKE '%llm%'
          OR LOWER(COALESCE(use_case_name,''))     LIKE '%chatbot%'
          OR LOWER(COALESCE(use_case_name,''))     LIKE '%claude%'
          OR LOWER(COALESCE(use_case_name,''))     LIKE '%gemini%'
    `)
    .get()?.n ?? 0;

  const counts_2025_by_definition = {} as Record<GenAiDefinition, number>;
  for (const h of headlines) counts_2025_by_definition[h.definition] = h.total;

  return {
    count_2024_heuristic: heuristic,
    total_2024,
    total_2025,
    counts_2025_by_definition,
  };
}

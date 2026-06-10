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
  type AgencyYearCompareGenAiRow,
  type EnterpriseTierRollupRow,
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
  type AgencyYearCompareGenAiRow,
  type EnterpriseTierRollupRow,
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
function bandUpper(band: string | null): number {
  if (band == null) return 0;
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

/**
 * Bucketing logic shared by both data sources. Operates on a lowercase
 * product string. Returns 0..many MatrixProductKey hits.
 */
function bucketsForProduct(p: string): MatrixProductKey[] {
  const out: MatrixProductKey[] = [];
  if (
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
      out.push("ms_copilot");
    }
  }
  if (/github copilot/.test(p)) out.push("github_copilot");
  if (/chatgpt|openai|gpt-/.test(p)) out.push("chatgpt");
  if (/claude/.test(p)) out.push("claude");
  if (/gemini/.test(p) || /bard/.test(p)) out.push("gemini");
  if (/amazon q|bedrock|aws q/.test(p)) out.push("amazon_q");
  if (
    /gsai|usai\.gov|usai\b|edav|energpt|enerpod|parsgpt|nasagpt|elsa|chirp|camogpt|niprgpt/.test(
      p,
    )
  )
    out.push("agency_built");
  return out;
}

/** Direct map from `use_case_tags` boolean flags to matrix buckets. */
const TAG_TO_BUCKET: Array<[string, MatrixProductKey]> = [
  ["is_microsoft_copilot", "ms_copilot"],
  ["is_github_copilot", "github_copilot"],
  ["is_openai", "chatgpt"],
  ["is_anthropic", "claude"],
  ["is_google", "gemini"],
  ["is_aws_ai", "amazon_q"],
];

/** Hand-set fallback share-of-eligible when Wave-0 priors have n=0. */
const PRIOR_FALLBACK: Record<string, number> = {
  all: 0.50,
  most: 0.30,
  partial: 0.12,
  pilot: 0.02,
  latent: 0.01,
  unknown: 0.05,
  none: 0.0,
};

const BAND_UPPER_TO_MIDPOINT = new Map<number, number>([
  [100, 50],
  [1000, 550],
  [5000, 3000],
  [10000, 7500],
  [50000, 30000],
  [100000, 75000],
]);

export function getAgencyToolMatrix(): AgencyToolMatrixRow[] {
  // (A) Pull consolidated_use_cases rows with a band.
  const consolidatedRows = getDb()
    .prepare<
      [],
      {
        agency_id: number;
        abbreviation: string;
        name: string;
        row_id: number;
        slug: string | null;
        title: string;
        raw_product: string;
        commercial_product: string;
        band: string;
        upper: number;
      }
    >(`
      SELECT a.id AS agency_id,
             a.abbreviation,
             a.name,
             c.id   AS row_id,
             c.slug AS slug,
             COALESCE(c.ai_use_case, '')        AS title,
             COALESCE(c.commercial_product, '') AS raw_product,
             LOWER(COALESCE(c.commercial_product, '')) AS commercial_product,
             c.estimated_licenses_users AS band,
             ${BAND_UPPER_SQL}    AS upper
        FROM consolidated_use_cases c
        JOIN agencies a ON a.id = c.agency_id
       WHERE c.estimated_licenses_users IS NOT NULL
         AND c.estimated_licenses_users != ''
    `)
    .all();

  // (B) Pull use_cases rows whose tag row matches any matrix product family.
  const useCaseRows = getDb()
    .prepare<
      [],
      {
        agency_id: number;
        abbreviation: string;
        name: string;
        row_id: number;
        slug: string | null;
        title: string;
        raw_product: string;
        is_microsoft_copilot: number;
        is_github_copilot: number;
        is_openai: number;
        is_anthropic: number;
        is_google: number;
        is_aws_ai: number;
      }
    >(`
      SELECT a.id AS agency_id,
             a.abbreviation,
             a.name,
             uc.id   AS row_id,
             uc.slug AS slug,
             COALESCE(uc.use_case_name, '')   AS title,
             COALESCE(NULLIF(t.tool_product_name, ''),
                      NULLIF(uc.vendor_name, ''),
                      '')                     AS raw_product,
             COALESCE(t.is_microsoft_copilot, 0) AS is_microsoft_copilot,
             COALESCE(t.is_github_copilot,    0) AS is_github_copilot,
             COALESCE(t.is_openai,            0) AS is_openai,
             COALESCE(t.is_anthropic,         0) AS is_anthropic,
             COALESCE(t.is_google,            0) AS is_google,
             COALESCE(t.is_aws_ai,            0) AS is_aws_ai
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
        JOIN use_case_tags t ON t.use_case_id = uc.id
       WHERE COALESCE(t.is_microsoft_copilot,0)=1
          OR COALESCE(t.is_github_copilot,   0)=1
          OR COALESCE(t.is_openai,           0)=1
          OR COALESCE(t.is_anthropic,        0)=1
          OR COALESCE(t.is_google,           0)=1
          OR COALESCE(t.is_aws_ai,           0)=1
    `)
    .all();

  const byAgency = new Map<number, AgencyToolMatrixRow>();
  const MAX_ENTRIES_PER_CELL = 8;

  function ensureAgency(
    agency_id: number,
    abbreviation: string,
    name: string,
  ): AgencyToolMatrixRow {
    let row = byAgency.get(agency_id);
    if (!row) {
      row = {
        agency_id,
        abbreviation,
        name,
        cells: {},
        estimated_seats_filed: 0,
        estimated_seats_headcount: null,
        headcount_breakdown: null,
      };
      byAgency.set(agency_id, row);
    }
    return row;
  }

  // Insert consolidated rows.
  for (const r of consolidatedRows) {
    const agencyRow = ensureAgency(r.agency_id, r.abbreviation, r.name);
    const buckets = bucketsForProduct(r.commercial_product);
    for (const k of buckets) {
      const existing = agencyRow.cells[k];
      const entry = {
        source: "consolidated" as const,
        subsumed: false,
        row_id: r.row_id,
        slug: r.slug,
        title: r.title,
        commercial_product: r.raw_product,
        band_label: r.band,
      };
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

  // Insert use_cases rows. Bucket via the tag boolean flags directly; for
  // each agency × bucket pair, mark `subsumed=true` if the cell already has
  // a consolidated entry (the consolidated row is the authoritative
  // workforce-scale artifact).
  for (const r of useCaseRows) {
    const agencyRow = ensureAgency(r.agency_id, r.abbreviation, r.name);
    const buckets: MatrixProductKey[] = [];
    for (const [flag, bucket] of TAG_TO_BUCKET) {
      if ((r as unknown as Record<string, number>)[flag] === 1) {
        buckets.push(bucket);
      }
    }
    for (const k of buckets) {
      const existing = agencyRow.cells[k];
      const subsumed =
        !!existing &&
        existing.entries.some((e) => e.source === "consolidated");
      const entry = {
        source: "use_case" as const,
        subsumed,
        row_id: r.row_id,
        slug: r.slug,
        title: r.title,
        commercial_product: r.raw_product,
        band_label: null,
      };
      if (!existing) {
        // No consolidated band — create the cell with no band info; the
        // sentinel `0` upper indicates "no band data."
        agencyRow.cells[k] = {
          highest_band_upper: 0,
          highest_band_label: "",
          rows: 1,
          entries: [entry],
        };
      } else {
        existing.rows += 1;
        existing.entries.push(entry);
      }
    }
  }

  // Sort entries per cell: consolidated rows by band desc, then unsubsumed
  // use_case rows, then subsumed use_case rows. Trim.
  for (const agencyRow of byAgency.values()) {
    for (const cell of Object.values(agencyRow.cells)) {
      if (!cell) continue;
      cell.entries.sort((a, b) => {
        if (a.source !== b.source) {
          return a.source === "consolidated" ? -1 : 1;
        }
        if (a.subsumed !== b.subsumed) return a.subsumed ? 1 : -1;
        const ba = bandUpper(a.band_label);
        const bb = bandUpper(b.band_label);
        if (bb !== ba) return bb - ba;
        return a.title.length - b.title.length;
      });
      if (cell.entries.length > MAX_ENTRIES_PER_CELL) {
        cell.entries = cell.entries.slice(0, MAX_ENTRIES_PER_CELL);
      }
    }
  }

  // Estimate A — "Filed bands": sum of band midpoints across cells that
  // have at least one consolidated entry. Behavior unchanged from launch.
  for (const ar of byAgency.values()) {
    let seats = 0;
    for (const cell of Object.values(ar.cells)) {
      if (!cell) continue;
      if (cell.highest_band_upper > 0) {
        seats += BAND_UPPER_TO_MIDPOINT.get(cell.highest_band_upper) ?? 0;
      }
    }
    ar.estimated_seats_filed = seats;
  }

  // Estimate B — "Headcount-derived". For each agency, look up the
  // agency-level workforce profile and the per-(agency, tool) shares.
  // Computed in a follow-up pass so the matrix payload stays self-contained.
  applyHeadcountEstimates(byAgency);

  return Array.from(byAgency.values()).sort(
    (a, b) => b.estimated_seats_filed - a.estimated_seats_filed,
  );
}

/**
 * Populate `estimated_seats_headcount` and `headcount_breakdown` on each
 * AgencyToolMatrixRow using:
 *
 *   - agency_workforce_profile (level='agency') for headcount + eligible share
 *   - agency_ai_access_evidence.{estimated_share_of_eligible, matrix_product_key}
 *     for the per-tool share. Defaults to coverage-tier priors when missing.
 *
 * Mutates `byAgency` in place. Leaves estimate null when no workforce row
 * exists for the agency — UI then shows `—` for that row.
 */
function applyHeadcountEstimates(
  byAgency: Map<number, AgencyToolMatrixRow>,
): void {
  if (byAgency.size === 0) return;

  // Agency-level workforce profile keyed by agency_id.
  const workforce = new Map<
    number,
    { headcount: number; ai_eligible_share: number }
  >();
  for (const r of getDb()
    .prepare<
      [],
      {
        agency_id: number | null;
        total_headcount: number | null;
        ai_eligible_share: number | null;
      }
    >(`
      SELECT agency_id, total_headcount, ai_eligible_share
        FROM agency_workforce_profile
       WHERE level = 'agency'
         AND total_headcount IS NOT NULL
         AND ai_eligible_share IS NOT NULL
    `)
    .all()) {
    if (r.agency_id == null) continue;
    workforce.set(r.agency_id, {
      headcount: r.total_headcount as number,
      ai_eligible_share: r.ai_eligible_share as number,
    });
  }

  if (workforce.size === 0) return; // No backfill data — leave all null.

  // Per-(agency, MatrixProductKey) share. Pull from agency_ai_access_evidence
  // with the explicit `matrix_product_key`; fall back to tier prior via
  // coverage_assessment.
  type ShareRow = {
    agency_id: number | null;
    matrix_product_key: string | null;
    coverage_assessment: string | null;
    estimated_share_of_eligible: number | null;
  };
  const evidenceRows = getDb()
    .prepare<[], ShareRow>(`
      SELECT agency_id, matrix_product_key, coverage_assessment,
             estimated_share_of_eligible
        FROM agency_ai_access_evidence
       WHERE matrix_product_key IS NOT NULL
    `)
    .all();
  // Pick the highest share per (agency, key) — agencies often have multiple
  // evidence rows per tool (one per source).
  const shareByAgencyTool = new Map<string, number>();
  for (const r of evidenceRows) {
    if (r.agency_id == null || !r.matrix_product_key) continue;
    const key = `${r.agency_id}::${r.matrix_product_key}`;
    const share =
      r.estimated_share_of_eligible ??
      (r.coverage_assessment ? PRIOR_FALLBACK[r.coverage_assessment] : null);
    if (share == null) continue;
    const prev = shareByAgencyTool.get(key);
    if (prev === undefined || share > prev) {
      shareByAgencyTool.set(key, share);
    }
  }

  for (const ar of byAgency.values()) {
    const w = workforce.get(ar.agency_id);
    if (!w) continue;
    const eligible = w.headcount * w.ai_eligible_share;
    let toolShareSum = 0;
    let matchedTools = 0;
    for (const [key, cell] of Object.entries(ar.cells)) {
      if (!cell) continue;
      const share = shareByAgencyTool.get(`${ar.agency_id}::${key}`);
      if (share === undefined) continue;
      toolShareSum += share;
      matchedTools += 1;
    }
    if (matchedTools === 0) {
      ar.estimated_seats_headcount = 0;
      ar.headcount_breakdown =
        `${formatInt(w.headcount)} staff × ${formatPct(w.ai_eligible_share)} eligible — no per-tool share recorded yet`;
    } else {
      const seats = Math.round(eligible * toolShareSum);
      ar.estimated_seats_headcount = seats;
      ar.headcount_breakdown =
        `${formatInt(w.headcount)} staff × ${formatPct(w.ai_eligible_share)} eligible × Σ ${matchedTools} tool share${matchedTools === 1 ? "" : "s"}`;
    }
  }
}

function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

function formatPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/* ------------------------------------------------------------------ */
/* 2024 vs 2025 GenAI counts                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Capability ladder (chat → coding → analytics)                       */
/* ------------------------------------------------------------------ */

export interface CapabilityLadderData {
  chat: {
    llm_access_2025: number;
    enterprise_agencies_2025: string[];
    enterprise_agencies_2024: number;
  };
  coding: {
    individual_2025: number;
    individual_2024: number;
    deployed_2025: number;
    pilot_2025: number;
    pre_deployment_2025: number;
    appendix_b_checkboxes: number;
    top_agencies: Array<{ abbreviation: string; count: number }>;
  };
  analytics: {
    env_known_rows: number;
  };
}

/**
 * The article's three-rung story in one payload: general chat assistants
 * (arrived broadly), coding assistance (present but mostly pre-production),
 * analytics platforms (federated; the inventory barely surfaces them).
 * All counts ride the row-by-row audited tags (audit/retag/* in the ETL
 * repo), not the original keyword heuristics.
 */
export function getCapabilityLadder(): CapabilityLadderData {
  const db = getDb();

  const llmAccess = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT use_case_id) AS c FROM use_case_tags
          WHERE is_general_llm_access = 1 AND use_case_id IS NOT NULL`,
      )
      .get() ?? { c: 0 }
  ).c;

  const enterpriseAgencies = db
    .prepare<[], { abbreviation: string }>(
      `SELECT DISTINCT a.abbreviation
         FROM use_cases uc
         JOIN agencies a ON a.id = uc.agency_id
         JOIN use_case_tags t ON t.use_case_id = uc.id
        WHERE t.is_generative_ai = 1 AND t.is_enterprise_wide = 1
        ORDER BY a.abbreviation`,
    )
    .all()
    .map((r) => r.abbreviation);

  const enterprise2024 = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT u.agency_id) AS c
           FROM use_cases_2024 u
           JOIN use_case_tags_2024_canonical t ON t.use_case_id_2024 = u.id
          WHERE t.is_generative_ai = 1 AND t.is_enterprise_wide = 1`,
      )
      .get() ?? { c: 0 }
  ).c;

  const codingStages = db
    .prepare<[], { bucket: string; c: number }>(
      `SELECT ${STAGE_BUCKET_SQL} AS bucket, COUNT(DISTINCT uc.id) AS c
         FROM use_cases uc
         JOIN use_case_tags t ON t.use_case_id = uc.id
        WHERE t.is_coding_tool = 1
        GROUP BY bucket`,
    )
    .all();
  const stage = (b: string) => codingStages.find((r) => r.bucket === b)?.c ?? 0;

  const coding2024 = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(*) AS c FROM use_case_tags_2024_canonical
          WHERE is_coding_tool = 1`,
      )
      .get() ?? { c: 0 }
  ).c;

  const appendixB = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT consolidated_use_case_id) AS c FROM use_case_tags
          WHERE is_coding_tool = 1 AND consolidated_use_case_id IS NOT NULL`,
      )
      .get() ?? { c: 0 }
  ).c;

  const topAgencies = db
    .prepare<[], { abbreviation: string; count: number }>(
      `SELECT a.abbreviation, COUNT(DISTINCT uc.id) AS count
         FROM use_cases uc
         JOIN agencies a ON a.id = uc.agency_id
         JOIN use_case_tags t ON t.use_case_id = uc.id
        WHERE t.is_coding_tool = 1
        GROUP BY a.abbreviation
        ORDER BY count DESC, a.abbreviation
        LIMIT 8`,
    )
    .all();

  const envKnown = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT use_case_id) AS c FROM use_case_tags
          WHERE use_case_id IS NOT NULL
            AND deployment_environment IS NOT NULL
            AND deployment_environment NOT IN ('', 'unknown')`,
      )
      .get() ?? { c: 0 }
  ).c;

  return {
    chat: {
      llm_access_2025: llmAccess,
      enterprise_agencies_2025: enterpriseAgencies,
      enterprise_agencies_2024: enterprise2024,
    },
    coding: {
      individual_2025:
        codingStages.reduce((acc, r) => acc + r.c, 0),
      individual_2024: coding2024,
      deployed_2025: stage("deployed"),
      pilot_2025: stage("pilot"),
      pre_deployment_2025: stage("pre_deployment"),
      appendix_b_checkboxes: appendixB,
      top_agencies: topAgencies,
    },
    analytics: {
      env_known_rows: envKnown,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Enterprise-GenAI delivery tiers                                     */
/* ------------------------------------------------------------------ */

/**
 * Per-(year, tier) counts of enterprise-wide GenAI use cases, classified by
 * delivery mode (permission / embedded COTS / tenanted / operated build).
 *
 * The rollup table is produced by the ETL repo's
 * `scripts/classify_enterprise_genai_tiers.py` and shipped inside the DB.
 * `make fix` drops it (full rebuild from sources) — so callers must tolerate
 * an empty result, and the page hides the chart rather than erroring.
 */
export function getEnterpriseTierRollup(): EnterpriseTierRollupRow[] {
  const db = getDb();
  const exists = db
    .prepare(
      `SELECT 1 FROM sqlite_master
       WHERE type = 'table' AND name = 'enterprise_genai_tier_rollup'`,
    )
    .get();
  if (!exists) return [];
  return db
    .prepare(
      `SELECT year, tier, n FROM enterprise_genai_tier_rollup
       ORDER BY year, tier`,
    )
    .all() as EnterpriseTierRollupRow[];
}

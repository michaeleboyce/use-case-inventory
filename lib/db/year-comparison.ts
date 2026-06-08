/**
 * 2024 ↔ 2025 cycle-comparison queries.
 *
 * Read-only consumption of two ETL-built tables:
 *   - `year_comparison`     — Phase 2 aggregate YoY rollups.
 *   - `use_case_year_links` — Phase 4 per-use-case lineage links.
 *
 * Re-exported from `@/lib/db`. All functions use the `getDb()` singleton
 * and prepared statements; rows are typed against `@/lib/types`.
 */

import { getDb } from "./shared/init";
import type {
  LineageSample,
  LineageStatus,
  LineageStatusCount,
  PerAgencyLineageRow,
  RetiredBreakdown,
  SilentlyDroppedAgencyRow,
  SilentlyDroppedRow,
  SilentlyDroppedStageBucket,
  SilentlyDroppedStageRow,
  SilentlyDroppedSummary,
  SilentlyDroppedGenAiRow,
  Tags2024Headlines,
  YearComparisonRow,
} from "../types";

/** The 2024-side filter every silently-dropped query uses. */
const SILENT_DROP_FILTER = `
  l.lineage_status = 'retired_2024'
  AND LOWER(COALESCE(u.dev_stage, '')) NOT LIKE '%retired%'
`;

/**
 * Recode the 2024 `dev_stage` free text onto the four buckets used by the
 * silently-dropped page. Anything that contains "retired" is *excluded* by
 * the calling queries, so this expression never produces a "retired" bucket.
 *
 *   deployed         → "Operation and Maintenance", "In production", "In mission"
 *   pilot            → "Implementation and Assessment"
 *   pre_deployment   → "Acquisition and/or Development", "Planned",
 *                      "Initiated", "Ideation", "Research or … Action Complete"
 *   other            → null / blank / unmapped
 *
 * The mapping mirrors `column_maps_2024.DEV_STAGE_RECODE_2024`.
 */
const STAGE_BUCKET_2024_SQL = `
  CASE
    WHEN u.dev_stage IN ('Operation and Maintenance', 'In production', 'In mission')
      THEN 'deployed'
    WHEN u.dev_stage = 'Implementation and Assessment'
      THEN 'pilot'
    WHEN u.dev_stage IN (
        'Acquisition and/or Development', 'Planned', 'Initiated',
        'Ideation', 'Research or  Administrative Action Complete'
      )
      THEN 'pre_deployment'
    ELSE 'other'
  END
`;

const DISSOLVED_AGENCY_ABBR = "USAID";

/**
 * 2024 deployment stages that count as a *live* capability for the
 * silently-dropped-GenAI callout — production/implementation, not planning or
 * research. Mirrors the dev_stage set in the feature spec.
 */
const LIVE_DEV_STAGES_2024 = [
  "Operation and Maintenance",
  "Implementation and Assessment",
  "In production",
  "Full operation",
] as const;

const LIVE_DEV_STAGES_2024_SQL = LIVE_DEV_STAGES_2024.map(
  (s) => `'${s}'`,
).join(", ");

/**
 * Every row of `year_comparison` — the `total`, per-`agency`, `stage`, and
 * `dev_method` rollups. Ordered so the caller can pick a dimension and get
 * a stable bucket order (largest 2025 count first within a dimension).
 */
export function getYearComparisonAggregates(): YearComparisonRow[] {
  return getDb()
    .prepare<[], YearComparisonRow>(`
      SELECT dimension, bucket, agency_id, count_2024, count_2025,
             delta, pct_change, comparability, notes
        FROM year_comparison
       ORDER BY dimension ASC, count_2025 DESC
    `)
    .all();
}

/** The five lineage_status counts across all of `use_case_year_links`. */
export function getLineageBreakdown(): LineageStatusCount[] {
  return getDb()
    .prepare<[], LineageStatusCount>(`
      SELECT lineage_status, COUNT(*) AS count
        FROM use_case_year_links
       GROUP BY lineage_status
       ORDER BY count DESC
    `)
    .all();
}

/**
 * Per-agency lineage rollup: for each agency, the counts of continued /
 * renamed / split / retired_2024 / new_2025, plus the agency's aggregate
 * 2024/2025 totals (from the `year_comparison` dimension=`agency` rows).
 * Joined to `agencies` for display names. Agencies present in either the
 * lineage links or the aggregate rollup appear in the result.
 */
export function getPerAgencyLineage(): PerAgencyLineageRow[] {
  return getDb()
    .prepare<[], PerAgencyLineageRow>(`
      WITH lineage AS (
        SELECT agency_id,
               SUM(lineage_status = 'continued')    AS continued,
               SUM(lineage_status = 'renamed')      AS renamed,
               SUM(lineage_status = 'split')        AS split,
               SUM(lineage_status = 'retired_2024') AS retired_2024,
               SUM(lineage_status = 'new_2025')     AS new_2025
          FROM use_case_year_links
         WHERE agency_id IS NOT NULL
         GROUP BY agency_id
      ),
      agg AS (
        SELECT agency_id, count_2024, count_2025, delta, pct_change
          FROM year_comparison
         WHERE dimension = 'agency' AND agency_id IS NOT NULL
      )
      SELECT a.id                              AS agency_id,
             a.abbreviation                    AS abbreviation,
             a.name                            AS name,
             COALESCE(agg.count_2024, 0)       AS count_2024,
             COALESCE(agg.count_2025, 0)       AS count_2025,
             COALESCE(agg.delta, 0)            AS delta,
             agg.pct_change                    AS pct_change,
             COALESCE(lineage.continued, 0)    AS continued,
             COALESCE(lineage.renamed, 0)      AS renamed,
             COALESCE(lineage.split, 0)        AS split,
             COALESCE(lineage.retired_2024, 0) AS retired_2024,
             COALESCE(lineage.new_2025, 0)     AS new_2025
        FROM agencies a
        JOIN lineage ON lineage.agency_id = a.id
        LEFT JOIN agg ON agg.agency_id = a.id
       ORDER BY count_2025 DESC, a.name COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Active-vs-already-retired split of the `retired_2024` links. Joins each
 * link's 2024 use case and reads `use_cases_2024.dev_stage`: a stage
 * containing "retired" means the agency already filed it as Retired; any
 * other stage means it was active in 2024 and silently dropped from 2025.
 *
 * This powers the headline caveat — ~600 active use cases disappeared.
 */
export function getRetiredBreakdown(): RetiredBreakdown {
  const row = getDb()
    .prepare<[], { total: number; already_retired: number; active: number }>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN LOWER(COALESCE(u.dev_stage, '')) LIKE '%retired%'
                 THEN 1 ELSE 0 END) AS already_retired,
        SUM(CASE WHEN LOWER(COALESCE(u.dev_stage, '')) LIKE '%retired%'
                 THEN 0 ELSE 1 END) AS active
      FROM use_case_year_links l
      JOIN use_cases_2024 u ON u.id = l.uc_2024_id
     WHERE l.lineage_status = 'retired_2024'
    `)
    .get();
  return {
    total: row?.total ?? 0,
    alreadyRetired: row?.already_retired ?? 0,
    active: row?.active ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Silently-dropped — /compare-years/silently-dropped                  */
/* ------------------------------------------------------------------ */

/**
 * Headline counts for the silently-dropped page:
 *   total            — all `retired_2024` lineage rows
 *   alreadyRetired   — already filed as Retired in 2024 (legitimately aged off)
 *   activeDropped    — active in 2024 and absent from 2025 (the gap)
 *   usaidActiveDropped     — subset attributable to dissolved USAID
 *   nonUsaidActiveDropped  — the compliance gap among 2025 filers
 *
 * Computed live; numbers will drift slightly with re-runs of the lineage
 * adjudication pass. The page rounds the headline values for display.
 */
export function getSilentlyDroppedSummary(): SilentlyDroppedSummary {
  const row = getDb()
    .prepare<
      [],
      {
        total: number;
        already_retired: number;
        active_dropped: number;
        usaid_active_dropped: number;
      }
    >(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE
              WHEN LOWER(COALESCE(u.dev_stage, '')) LIKE '%retired%'
              THEN 1 ELSE 0 END) AS already_retired,
        SUM(CASE
              WHEN LOWER(COALESCE(u.dev_stage, '')) NOT LIKE '%retired%'
              THEN 1 ELSE 0 END) AS active_dropped,
        SUM(CASE
              WHEN LOWER(COALESCE(u.dev_stage, '')) NOT LIKE '%retired%'
                AND l.agency_abbreviation = '${DISSOLVED_AGENCY_ABBR}'
              THEN 1 ELSE 0 END) AS usaid_active_dropped
      FROM use_case_year_links l
      JOIN use_cases_2024 u ON u.id = l.uc_2024_id
     WHERE l.lineage_status = 'retired_2024'
    `)
    .get();
  const total = row?.total ?? 0;
  const alreadyRetired = row?.already_retired ?? 0;
  const activeDropped = row?.active_dropped ?? 0;
  const usaidActiveDropped = row?.usaid_active_dropped ?? 0;
  return {
    total,
    alreadyRetired,
    activeDropped,
    usaidActiveDropped,
    nonUsaidActiveDropped: activeDropped - usaidActiveDropped,
  };
}

/**
 * Silently-dropped use cases bucketed by their 2024 deployment stage.
 * Excludes the dissolved-agency rows so the bars represent the compliance
 * gap, not the agency dissolution. Bucket order is fixed: deployed, pilot,
 * pre-deployment, other.
 */
export function getSilentlyDroppedByStage(): SilentlyDroppedStageRow[] {
  const rows = getDb()
    .prepare<[], { bucket: SilentlyDroppedStageBucket; count: number }>(`
      SELECT ${STAGE_BUCKET_2024_SQL} AS bucket, COUNT(*) AS count
        FROM use_case_year_links l
        JOIN use_cases_2024 u ON u.id = l.uc_2024_id
       WHERE ${SILENT_DROP_FILTER}
         AND l.agency_abbreviation != '${DISSOLVED_AGENCY_ABBR}'
       GROUP BY bucket
    `)
    .all();
  const ORDER: SilentlyDroppedStageBucket[] = [
    "deployed",
    "pilot",
    "pre_deployment",
    "other",
  ];
  const byBucket = new Map(rows.map((r) => [r.bucket, r.count]));
  return ORDER.map((b) => ({ bucket: b, count: byBucket.get(b) ?? 0 }));
}

/**
 * Per-agency silently-dropped ledger. `filed_2024` is the agency's total
 * 2024-filed use-case count, looked up via the `agencies` PK rather than
 * abbreviation (the 2024 source data uses some legacy codes — e.g. TREAS
 * for Treasury — that don't match the lineage rows).
 *
 * Includes USAID, flagged via `is_dissolved`, so the caller can render it
 * with a marker or filter it out for the headline ledger.
 */
export function getSilentlyDroppedByAgency(): SilentlyDroppedAgencyRow[] {
  const rows = getDb()
    .prepare<
      [],
      {
        agency_id: number | null;
        abbreviation: string;
        name: string;
        filed_2024: number;
        dropped: number;
      }
    >(`
      WITH dropped AS (
        SELECT l.agency_id, l.agency_abbreviation, COUNT(*) AS dropped
          FROM use_case_year_links l
          JOIN use_cases_2024 u ON u.id = l.uc_2024_id
         WHERE ${SILENT_DROP_FILTER}
         GROUP BY l.agency_id, l.agency_abbreviation
      ),
      filed_2024 AS (
        SELECT agency_id, COUNT(*) AS filed_2024
          FROM use_cases_2024
         GROUP BY agency_id
      )
      SELECT d.agency_id                AS agency_id,
             d.agency_abbreviation      AS abbreviation,
             COALESCE(a.name, d.agency_abbreviation) AS name,
             COALESCE(filed_2024.filed_2024, 0) AS filed_2024,
             d.dropped                  AS dropped
        FROM dropped d
        LEFT JOIN agencies a   ON a.id = d.agency_id
        LEFT JOIN filed_2024   ON filed_2024.agency_id = d.agency_id
       ORDER BY d.dropped DESC, d.agency_abbreviation ASC
    `)
    .all();
  return rows.map((r) => ({
    agency_id: r.agency_id,
    abbreviation: r.abbreviation,
    name: r.name,
    filed_2024: r.filed_2024,
    dropped: r.dropped,
    pct_dropped:
      r.filed_2024 > 0 ? r.dropped / r.filed_2024 : null,
    is_dissolved: r.abbreviation === DISSOLVED_AGENCY_ABBR,
  }));
}

/**
 * The full silently-dropped roster. By default excludes the dissolved-agency
 * rows so the table represents the compliance gap; pass `includeDissolved`
 * to fold USAID back in (flagged via `is_dissolved`).
 *
 * `purpose_benefits` and `outputs` are the original 2024 narrative columns
 * from `use_cases_2024`. They're returned verbatim — the caller can truncate
 * for the table view and render full text for §IV case studies.
 */
export function getSilentlyDroppedRows(opts?: {
  includeDissolved?: boolean;
}): SilentlyDroppedRow[] {
  const includeDissolved = opts?.includeDissolved ?? false;
  const where = includeDissolved
    ? SILENT_DROP_FILTER
    : `${SILENT_DROP_FILTER} AND l.agency_abbreviation != '${DISSOLVED_AGENCY_ABBR}'`;
  const rows = getDb()
    .prepare<
      [],
      {
        uc_2024_id: number;
        agency_abbreviation: string | null;
        agency_name: string | null;
        use_case_name: string | null;
        dev_stage: string | null;
        bureau: string | null;
        purpose_benefits: string | null;
        outputs: string | null;
      }
    >(`
      SELECT u.id                          AS uc_2024_id,
             l.agency_abbreviation         AS agency_abbreviation,
             COALESCE(a.name, u.agency)    AS agency_name,
             u.use_case_name               AS use_case_name,
             u.dev_stage                   AS dev_stage,
             u.bureau                      AS bureau,
             u.purpose_benefits            AS purpose_benefits,
             u.outputs                     AS outputs
        FROM use_case_year_links l
        JOIN use_cases_2024 u ON u.id = l.uc_2024_id
        LEFT JOIN agencies a  ON a.id = l.agency_id
       WHERE ${where}
       ORDER BY l.agency_abbreviation ASC, u.use_case_name COLLATE NOCASE ASC
    `)
    .all();
  return rows.map((r) => ({
    ...r,
    is_dissolved: r.agency_abbreviation === DISSOLVED_AGENCY_ABBR,
  }));
}

/**
 * A few representative use cases for one lineage status — illustrative
 * lists, not a full explorer. Joins the 2024 and 2025 use-case names so
 * renamed/continued rows can show the before/after pair.
 */
export function getLineageSamples(
  status: LineageStatus,
  limit = 5,
): LineageSample[] {
  return getDb()
    .prepare<[LineageStatus, number], LineageSample>(`
      SELECT l.lineage_status     AS lineage_status,
             l.agency_abbreviation AS agency_abbreviation,
             u24.use_case_name    AS name_2024,
             u25.use_case_name    AS name_2025,
             l.match_method       AS match_method,
             l.llm_reasoning      AS llm_reasoning
        FROM use_case_year_links l
        LEFT JOIN use_cases_2024 u24 ON u24.id = l.uc_2024_id
        LEFT JOIN use_cases     u25 ON u25.id = l.uc_2025_id
       WHERE l.lineage_status = ?
       ORDER BY l.match_score DESC NULLS LAST, l.id ASC
       LIMIT ?
    `)
    .all(status, limit);
}

/* ------------------------------------------------------------------ */
/* 2024 IFP-tag headlines                                              */
/* ------------------------------------------------------------------ */

/**
 * Headline IFP-tagged counts for the 2024 cycle, from
 * `use_case_tags_2024_canonical`. Computed live so the numbers track any
 * re-run of the 2024 tagging passes.
 */
export function getTags2024Headlines(): Tags2024Headlines {
  const row = getDb()
    .prepare<[], { total: number; genai: number; enterprise_wide: number }>(`
      SELECT
        COUNT(*)                                AS total,
        COALESCE(SUM(is_generative_ai), 0)      AS genai,
        COALESCE(SUM(is_enterprise_wide), 0)    AS enterprise_wide
      FROM use_case_tags_2024_canonical
    `)
    .get();
  return {
    total: row?.total ?? 0,
    genai: row?.genai ?? 0,
    enterprise_wide: row?.enterprise_wide ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Silently-dropped live GenAI                                          */
/* ------------------------------------------------------------------ */

/**
 * Use cases IFP tagged as generative AI that were in a live 2024 deployment
 * stage (production/implementation) yet were dropped from the 2025 inventory
 * without being filed as Retired. The sharp edge of the silently-dropped
 * finding: not just any churn, but active GenAI capability that vanished.
 *
 * Joins `use_case_year_links` (lineage) → `use_cases_2024` (narrative + stage)
 * → `use_case_tags_2024_canonical` (the IFP GenAI tag). Ordered by agency then
 * use-case name. Excludes the dissolved-agency rows so the list reflects the
 * compliance gap among agencies that still filed in 2025.
 */
export function getSilentlyDroppedGenAiRows(): SilentlyDroppedGenAiRow[] {
  return getDb()
    .prepare<[], SilentlyDroppedGenAiRow>(`
      SELECT u.id                       AS uc_2024_id,
             l.agency_abbreviation      AS agency_abbreviation,
             COALESCE(a.name, u.agency) AS agency_name,
             u.use_case_name            AS use_case_name,
             u.dev_stage                AS dev_stage,
             u.bureau                   AS bureau,
             u.purpose_benefits         AS purpose_benefits,
             u.outputs                  AS outputs,
             c.tool_product_name        AS tool_product_name,
             c.ai_sophistication        AS ai_sophistication
        FROM use_case_year_links l
        JOIN use_cases_2024 u
          ON u.id = l.uc_2024_id
        JOIN use_case_tags_2024_canonical c
          ON c.use_case_id_2024 = u.id
        LEFT JOIN agencies a
          ON a.id = l.agency_id
       WHERE l.lineage_status = 'retired_2024'
         AND c.is_generative_ai = 1
         AND u.dev_stage IN (${LIVE_DEV_STAGES_2024_SQL})
         AND l.agency_abbreviation != '${DISSOLVED_AGENCY_ABBR}'
       ORDER BY l.agency_abbreviation ASC, u.use_case_name COLLATE NOCASE ASC
    `)
    .all();
}

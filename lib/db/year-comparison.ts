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
  YearComparisonRow,
} from "../types";

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

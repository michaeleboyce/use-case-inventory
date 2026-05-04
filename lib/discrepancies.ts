/**
 * Server-side queries for the /discrepancies page.
 *
 * Reads `omb_match_audit` (one row per OMB↔DB match attempt) and joins to
 * `use_cases` and `omb_consolidated_rows` to surface a flat row shape for
 * the dashboard. Read-only and synchronous via better-sqlite3 prepared
 * statements.
 *
 * Pattern adapted from lib/hierarchy-db.ts: imports rawDb() from ./db,
 * defines small helper SELECTs, returns plain typed objects.
 */
import { rawDb } from "./db";
import type {
  DiscrepancyDetail,
  DiscrepancyDriftField,
  DiscrepancyFilter,
  DiscrepancyRow,
  DiscrepancyStatus,
  DiscrepancySummary,
} from "./types";

// The 10 canonical fields surfaced in the per-case side-by-side. Each maps
// to a column on use_cases (DB-side) and on omb_consolidated_rows (OMB
// mirror). Note the have_ato/has_ato divergence: the DB column is `has_ato`
// (intentional per migration m002), but the OMB mirror keeps the OMB-
// canonical `have_ato` name.
const CANONICAL_FIELDS = [
  "stage_of_development",
  "is_high_impact",
  "is_withheld",
  "topic_area",
  "ai_classification",
  "vendor_name",
  "have_ato",
  "has_pii",
  "has_custom_code",
  "bureau_component",
] as const;

// Status ordering for the table — most actionable first.
const STATUS_ORDER_SQL = `
  CASE a.match_status
    WHEN 'omb_only'         THEN 1
    WHEN 'db_only'          THEN 2
    WHEN 'suggested_rename' THEN 3
    WHEN 'duplicate_in_omb' THEN 4
    WHEN 'matched_fuzzy'    THEN 5
    WHEN 'matched_exact'    THEN 6
    ELSE 7
  END
`;

/** Top-level counts by match_status + total drifting pairs. */
export function getDiscrepancySummary(): DiscrepancySummary {
  const db = rawDb();
  const rows = db
    .prepare<[], { match_status: DiscrepancyStatus; n: number }>(
      `SELECT match_status, COUNT(*) AS n FROM omb_match_audit GROUP BY match_status`,
    )
    .all();
  const map: Partial<Record<DiscrepancyStatus, number>> = {};
  for (const r of rows) map[r.match_status] = r.n;

  const drift = db
    .prepare<[], { n: number }>(
      `SELECT COUNT(*) AS n FROM omb_match_audit
       WHERE drift_fields_json IS NOT NULL AND drift_fields_json != '{}'`,
    )
    .get();

  const matched_exact = map.matched_exact ?? 0;
  const matched_fuzzy = map.matched_fuzzy ?? 0;
  return {
    matched_exact,
    matched_fuzzy,
    suggested_rename: map.suggested_rename ?? 0,
    omb_only: map.omb_only ?? 0,
    db_only: map.db_only ?? 0,
    duplicate_in_omb: map.duplicate_in_omb ?? 0,
    total_with_drift: drift?.n ?? 0,
    total_pairs_compared: matched_exact + matched_fuzzy,
  };
}

/** Filtered list for the table. Joins audit + use_cases + omb_consolidated_rows. */
export function getDiscrepancyRows(filter: DiscrepancyFilter = {}): DiscrepancyRow[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.status && filter.status.length > 0) {
    where.push(`a.match_status IN (${filter.status.map(() => "?").join(",")})`);
    params.push(...filter.status);
  }
  if (filter.agency) {
    where.push(`a.agency_abbreviation = ?`);
    params.push(filter.agency);
  }
  if (filter.hasDrift) {
    where.push(`a.drift_fields_json IS NOT NULL AND a.drift_fields_json != '{}'`);
  }
  if (filter.unresolvedOnly) {
    where.push(`a.resolved_at IS NULL`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  // SQLite has json_each but not json_object_keys. Counting json_each rows
  // gives the number of top-level keys in the drift dict.
  const driftCountSql = `
    CASE
      WHEN a.drift_fields_json IS NULL OR a.drift_fields_json = '{}' THEN 0
      ELSE (SELECT COUNT(*) FROM json_each(a.drift_fields_json))
    END
  `;
  const sql = `
    SELECT
      a.id                        AS audit_id,
      a.match_status              AS match_status,
      a.match_score               AS match_score,
      a.agency_abbreviation       AS agency_abbreviation,
      a.use_case_name             AS use_case_name,
      a.use_case_id_db            AS db_use_case_id,
      uc.use_case_id              AS db_use_case_id_text,
      uc.slug                     AS db_use_case_slug,
      a.omb_row_id                AS omb_row_id,
      o.use_case_id_omb           AS omb_use_case_id,
      ${driftCountSql}            AS drift_field_count,
      a.resolved_at               AS resolved_at
    FROM omb_match_audit a
    LEFT JOIN use_cases uc ON uc.id = a.use_case_id_db
    LEFT JOIN omb_consolidated_rows o ON o.id = a.omb_row_id
    ${whereSql}
    ORDER BY ${STATUS_ORDER_SQL}, a.agency_abbreviation, a.use_case_name
  `;
  return rawDb().prepare<unknown[], DiscrepancyRow>(sql).all(...params);
}

/** Detail for a single audit row — both sides of the diff. */
export function getDiscrepancyDetail(auditId: number): DiscrepancyDetail | null {
  const dbAliases = CANONICAL_FIELDS.map((f) => {
    // DB-side column for have_ato is `has_ato`; everything else is identity.
    const dbCol = f === "have_ato" ? "has_ato" : f;
    return `uc.${dbCol} AS db_${f}`;
  }).join(", ");
  const ombAliases = CANONICAL_FIELDS.map((f) => `o.${f} AS omb_${f}`).join(", ");

  const sql = `
    SELECT
      a.id                  AS audit_id,
      a.match_status        AS match_status,
      a.match_score         AS match_score,
      a.agency_abbreviation AS agency_abbreviation,
      a.use_case_name       AS use_case_name,
      a.use_case_id_db      AS db_use_case_id,
      uc.use_case_id        AS db_use_case_id_text,
      uc.slug               AS db_use_case_slug,
      a.omb_row_id          AS omb_row_id,
      o.use_case_id_omb     AS omb_use_case_id,
      a.drift_fields_json   AS drift_fields_json,
      a.resolved_at         AS resolved_at,
      ${dbAliases},
      ${ombAliases}
    FROM omb_match_audit a
    LEFT JOIN use_cases uc ON uc.id = a.use_case_id_db
    LEFT JOIN omb_consolidated_rows o ON o.id = a.omb_row_id
    WHERE a.id = ?
  `;

  const row = rawDb()
    .prepare<[number], Record<string, unknown>>(sql)
    .get(auditId);
  if (!row) return null;

  const drift_fields_json = (row.drift_fields_json as string | null) ?? "{}";
  const driftObj = JSON.parse(drift_fields_json) as Record<
    string,
    { db?: string | null; omb?: string | null } | undefined
  >;
  const drift: DiscrepancyDriftField[] = Object.entries(driftObj).map(
    ([field, vals]) => ({
      field,
      db_value: vals?.db ?? null,
      omb_value: vals?.omb ?? null,
    }),
  );

  const audit: DiscrepancyRow = {
    audit_id: row.audit_id as number,
    match_status: row.match_status as DiscrepancyStatus,
    match_score: row.match_score as number | null,
    agency_abbreviation: row.agency_abbreviation as string | null,
    use_case_name: row.use_case_name as string | null,
    db_use_case_id: row.db_use_case_id as number | null,
    db_use_case_id_text: row.db_use_case_id_text as string | null,
    db_use_case_slug: row.db_use_case_slug as string | null,
    omb_row_id: row.omb_row_id as number | null,
    omb_use_case_id: row.omb_use_case_id as string | null,
    drift_field_count: drift.length,
    resolved_at: row.resolved_at as string | null,
  };

  const hasDb = audit.db_use_case_id != null;
  const hasOmb = audit.omb_row_id != null;
  const db_row: Record<string, string | null> | null = hasDb
    ? Object.fromEntries(
        CANONICAL_FIELDS.map((f) => [f, (row[`db_${f}`] as string | null) ?? null]),
      )
    : null;
  const omb_row: Record<string, string | null> | null = hasOmb
    ? Object.fromEntries(
        CANONICAL_FIELDS.map((f) => [f, (row[`omb_${f}`] as string | null) ?? null]),
      )
    : null;

  return { audit, drift, db_row, omb_row };
}

/** Distinct agencies with at least one non-exact-match row. Powers the dropdown. */
export function getDiscrepancyAgencies(): Array<{ agency: string; n: number }> {
  return rawDb()
    .prepare<[], { agency: string; n: number }>(
      `SELECT agency_abbreviation AS agency, COUNT(*) AS n
       FROM omb_match_audit
       WHERE match_status != 'matched_exact'
         AND agency_abbreviation IS NOT NULL
       GROUP BY agency_abbreviation
       ORDER BY n DESC, agency_abbreviation ASC`,
    )
    .all();
}

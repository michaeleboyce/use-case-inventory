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
import { rawDb } from "../db";
import { buildResolutionKey, getResolutionMap } from "../resolutions";
import type {
  DiscrepancyDetail,
  DiscrepancyDriftField,
  DiscrepancyFilter,
  DiscrepancyPattern,
  DiscrepancyPatternKind,
  DiscrepancyRow,
  DiscrepancyStatus,
  DiscrepancySummary,
  ResolutionReason,
} from "../types";

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

// Status ordering for the table — most actionable first. `consolidated_upstream`
// slots just below `db_only` (it's an explained subset of "DB row, no OMB
// match"); user can still drill in to verify the aggregator's identity.
const STATUS_ORDER_SQL = `
  CASE a.match_status
    WHEN 'omb_only'             THEN 1
    WHEN 'db_only'              THEN 2
    WHEN 'consolidated_upstream' THEN 3
    WHEN 'suggested_rename'     THEN 4
    WHEN 'duplicate_in_omb'     THEN 5
    WHEN 'matched_fuzzy'        THEN 6
    WHEN 'matched_exact'        THEN 7
    ELSE 8
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
    consolidated_upstream: map.consolidated_upstream ?? 0,
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
  // Note: filter.unresolvedOnly is applied AFTER the JSON-overlay below,
  // because the authoritative resolved_at lives in the JSON file (the DB
  // column is reset to NULL on every ETL re-run since it's not a curated
  // input). Filtering here would over-reject.

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
      a.resolved_at               AS resolved_at,
      a.consolidated_into_omb_id  AS consolidated_into_omb_id
    FROM omb_match_audit a
    LEFT JOIN use_cases uc ON uc.id = a.use_case_id_db
    LEFT JOIN omb_consolidated_rows o ON o.id = a.omb_row_id
    ${whereSql}
    ORDER BY ${STATUS_ORDER_SQL}, a.agency_abbreviation, a.use_case_name
  `;
  const rows = rawDb().prepare<unknown[], DiscrepancyRow>(sql).all(...params);
  const resolutions = getResolutionMap();
  const overlaid = rows.map((r) => {
    const res = resolutions.get(
      buildResolutionKey(r.agency_abbreviation, r.use_case_name),
    );
    return res ? { ...r, resolved_at: res.resolved_at } : r;
  });
  return filter.unresolvedOnly
    ? overlaid.filter((r) => r.resolved_at == null)
    : overlaid;
}

/** Detail for a single audit row — both sides of the diff. */
export function getDiscrepancyDetail(auditId: number): DiscrepancyDetail | null {
  const dbAliases = CANONICAL_FIELDS.map((f) => {
    // DB-side column for have_ato is `has_ato`; everything else is identity.
    const dbCol = f === "have_ato" ? "has_ato" : f;
    return `uc.${dbCol} AS db_${f}`;
  }).join(", ");
  const ombAliases = CANONICAL_FIELDS.map((f) => `o.${f} AS omb_${f}`).join(", ");

  // Detect whether `use_cases.source_file` exists at runtime — m001
  // guarantees it, but defensive checks keep this resilient against
  // schema drift on unrelated branches / older DB snapshots.
  const useCaseCols = new Set(
    rawDb()
      .prepare<[], { name: string }>("SELECT name FROM pragma_table_info('use_cases')")
      .all()
      .map((r) => r.name),
  );
  const dbSourceFileExpr = useCaseCols.has("source_file")
    ? "uc.source_file"
    : "NULL";
  const dbCreatedAtExpr = useCaseCols.has("created_at")
    ? "uc.created_at"
    : "NULL";

  // Aliased join to the OMB aggregator row when consolidated_into_omb_id
  // is set. Always LEFT JOIN; results are null for non-consolidated audits.
  const sql = `
    SELECT
      a.id                       AS audit_id,
      a.match_status             AS match_status,
      a.match_score              AS match_score,
      a.agency_abbreviation      AS agency_abbreviation,
      a.use_case_name            AS use_case_name,
      a.use_case_id_db           AS db_use_case_id,
      uc.use_case_id             AS db_use_case_id_text,
      uc.slug                    AS db_use_case_slug,
      a.omb_row_id               AS omb_row_id,
      o.use_case_id_omb          AS omb_use_case_id,
      a.drift_fields_json        AS drift_fields_json,
      a.resolved_at              AS resolved_at,
      a.consolidated_into_omb_id AS consolidated_into_omb_id,
      ${dbSourceFileExpr}        AS db_source_file,
      ${dbCreatedAtExpr}         AS db_ingested_at,
      o.ingest_source_file       AS omb_source_file,
      o.row_index_in_file        AS omb_source_row,
      o.ingest_run_at            AS omb_ingested_at,
      co.use_case_name           AS consolidated_into_omb_name,
      co.bureau_component        AS consolidated_into_omb_bureau,
      ${dbAliases},
      ${ombAliases}
    FROM omb_match_audit a
    LEFT JOIN use_cases uc ON uc.id = a.use_case_id_db
    LEFT JOIN omb_consolidated_rows o ON o.id = a.omb_row_id
    LEFT JOIN omb_consolidated_rows co ON co.id = a.consolidated_into_omb_id
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

  const agency = row.agency_abbreviation as string | null;
  const useCaseName = row.use_case_name as string | null;
  const overlay = getResolutionMap().get(
    buildResolutionKey(agency, useCaseName),
  );

  const audit: DiscrepancyRow = {
    audit_id: row.audit_id as number,
    match_status: row.match_status as DiscrepancyStatus,
    match_score: row.match_score as number | null,
    agency_abbreviation: agency,
    use_case_name: useCaseName,
    db_use_case_id: row.db_use_case_id as number | null,
    db_use_case_id_text: row.db_use_case_id_text as string | null,
    db_use_case_slug: row.db_use_case_slug as string | null,
    omb_row_id: row.omb_row_id as number | null,
    omb_use_case_id: row.omb_use_case_id as string | null,
    drift_field_count: drift.length,
    resolved_at: overlay?.resolved_at ?? (row.resolved_at as string | null),
    consolidated_into_omb_id: (row.consolidated_into_omb_id as number | null) ?? null,
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

  return {
    audit,
    drift,
    db_row,
    omb_row,
    resolution_note: overlay?.note ?? null,
    resolution_reason: (overlay?.reason ?? null) as ResolutionReason | null,
    consolidated_into_omb_id: audit.consolidated_into_omb_id ?? null,
    consolidated_into_omb_name: (row.consolidated_into_omb_name as string | null) ?? null,
    consolidated_into_omb_bureau: (row.consolidated_into_omb_bureau as string | null) ?? null,
    db_source_file: (row.db_source_file as string | null) ?? null,
    db_source_row: null,
    db_ingested_at: (row.db_ingested_at as string | null) ?? null,
    omb_source_file: (row.omb_source_file as string | null) ?? null,
    omb_source_row: (row.omb_source_row as number | null) ?? null,
    omb_ingested_at: (row.omb_ingested_at as string | null) ?? null,
  };
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

// ─── Pattern detection ────────────────────────────────────────────────────
//
// Walks the audit table looking for clusters that explain large chunks of
// the page at once. Four kinds:
//   1. consolidation       — agency rolled up product-specific rows into an
//                            OMB generic-category aggregator
//   2. omb_duplicate_cluster — OMB filed the same row N times (≥3)
//   3. bureau_split        — same-named row appears in multiple bureaus,
//                            misclassified as duplicate
//   4. name_drift_cluster  — agency has many suggested_rename rows in the
//                            0.40–0.70 fuzzy band (taxonomy mismatch)
//
// Returns at most 6 patterns, sorted by affected-row count desc.

interface RawAuditPatternRow {
  audit_id: number;
  match_status: DiscrepancyStatus;
  match_score: number | null;
  agency: string | null;
  name: string | null;
  bureau: string | null;
  consolidated_into_omb_id: number | null;
}

function normalizeName(s: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rootProductToken(s: string | null): string {
  const norm = normalizeName(s);
  const tokens = norm.split(" ").filter(
    (t) => t.length > 2 && !["the", "for", "and", "with", "ai", "use", "case"].includes(t),
  );
  return tokens[0] ?? norm;
}

function makePattern(opts: {
  id: string;
  kind: DiscrepancyPatternKind;
  agency: string;
  title: string;
  hypothesis: string;
  auditIds: number[];
  suggested_reason: ResolutionReason;
  filter_url: string;
}): DiscrepancyPattern {
  return {
    id: opts.id,
    kind: opts.kind,
    agency: opts.agency,
    title: opts.title,
    hypothesis: opts.hypothesis,
    affected_audit_ids: opts.auditIds,
    sample_audit_ids: opts.auditIds.slice(0, 3),
    count: opts.auditIds.length,
    suggested_reason: opts.suggested_reason,
    filter_url: opts.filter_url,
  };
}

export function getDiscrepancyPatterns(): DiscrepancyPattern[] {
  const rows = rawDb()
    .prepare<[], RawAuditPatternRow>(
      `SELECT
         a.id                       AS audit_id,
         a.match_status             AS match_status,
         a.match_score              AS match_score,
         a.agency_abbreviation      AS agency,
         a.use_case_name            AS name,
         uc.bureau_component        AS bureau,
         a.consolidated_into_omb_id AS consolidated_into_omb_id
       FROM omb_match_audit a
       LEFT JOIN use_cases uc ON uc.id = a.use_case_id_db
       WHERE a.match_status != 'matched_exact'
         AND a.agency_abbreviation IS NOT NULL`,
    )
    .all();

  // Drop rows already resolved.
  const resolutions = getResolutionMap();
  const unresolved = rows.filter(
    (r) => !resolutions.get(buildResolutionKey(r.agency, r.name))?.resolved_at,
  );

  const patterns: DiscrepancyPattern[] = [];

  // 1. Consolidation clusters: (agency, consolidated_into_omb_id)
  const consolidationBuckets = new Map<string, RawAuditPatternRow[]>();
  for (const r of unresolved) {
    if (r.match_status !== "consolidated_upstream" || r.consolidated_into_omb_id == null) continue;
    const key = `${r.agency}::${r.consolidated_into_omb_id}`;
    if (!consolidationBuckets.has(key)) consolidationBuckets.set(key, []);
    consolidationBuckets.get(key)!.push(r);
  }
  for (const [, bucket] of consolidationBuckets) {
    if (bucket.length < 2) continue;
    const agency = bucket[0].agency!;
    const ombId = bucket[0].consolidated_into_omb_id!;
    patterns.push(
      makePattern({
        id: `${agency.toLowerCase()}-consolidation-${ombId}`,
        kind: "consolidation",
        agency,
        title: `${agency} · ${bucket.length} product-specific rows rolled into one OMB category`,
        hypothesis: `OMB consolidated ${bucket.length} agency-filed product rows into a single generic category row (OMB row #${ombId}). Likely intentional upstream rollup.`,
        auditIds: bucket.map((r) => r.audit_id),
        suggested_reason: "consolidated_upstream",
        filter_url: `/discrepancies?status=consolidated_upstream&agency=${encodeURIComponent(agency)}`,
      }),
    );
  }

  // 2. OMB duplicate clusters: (agency, normalized name) where status=duplicate_in_omb
  const dupBuckets = new Map<string, RawAuditPatternRow[]>();
  for (const r of unresolved) {
    if (r.match_status !== "duplicate_in_omb") continue;
    const key = `${r.agency}::${normalizeName(r.name)}`;
    if (!dupBuckets.has(key)) dupBuckets.set(key, []);
    dupBuckets.get(key)!.push(r);
  }
  for (const [key, bucket] of dupBuckets) {
    if (bucket.length < 3) continue;
    const agency = bucket[0].agency!;
    const bureaus = new Set(bucket.map((r) => r.bureau ?? ""));
    if (bureaus.size > 1) {
      // Cross-bureau — treat as bureau_split (handled below). Skip here.
      continue;
    }
    patterns.push(
      makePattern({
        id: `${agency.toLowerCase()}-omb-dup-${key.split("::")[1].replace(/\s+/g, "-").slice(0, 40)}`,
        kind: "omb_duplicate_cluster",
        agency,
        title: `${agency} · OMB filed "${bucket[0].name}" ${bucket.length}×`,
        hypothesis: `OMB's consolidated XLSX has ${bucket.length} verbatim repetitions of this row in a single bureau. Likely OMB-side data entry artifact.`,
        auditIds: bucket.map((r) => r.audit_id),
        suggested_reason: "genuine_duplicate",
        filter_url: `/discrepancies?status=duplicate_in_omb&agency=${encodeURIComponent(agency)}&q=${encodeURIComponent(bucket[0].name ?? "")}`,
      }),
    );
  }

  // 3. Bureau-split clusters: same root product token across multiple bureaus
  const splitBuckets = new Map<string, RawAuditPatternRow[]>();
  for (const r of unresolved) {
    if (r.match_status !== "duplicate_in_omb") continue;
    const root = rootProductToken(r.name);
    if (!root || root.length < 3) continue;
    const key = `${r.agency}::${root}`;
    if (!splitBuckets.has(key)) splitBuckets.set(key, []);
    splitBuckets.get(key)!.push(r);
  }
  for (const [key, bucket] of splitBuckets) {
    const bureaus = new Set(bucket.map((r) => r.bureau ?? ""));
    if (bucket.length < 3 || bureaus.size < 2) continue;
    const agency = bucket[0].agency!;
    const root = key.split("::")[1];
    patterns.push(
      makePattern({
        id: `${agency.toLowerCase()}-bureau-split-${root}`,
        kind: "bureau_split",
        agency,
        title: `${agency} · "${root}" appears in ${bureaus.size} bureaus as variant rows`,
        hypothesis: `${bucket.length} rows sharing the "${root}" product root across ${bureaus.size} different bureaus. Flagged as duplicates but likely legitimately distinct bureau-specific deployments.`,
        auditIds: bucket.map((r) => r.audit_id),
        suggested_reason: "legitimately_distinct",
        filter_url: `/discrepancies?status=duplicate_in_omb&agency=${encodeURIComponent(agency)}&q=${encodeURIComponent(root)}`,
      }),
    );
  }

  // 4. Name-drift clusters: per-agency suggested_rename in fuzzy band
  const driftBuckets = new Map<string, RawAuditPatternRow[]>();
  for (const r of unresolved) {
    if (r.match_status !== "suggested_rename") continue;
    if (r.match_score == null || r.match_score < 0.4 || r.match_score > 0.7) continue;
    const key = r.agency!;
    if (!driftBuckets.has(key)) driftBuckets.set(key, []);
    driftBuckets.get(key)!.push(r);
  }
  for (const [agency, bucket] of driftBuckets) {
    if (bucket.length < 5) continue;
    patterns.push(
      makePattern({
        id: `${agency.toLowerCase()}-name-drift`,
        kind: "name_drift_cluster",
        agency,
        title: `${agency} · ${bucket.length} rows with low-confidence name matches (0.4–0.7)`,
        hypothesis: `Agency-filed names use a different taxonomy than OMB's consolidated names. ${bucket.length} rows fell into the suggested-rename band — taxonomy alignment, not data loss.`,
        auditIds: bucket.map((r) => r.audit_id),
        suggested_reason: "renamed",
        filter_url: `/discrepancies?status=suggested_rename&agency=${encodeURIComponent(agency)}`,
      }),
    );
  }

  patterns.sort((a, b) => b.count - a.count);
  return patterns.slice(0, 6);
}

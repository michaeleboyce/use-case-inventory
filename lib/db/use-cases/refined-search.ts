import { getDb } from "../shared/init";
import { USE_CASE_SELECT } from "../shared/sql-fragments";
import type {
  ConsolidatedUseCase,
  ConsolidatedWithTags,
  UseCaseFilterInput,
  UseCaseRow,
  UseCaseTag,
  UseCaseWithTags,
} from "../../types";
import { attachTagsToUseCases, type JoinedUseCaseRow } from "./shared";
import {
  buildConsolidatedBranch,
  buildUseCaseBranch,
  hasUseCaseOnlyFilter,
  renderParams,
  renderWhereSql,
} from "./filter-builder";

// -----------------------------------------------------------------------------
// Faceted search (the explorer)
// -----------------------------------------------------------------------------

/**
 * Full-text / faceted search over inventory entries. All filters are optional
 * and combined with AND. Pagination via `limit` / `offset`.
 *
 * The explorer defaults to `entryKind = "use_case"` (3,549 individual rows),
 * because most filters (search text, topic_area, vendor_name, hi_*) only exist
 * on `use_cases`. Drill-throughs from product / agency / template detail pages
 * pass `entryKind: "all"` so that link counts (which include consolidated
 * edges) match the resulting row count. `entryKind: "consolidated"` shows only
 * the 900 OMB consolidated rows.
 *
 * Filters that touch a column only on `use_cases` (stage, ai_classification,
 * is_high_impact, vendor, bureau_component, topic_area) silently elide the
 * consolidated arm — there is nothing to match.
 */
export function getUseCasesFiltered(
  filters: UseCaseFilterInput = {},
): { rows: UseCaseRow[]; total: number } {
  const entryKind = filters.entryKind ?? "use_case";
  const limit = Math.min(filters.limit ?? 100, 1000);
  const offset = filters.offset ?? 0;

  const includeUseCase = entryKind === "use_case" || entryKind === "all";
  const includeConsolidated =
    (entryKind === "consolidated" || entryKind === "all") &&
    !hasUseCaseOnlyFilter(filters);

  const ucBranch = buildUseCaseBranch(filters);
  const cBranch = buildConsolidatedBranch(
    filters,
    ucBranch.tagWhere,
    ucBranch.tagParams,
  );

  const ucWhereSql = renderWhereSql(ucBranch);
  const ucCombinedParams = renderParams(ucBranch);
  const ucTagJoin = ucBranch.joinTags
    ? "LEFT JOIN use_case_tags tag ON tag.use_case_id = uc.id"
    : "";

  const cWhereSql = renderWhereSql(cBranch);
  const cCombinedParams = renderParams(cBranch);
  const cTagJoin = cBranch.joinTags
    ? "LEFT JOIN use_case_tags tag ON tag.consolidated_use_case_id = c.id"
    : "";

  // ------------------------------------------------------------------
  // Counts. Run only the arms we'll actually fetch.
  // ------------------------------------------------------------------
  const db = getDb();
  let useCaseTotal = 0;
  let consolidatedTotal = 0;

  if (includeUseCase) {
    const ucCountSql = `
      SELECT COUNT(*) AS c
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
        ${ucTagJoin}
        ${ucWhereSql}
    `;
    useCaseTotal = (
      db
        .prepare<(string | number)[], { c: number }>(ucCountSql)
        .get(...ucCombinedParams) ?? { c: 0 }
    ).c;
  }
  if (includeConsolidated) {
    const cCountSql = `
      SELECT COUNT(*) AS c
        FROM consolidated_use_cases c
        JOIN agencies a ON a.id = c.agency_id
        ${cTagJoin}
        ${cWhereSql}
    `;
    consolidatedTotal = (
      db
        .prepare<(string | number)[], { c: number }>(cCountSql)
        .get(...cCombinedParams) ?? { c: 0 }
    ).c;
  }
  const total = useCaseTotal + consolidatedTotal;

  // ------------------------------------------------------------------
  // Fetch the page window. Three cases:
  //   1. use_case-only      → fetch from use_cases directly (fast path)
  //   2. consolidated-only  → fetch from consolidated_use_cases directly
  //   3. both ("all")       → window-pass UNION ALL on (kind, id, sort_key)
  //                           to find the page slice, then bulk-fetch each
  //                           kind by id.
  // ------------------------------------------------------------------
  const rows: UseCaseRow[] = [];

  if (includeUseCase && !includeConsolidated) {
    const sql = `
      ${USE_CASE_SELECT.replace("FROM use_cases uc", `FROM use_cases uc ${ucTagJoin}`)}
      ${ucWhereSql}
      ORDER BY uc.use_case_name COLLATE NOCASE ASC
      LIMIT ? OFFSET ?
    `;
    const ucRows = db
      .prepare<(string | number)[], JoinedUseCaseRow>(sql)
      .all(...ucCombinedParams, limit, offset);
    for (const r of attachTagsToUseCases(ucRows)) {
      rows.push({ kind: "use_case", ...r });
    }
  } else if (includeConsolidated && !includeUseCase) {
    rows.push(
      ...fetchConsolidatedRows(
        cTagJoin,
        cWhereSql,
        cCombinedParams,
        limit,
        offset,
      ),
    );
  } else if (includeUseCase && includeConsolidated) {
    const windowSql = `
      WITH all_entries AS (
        SELECT 'use_case' AS kind, uc.id AS entry_id,
               uc.use_case_name AS sort_key
          FROM use_cases uc
          JOIN agencies a ON a.id = uc.agency_id
          ${ucTagJoin}
          ${ucWhereSql}
        UNION ALL
        SELECT 'consolidated' AS kind, c.id AS entry_id,
               c.ai_use_case AS sort_key
          FROM consolidated_use_cases c
          JOIN agencies a ON a.id = c.agency_id
          ${cTagJoin}
          ${cWhereSql}
      )
      SELECT kind, entry_id
        FROM all_entries
       ORDER BY sort_key COLLATE NOCASE ASC
       LIMIT ? OFFSET ?
    `;
    const window = db
      .prepare<
        (string | number)[],
        { kind: "use_case" | "consolidated"; entry_id: number }
      >(windowSql)
      .all(...ucCombinedParams, ...cCombinedParams, limit, offset);

    const ucIds = window
      .filter((w) => w.kind === "use_case")
      .map((w) => w.entry_id);
    const cIds = window
      .filter((w) => w.kind === "consolidated")
      .map((w) => w.entry_id);

    const ucById = new Map<number, UseCaseWithTags>();
    if (ucIds.length > 0) {
      const ph = ucIds.map(() => "?").join(",");
      const ucRows = db
        .prepare<number[], JoinedUseCaseRow>(
          `${USE_CASE_SELECT} WHERE uc.id IN (${ph})`,
        )
        .all(...ucIds);
      for (const r of attachTagsToUseCases(ucRows)) ucById.set(r.id, r);
    }

    const cById = new Map<number, ConsolidatedWithTags>();
    if (cIds.length > 0) {
      const ph = cIds.map(() => "?").join(",");
      const cRows = db
        .prepare<
          number[],
          ConsolidatedUseCase & {
            agency_name: string;
            agency_abbreviation: string;
          }
        >(
          `SELECT c.*, a.name AS agency_name, a.abbreviation AS agency_abbreviation
             FROM consolidated_use_cases c
             JOIN agencies a ON a.id = c.agency_id
            WHERE c.id IN (${ph})`,
        )
        .all(...cIds);
      const tags = db
        .prepare<number[], UseCaseTag>(
          `SELECT * FROM use_case_tags WHERE consolidated_use_case_id IN (${ph})`,
        )
        .all(...cIds);
      const tagById = new Map<number, UseCaseTag>();
      for (const t of tags) {
        if (t.consolidated_use_case_id != null)
          tagById.set(t.consolidated_use_case_id, t);
      }
      for (const r of cRows) {
        cById.set(r.id, { ...r, tags: tagById.get(r.id) ?? null });
      }
    }

    // Re-emit in window order so pagination ordering is preserved.
    for (const w of window) {
      if (w.kind === "use_case") {
        const r = ucById.get(w.entry_id);
        if (r) rows.push({ kind: "use_case", ...r });
      } else {
        const r = cById.get(w.entry_id);
        if (r) rows.push({ kind: "consolidated", ...r });
      }
    }
  }

  return { rows, total };
}

/** Fetch a window of consolidated_use_cases rows with tags attached.
 *  Used when entryKind === "consolidated". */
function fetchConsolidatedRows(
  tagJoin: string,
  whereSql: string,
  params: (string | number)[],
  limit: number,
  offset: number,
): UseCaseRow[] {
  const db = getDb();
  const sql = `
    SELECT c.*,
           a.name AS agency_name,
           a.abbreviation AS agency_abbreviation
      FROM consolidated_use_cases c
      JOIN agencies a ON a.id = c.agency_id
      ${tagJoin}
      ${whereSql}
     ORDER BY c.ai_use_case COLLATE NOCASE ASC
     LIMIT ? OFFSET ?
  `;
  const rows = db
    .prepare<
      (string | number)[],
      ConsolidatedUseCase & { agency_name: string; agency_abbreviation: string }
    >(sql)
    .all(...params, limit, offset);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => "?").join(",");
  const tags = db
    .prepare<number[], UseCaseTag>(
      `SELECT * FROM use_case_tags WHERE consolidated_use_case_id IN (${ph})`,
    )
    .all(...ids);
  const tagById = new Map<number, UseCaseTag>();
  for (const t of tags) {
    if (t.consolidated_use_case_id != null)
      tagById.set(t.consolidated_use_case_id, t);
  }
  return rows.map((r) => ({
    kind: "consolidated" as const,
    ...r,
    tags: tagById.get(r.id) ?? null,
  }));
}

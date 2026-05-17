import { getDb } from "../shared/init";
import { STAGE_BUCKET_SQL, USE_CASE_SELECT } from "../shared/sql-fragments";
import type { ConsolidatedUseCase, ConsolidatedWithTags, UseCaseFilterInput, UseCaseRow, UseCaseTag, UseCaseWithTags } from "../../types";
import { attachTagsToUseCases, type JoinedUseCaseRow } from "./shared";

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

  // Filters with no analog on consolidated_use_cases: if any is set, drop the
  // consolidated arm regardless of entryKind — there's no matching column.
  const hasUseCaseOnlyFilter =
    filters.stage != null ||
    (filters.stageBuckets != null && filters.stageBuckets.length > 0) ||
    filters.aiClassification != null ||
    filters.isHighImpact != null ||
    filters.vendor != null ||
    (filters.bureaus != null && filters.bureaus.length > 0) ||
    (filters.topicAreas != null && filters.topicAreas.length > 0);

  const includeUseCase = entryKind === "use_case" || entryKind === "all";
  const includeConsolidated =
    (entryKind === "consolidated" || entryKind === "all") &&
    !hasUseCaseOnlyFilter;

  // ------------------------------------------------------------------
  // Build the use_case branch.
  // ------------------------------------------------------------------
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.agencyId != null) {
    where.push("uc.agency_id = ?");
    params.push(filters.agencyId);
  }
  if (filters.agencyAbbr) {
    where.push("LOWER(a.abbreviation) = LOWER(?)");
    params.push(filters.agencyAbbr);
  }
  if (filters.stage) {
    where.push("uc.stage_of_development = ?");
    params.push(filters.stage);
  }
  if (filters.stageBuckets && filters.stageBuckets.length > 0) {
    // Normalized OMB M-25-21 buckets. Raw column has 30+ formatting variants
    // (e.g. "a) Pre-deployment – The use case is in a development...",
    // "Pre-deployment", "a) Pre-deployment - ..."). Bucket via substring match.
    const bucketExprs = filters.stageBuckets.map(() => `${STAGE_BUCKET_SQL} = ?`);
    where.push(`(${bucketExprs.join(" OR ")})`);
    for (const b of filters.stageBuckets) params.push(b);
  }
  if (filters.aiClassification) {
    where.push("uc.ai_classification = ?");
    params.push(filters.aiClassification);
  }
  if (filters.isHighImpact) {
    where.push("uc.is_high_impact = ?");
    params.push(filters.isHighImpact);
  }
  if (filters.productId != null) {
    where.push(
      `uc.id IN (
        SELECT entry_id FROM entry_product_edges
         WHERE entry_kind = 'use_case' AND product_id = ?
      )`,
    );
    params.push(filters.productId);
  }
  if (filters.templateId != null) {
    where.push("uc.template_id = ?");
    params.push(filters.templateId);
  }
  if (filters.vendor) {
    where.push("LOWER(uc.vendor_name) LIKE LOWER(?)");
    params.push(`%${filters.vendor}%`);
  }
  if (filters.search) {
    where.push(
      "(LOWER(uc.use_case_name) LIKE LOWER(?) OR LOWER(uc.problem_statement) LIKE LOWER(?) OR LOWER(uc.system_outputs) LIKE LOWER(?) OR LOWER(COALESCE(uc.vendor_name,'')) LIKE LOWER(?))",
    );
    const s = `%${filters.search}%`;
    params.push(s, s, s, s);
  }

  // Multi-select filters (Agent 4 additions).
  if (filters.agencyIds && filters.agencyIds.length > 0) {
    where.push(
      `uc.agency_id IN (${filters.agencyIds.map(() => "?").join(",")})`,
    );
    params.push(...filters.agencyIds);
  }
  if (filters.agencyTypes && filters.agencyTypes.length > 0) {
    where.push(
      `a.agency_type IN (${filters.agencyTypes.map(() => "?").join(",")})`,
    );
    params.push(...filters.agencyTypes);
  }
  if (filters.productIds && filters.productIds.length > 0) {
    const placeholders = filters.productIds.map(() => "?").join(",");
    where.push(
      `uc.id IN (
        SELECT entry_id FROM entry_product_edges
         WHERE entry_kind = 'use_case' AND product_id IN (${placeholders})
      )`,
    );
    params.push(...filters.productIds);
  }
  if (filters.templateIds && filters.templateIds.length > 0) {
    where.push(
      `uc.template_id IN (${filters.templateIds.map(() => "?").join(",")})`,
    );
    params.push(...filters.templateIds);
  }
  if (filters.bureaus && filters.bureaus.length > 0) {
    where.push(
      `uc.bureau_component IN (${filters.bureaus.map(() => "?").join(",")})`,
    );
    params.push(...filters.bureaus);
  }
  if (filters.maturityTiers && filters.maturityTiers.length > 0) {
    // Maturity tier lives on agency_ai_maturity; filter by joining via agency_id.
    where.push(
      `uc.agency_id IN (SELECT agency_id FROM agency_ai_maturity WHERE maturity_tier IN (${filters.maturityTiers.map(() => "?").join(",")}))`,
    );
    params.push(...filters.maturityTiers);
  }
  if (filters.topicAreas && filters.topicAreas.length > 0) {
    where.push(
      `uc.topic_area IN (${filters.topicAreas.map(() => "?").join(",")})`,
    );
    params.push(...filters.topicAreas);
  }
  if (filters.productCategories && filters.productCategories.length > 0) {
    // Filter by IFP-curated products.product_type via the
    // use_case_products edge table. Mirrors the productIds branch above
    // but resolves products by category instead of id.
    const placeholders = filters.productCategories.map(() => "?").join(",");
    where.push(
      `uc.id IN (
        SELECT ucp.use_case_id
          FROM use_case_products ucp
          JOIN products p ON p.id = ucp.product_id
         WHERE p.product_type IN (${placeholders})
      )`,
    );
    params.push(...filters.productCategories);
  }

  const joinTags =
    filters.entryType != null ||
    filters.deploymentScope != null ||
    filters.aiSophistication != null ||
    filters.isCodingTool != null ||
    filters.isGenAI != null ||
    (filters.entryTypes != null && filters.entryTypes.length > 0) ||
    (filters.deploymentScopes != null && filters.deploymentScopes.length > 0) ||
    (filters.aiSophistications != null &&
      filters.aiSophistications.length > 0) ||
    (filters.architectureTypes != null &&
      filters.architectureTypes.length > 0) ||
    (filters.useTypes != null && filters.useTypes.length > 0) ||
    (filters.highImpactDesignations != null &&
      filters.highImpactDesignations.length > 0) ||
    filters.isGeneralLLMAccess != null ||
    filters.isPublicFacing != null ||
    filters.hasATOorFedRAMP != null ||
    filters.hasMeaningfulRiskDocs != null;

  // Tag-based filters apply equally to both arms (the join column differs,
  // but the predicates don't). Build them into a separate buffer so the
  // consolidated branch can reuse them.
  const tagWhere: string[] = [];
  const tagParams: (string | number)[] = [];
  if (joinTags) {
    if (filters.entryType) {
      tagWhere.push("tag.entry_type = ?");
      tagParams.push(filters.entryType);
    }
    if (filters.deploymentScope) {
      tagWhere.push("tag.deployment_scope = ?");
      tagParams.push(filters.deploymentScope);
    }
    if (filters.aiSophistication) {
      tagWhere.push("tag.ai_sophistication = ?");
      tagParams.push(filters.aiSophistication);
    }
    if (filters.isCodingTool === true) tagWhere.push("tag.is_coding_tool = 1");
    if (filters.isCodingTool === false)
      tagWhere.push("COALESCE(tag.is_coding_tool,0) = 0");
    if (filters.isGenAI === true) tagWhere.push("tag.is_generative_ai = 1");
    if (filters.isGenAI === false)
      tagWhere.push("COALESCE(tag.is_generative_ai,0) = 0");

    if (filters.entryTypes && filters.entryTypes.length > 0) {
      tagWhere.push(
        `tag.entry_type IN (${filters.entryTypes.map(() => "?").join(",")})`,
      );
      tagParams.push(...filters.entryTypes);
    }
    if (filters.deploymentScopes && filters.deploymentScopes.length > 0) {
      tagWhere.push(
        `tag.deployment_scope IN (${filters.deploymentScopes.map(() => "?").join(",")})`,
      );
      tagParams.push(...filters.deploymentScopes);
    }
    if (filters.aiSophistications && filters.aiSophistications.length > 0) {
      tagWhere.push(
        `tag.ai_sophistication IN (${filters.aiSophistications.map(() => "?").join(",")})`,
      );
      tagParams.push(...filters.aiSophistications);
    }
    if (filters.architectureTypes && filters.architectureTypes.length > 0) {
      tagWhere.push(
        `tag.architecture_type IN (${filters.architectureTypes.map(() => "?").join(",")})`,
      );
      tagParams.push(...filters.architectureTypes);
    }
    if (filters.useTypes && filters.useTypes.length > 0) {
      tagWhere.push(
        `tag.use_type IN (${filters.useTypes.map(() => "?").join(",")})`,
      );
      tagParams.push(...filters.useTypes);
    }
    if (
      filters.highImpactDesignations &&
      filters.highImpactDesignations.length > 0
    ) {
      tagWhere.push(
        `tag.high_impact_designation IN (${filters.highImpactDesignations.map(() => "?").join(",")})`,
      );
      tagParams.push(...filters.highImpactDesignations);
    }
    if (filters.isGeneralLLMAccess === true)
      tagWhere.push("tag.is_general_llm_access = 1");
    if (filters.isPublicFacing === true)
      tagWhere.push("tag.is_public_facing = 1");
    if (filters.hasATOorFedRAMP === true)
      tagWhere.push("tag.has_ato_or_fedramp = 1");
    if (filters.hasMeaningfulRiskDocs === true)
      tagWhere.push("tag.has_meaningful_risk_docs = 1");
  }

  const ucCombinedWhere = [...where, ...tagWhere];
  const ucWhereSql = ucCombinedWhere.length
    ? `WHERE ${ucCombinedWhere.join(" AND ")}`
    : "";
  const ucCombinedParams = [...params, ...tagParams];
  const ucTagJoin = joinTags
    ? "LEFT JOIN use_case_tags tag ON tag.use_case_id = uc.id"
    : "";

  // ------------------------------------------------------------------
  // Build the consolidated branch (subset of filters; same shape).
  // ------------------------------------------------------------------
  const cWhere: string[] = [];
  const cParams: (string | number)[] = [];

  if (filters.agencyId != null) {
    cWhere.push("c.agency_id = ?");
    cParams.push(filters.agencyId);
  }
  if (filters.agencyAbbr) {
    cWhere.push("LOWER(a.abbreviation) = LOWER(?)");
    cParams.push(filters.agencyAbbr);
  }
  if (filters.productId != null) {
    cWhere.push(
      `c.id IN (
        SELECT entry_id FROM entry_product_edges
         WHERE entry_kind = 'consolidated' AND product_id = ?
      )`,
    );
    cParams.push(filters.productId);
  }
  if (filters.templateId != null) {
    cWhere.push("c.template_id = ?");
    cParams.push(filters.templateId);
  }
  if (filters.search) {
    // Consolidated rows have no problem_statement / system_outputs / vendor_name.
    // Search the available text fields.
    cWhere.push(
      "(LOWER(c.ai_use_case) LIKE LOWER(?) OR LOWER(COALESCE(c.commercial_product,'')) LIKE LOWER(?) OR LOWER(COALESCE(c.commercial_examples,'')) LIKE LOWER(?) OR LOWER(COALESCE(c.agency_uses,'')) LIKE LOWER(?))",
    );
    const s = `%${filters.search}%`;
    cParams.push(s, s, s, s);
  }
  if (filters.agencyIds && filters.agencyIds.length > 0) {
    cWhere.push(
      `c.agency_id IN (${filters.agencyIds.map(() => "?").join(",")})`,
    );
    cParams.push(...filters.agencyIds);
  }
  if (filters.agencyTypes && filters.agencyTypes.length > 0) {
    cWhere.push(
      `a.agency_type IN (${filters.agencyTypes.map(() => "?").join(",")})`,
    );
    cParams.push(...filters.agencyTypes);
  }
  if (filters.productIds && filters.productIds.length > 0) {
    const placeholders = filters.productIds.map(() => "?").join(",");
    cWhere.push(
      `c.id IN (
        SELECT entry_id FROM entry_product_edges
         WHERE entry_kind = 'consolidated' AND product_id IN (${placeholders})
      )`,
    );
    cParams.push(...filters.productIds);
  }
  if (filters.templateIds && filters.templateIds.length > 0) {
    cWhere.push(
      `c.template_id IN (${filters.templateIds.map(() => "?").join(",")})`,
    );
    cParams.push(...filters.templateIds);
  }
  if (filters.maturityTiers && filters.maturityTiers.length > 0) {
    cWhere.push(
      `c.agency_id IN (SELECT agency_id FROM agency_ai_maturity WHERE maturity_tier IN (${filters.maturityTiers.map(() => "?").join(",")}))`,
    );
    cParams.push(...filters.maturityTiers);
  }
  if (filters.productCategories && filters.productCategories.length > 0) {
    const placeholders = filters.productCategories.map(() => "?").join(",");
    cWhere.push(
      `c.id IN (
        SELECT cucp.consolidated_use_case_id
          FROM consolidated_use_case_products cucp
          JOIN products p ON p.id = cucp.product_id
         WHERE p.product_type IN (${placeholders})
      )`,
    );
    cParams.push(...filters.productCategories);
  }

  const cCombinedWhere = [...cWhere, ...tagWhere];
  const cWhereSql = cCombinedWhere.length
    ? `WHERE ${cCombinedWhere.join(" AND ")}`
    : "";
  const cCombinedParams = [...cParams, ...tagParams];
  const cTagJoin = joinTags
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

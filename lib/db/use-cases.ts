/**
 * Use-case queries — `use_cases` and the OMB `consolidated_use_cases` table,
 * plus their tag-driven faceted search, related-entries discovery, peer
 * similarity, and external-evidence helpers.
 *
 * The 500+-line `getUseCasesFiltered` is the anchor — it serves the
 * `/use-cases` explorer with both "individual" and "consolidated" arms,
 * sharing one filter set across both. Tag-based filters apply equally
 * to both; use-case-only filters silently elide the consolidated arm.
 *
 * Phase 3 of the lib/db.ts split (virtual-sniffing-peacock.md). Functions
 * are moved verbatim — no behavioral changes in this file. lib/db.ts
 * re-exports everything here so existing `import { x } from '@/lib/db'`
 * callers keep working.
 */

import { getDb } from "./shared/init";
import {
  STAGE_BUCKET_SQL,
  USE_CASE_SELECT,
  EXTERNAL_EVIDENCE_SELECT,
} from "./shared/sql-fragments";
import type {
  ConsolidatedUseCase,
  ConsolidatedWithTags,
  Product,
  UseCase,
  UseCaseExternalEvidence,
  UseCaseFilterInput,
  UseCaseRow,
  UseCaseTag,
  UseCaseWithTags,
} from "../types";

// -----------------------------------------------------------------------------
// Private helpers
// -----------------------------------------------------------------------------

type JoinedUseCaseRow = UseCase & {
  agency_name: string;
  agency_abbreviation: string;
  product_name: string | null;
  template_short_name: string | null;
};

function attachTagsToUseCases(rows: JoinedUseCaseRow[]): UseCaseWithTags[] {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const tags = db
    .prepare<number[], UseCaseTag>(
      `SELECT * FROM use_case_tags WHERE use_case_id IN (${placeholders})`,
    )
    .all(...ids);
  const byId = new Map<number, UseCaseTag>();
  for (const t of tags) {
    if (t.use_case_id != null) byId.set(t.use_case_id, t);
  }
  return rows.map((r) => ({ ...r, tags: byId.get(r.id) ?? null }));
}

// -----------------------------------------------------------------------------
// Single-row fetchers
// -----------------------------------------------------------------------------

/** All use cases for a single agency (joined with tags, product, template). */
export function getUseCasesForAgency(agencyId: number): UseCaseWithTags[] {
  const stmt = getDb().prepare<[number], JoinedUseCaseRow>(
    `${USE_CASE_SELECT} WHERE uc.agency_id = ? ORDER BY uc.use_case_name COLLATE NOCASE ASC`,
  );
  return attachTagsToUseCases(stmt.all(agencyId));
}

/**
 * Use cases tagged at this org or any of its descendants. bureau_organization_id
 * is preferred, with organization_id as the fallback for top-level-only rows.
 */
export function getUseCasesForOrgSubtree(
  orgId: number,
): UseCaseWithTags[] {
  const path = getDb()
    .prepare<[number], { hierarchy_path: string | null }>(
      `SELECT hierarchy_path FROM federal_organizations WHERE id = ?`,
    )
    .get(orgId);
  if (!path?.hierarchy_path) return [];
  const stmt = getDb().prepare<[string], JoinedUseCaseRow>(
    `${USE_CASE_SELECT}
     WHERE COALESCE(uc.bureau_organization_id, uc.organization_id) IN (
       SELECT id FROM federal_organizations
        WHERE hierarchy_path LIKE ? || '%'
     )
     ORDER BY uc.use_case_name COLLATE NOCASE ASC`,
  );
  return attachTagsToUseCases(stmt.all(path.hierarchy_path));
}

/** Fetch one use case by slug. Returns null if not found. */
export function getUseCaseBySlug(slug: string): UseCaseWithTags | null {
  const stmt = getDb().prepare<[string], JoinedUseCaseRow>(
    `${USE_CASE_SELECT} WHERE uc.slug = ? LIMIT 1`,
  );
  const row = stmt.get(slug);
  if (!row) return null;
  return attachTagsToUseCases([row])[0] ?? null;
}

/** Fetch one use case by numeric id. */
export function getUseCaseById(id: number): UseCaseWithTags | null {
  const stmt = getDb().prepare<[number], JoinedUseCaseRow>(
    `${USE_CASE_SELECT} WHERE uc.id = ? LIMIT 1`,
  );
  const row = stmt.get(id);
  if (!row) return null;
  return attachTagsToUseCases([row])[0] ?? null;
}

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

// -----------------------------------------------------------------------------
// Consolidated use cases
// -----------------------------------------------------------------------------

export function getConsolidatedForAgency(
  agencyId: number,
): ConsolidatedWithTags[] {
  const db = getDb();
  const stmt = db.prepare<[number], ConsolidatedUseCase & { agency_name: string; agency_abbreviation: string }>(`
    SELECT c.*,
           a.name AS agency_name,
           a.abbreviation AS agency_abbreviation
      FROM consolidated_use_cases c
      JOIN agencies a ON a.id = c.agency_id
     WHERE c.agency_id = ?
     ORDER BY c.ai_use_case COLLATE NOCASE ASC
  `);
  const rows = stmt.all(agencyId);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const tags = db
    .prepare<number[], UseCaseTag>(
      `SELECT * FROM use_case_tags WHERE consolidated_use_case_id IN (${placeholders})`,
    )
    .all(...ids);
  const byId = new Map<number, UseCaseTag>();
  for (const t of tags) {
    if (t.consolidated_use_case_id != null)
      byId.set(t.consolidated_use_case_id, t);
  }
  return rows.map((r) => ({ ...r, tags: byId.get(r.id) ?? null }));
}

// -----------------------------------------------------------------------------
// Products linked to use cases (from use_case_products / consolidated_use_case_products)
// -----------------------------------------------------------------------------

/**
 * Every canonical product linked to the given use case via the
 * ``use_case_products`` join table (Phase 2 Agent D). Sorted strongest-
 * evidence first so callers can pick the first element as the primary
 * product if they only need one. Returns an empty array if no linkage exists.
 */
export function getProductsForUseCase(
  useCaseId: number,
): Array<Product & { evidence_text: string | null; confidence: string | null }> {
  const db = getDb();
  const stmt = db.prepare<
    [number],
    Product & { evidence_text: string | null; confidence: string | null }
  >(`
    SELECT p.*,
           ucp.evidence_text AS evidence_text,
           ucp.confidence    AS confidence
      FROM use_case_products ucp
      JOIN products p ON p.id = ucp.product_id
     WHERE ucp.use_case_id = ?
     ORDER BY
       CASE ucp.confidence WHEN 'strong' THEN 0 ELSE 1 END,
       p.canonical_name COLLATE NOCASE ASC
  `);
  return stmt.all(useCaseId);
}

/** Mirror of ``getProductsForUseCase`` for consolidated rows. */
export function getProductsForConsolidatedUseCase(
  consolidatedId: number,
): Array<Product & { evidence_text: string | null; confidence: string | null }> {
  const db = getDb();
  const stmt = db.prepare<
    [number],
    Product & { evidence_text: string | null; confidence: string | null }
  >(`
    SELECT p.*,
           cucp.evidence_text AS evidence_text,
           cucp.confidence    AS confidence
      FROM consolidated_use_case_products cucp
      JOIN products p ON p.id = cucp.product_id
     WHERE cucp.consolidated_use_case_id = ?
     ORDER BY
       CASE cucp.confidence WHEN 'strong' THEN 0 ELSE 1 END,
       p.canonical_name COLLATE NOCASE ASC
  `);
  return stmt.all(consolidatedId);
}

// -----------------------------------------------------------------------------
// Slug-based lookups for the detail page
// -----------------------------------------------------------------------------

/** Fetch one consolidated use case by slug, with tags + agency/product/template joins. */
export function getConsolidatedBySlug(
  slug: string,
): ConsolidatedWithTags | null {
  const db = getDb();
  type Row = ConsolidatedUseCase & {
    agency_name: string;
    agency_abbreviation: string;
    product_name: string | null;
    template_short_name: string | null;
  };
  const row = db
    .prepare<[string], Row>(
      `SELECT c.*,
              a.name AS agency_name,
              a.abbreviation AS agency_abbreviation,
              p.canonical_name AS product_name,
              t.short_name AS template_short_name
         FROM consolidated_use_cases c
         JOIN agencies a ON a.id = c.agency_id
         LEFT JOIN products p ON p.id = c.product_id
         LEFT JOIN use_case_templates t ON t.id = c.template_id
        WHERE c.slug = ? LIMIT 1`,
    )
    .get(slug);
  if (!row) return null;
  const tag = db
    .prepare<[number], UseCaseTag>(
      `SELECT * FROM use_case_tags WHERE consolidated_use_case_id = ? LIMIT 1`,
    )
    .get(row.id);
  return { ...row, tags: tag ?? null };
}

/**
 * Resolve a slug to either an individual use case or a consolidated one.
 * Used by the detail page which accepts both under `/use-cases/[slug]`.
 */
export function getUseCaseOrConsolidatedBySlug(
  slug: string,
):
  | { kind: "use_case"; data: UseCaseWithTags }
  | { kind: "consolidated"; data: ConsolidatedWithTags }
  | null {
  const uc = getUseCaseBySlug(slug);
  if (uc) return { kind: "use_case", data: uc };
  const c = getConsolidatedBySlug(slug);
  if (c) return { kind: "consolidated", data: c };
  return null;
}

// -----------------------------------------------------------------------------
// Related-entries discovery (sidebar on the detail page)
// -----------------------------------------------------------------------------

/** Small list of related use cases within the same agency, excluding the given id. */
export function getRelatedByAgency(
  agencyId: number,
  excludeId: number,
  limit = 5,
): Array<{ id: number; slug: string | null; use_case_name: string; agency_abbreviation: string }> {
  return getDb()
    .prepare<
      [number, number, number],
      { id: number; slug: string | null; use_case_name: string; agency_abbreviation: string }
    >(`
      SELECT uc.id, uc.slug, uc.use_case_name, a.abbreviation AS agency_abbreviation
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
       WHERE uc.agency_id = ? AND uc.id <> ?
       ORDER BY uc.use_case_name COLLATE NOCASE ASC
       LIMIT ?
    `)
    .all(agencyId, excludeId, limit);
}

/** Small list of related use cases that share the same product. */
export function getRelatedByProduct(
  productId: number,
  excludeId: number,
  limit = 5,
): Array<{
  id: number;
  slug: string | null;
  use_case_name: string;
  agency_abbreviation: string;
}> {
  return getDb()
    .prepare<
      [number, number, number],
      { id: number; slug: string | null; use_case_name: string; agency_abbreviation: string }
    >(`
      SELECT uc.id, uc.slug, uc.use_case_name, a.abbreviation AS agency_abbreviation
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
       WHERE uc.id IN (
         SELECT entry_id FROM entry_product_edges
          WHERE entry_kind = 'use_case' AND product_id = ?
       )
         AND uc.id <> ?
       ORDER BY uc.use_case_name COLLATE NOCASE ASC
       LIMIT ?
    `)
    .all(productId, excludeId, limit);
}

/** Small list of related use cases that share the same template. */
export function getRelatedByTemplate(
  templateId: number,
  excludeId: number,
  limit = 5,
): Array<{
  id: number;
  slug: string | null;
  use_case_name: string;
  agency_abbreviation: string;
}> {
  return getDb()
    .prepare<
      [number, number, number],
      { id: number; slug: string | null; use_case_name: string; agency_abbreviation: string }
    >(`
      SELECT uc.id, uc.slug, uc.use_case_name, a.abbreviation AS agency_abbreviation
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
       WHERE uc.template_id = ? AND uc.id <> ?
       ORDER BY uc.use_case_name COLLATE NOCASE ASC
       LIMIT ?
    `)
    .all(templateId, excludeId, limit);
}

// -----------------------------------------------------------------------------
// Filter facets (sidebar lists)
// -----------------------------------------------------------------------------

/**
 * Facet counts useful to the filter sidebar (lightweight — just enum lists
 * actually present in the DB so we don't show filters for missing values).
 * Returned as maps keyed by the column we filter on.
 */
export function getUseCaseFacets(): {
  stages: string[];
  aiClassifications: string[];
  highImpact: string[];
  agencyTypes: string[];
  tagEntryTypes: string[];
  tagDeploymentScopes: string[];
  tagAISophistications: string[];
  tagArchitectureTypes: string[];
  tagUseTypes: string[];
  tagHighImpactDesignations: string[];
  topicAreas: string[];
  productCategories: string[];
} {
  const db = getDb();
  const distinct = (table: string, col: string) =>
    db
      .prepare<[], { v: string }>(
        `SELECT DISTINCT ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY v COLLATE NOCASE ASC`,
      )
      .all()
      .map((r) => r.v);

  // Topic-area distinct list, ranked by use-case count rather than name.
  // The OMB filings have a long-tail (30+ values, many one-offs and case
  // variants); count-ranked makes the sidebar facet usable without the
  // long tail crowding the top.
  const topicAreas = db
    .prepare<[], { v: string }>(
      `SELECT topic_area AS v
         FROM use_cases
        WHERE topic_area IS NOT NULL AND topic_area <> ''
        GROUP BY topic_area
       HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC, topic_area COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.v);

  // IFP-curated product_type, ranked by reach (distinct use-cases that
  // reference any product in that category). Excludes 'unclassified' since
  // that's a placeholder, not a real category — the recategorization
  // proposal in audit/product_categorization assigned every product to a
  // concrete bucket.
  const productCategories = db
    .prepare<[], { v: string }>(
      `SELECT p.product_type AS v
         FROM use_case_products ucp
         JOIN products p ON p.id = ucp.product_id
        WHERE p.product_type IS NOT NULL
          AND TRIM(p.product_type) <> ''
          AND LOWER(TRIM(p.product_type)) <> 'unclassified'
        GROUP BY p.product_type
        ORDER BY COUNT(DISTINCT ucp.use_case_id) DESC,
                 p.product_type COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.v);

  return {
    stages: distinct("use_cases", "stage_of_development"),
    aiClassifications: distinct("use_cases", "ai_classification"),
    highImpact: distinct("use_cases", "is_high_impact"),
    agencyTypes: distinct("agencies", "agency_type"),
    tagEntryTypes: distinct("use_case_tags", "entry_type"),
    tagDeploymentScopes: distinct("use_case_tags", "deployment_scope"),
    tagAISophistications: distinct("use_case_tags", "ai_sophistication"),
    tagArchitectureTypes: distinct("use_case_tags", "architecture_type"),
    tagUseTypes: distinct("use_case_tags", "use_type"),
    tagHighImpactDesignations: distinct("use_case_tags", "high_impact_designation"),
    topicAreas,
    productCategories,
  };
}

// -----------------------------------------------------------------------------
// Product → use-case lookups
// -----------------------------------------------------------------------------

/** All individual use cases linked to a given product via authoritative edges. */
export function getUseCasesForProduct(productId: number): UseCaseWithTags[] {
  const stmt = getDb().prepare<[number], JoinedUseCaseRow>(
    `${USE_CASE_SELECT}
       WHERE uc.id IN (
         SELECT entry_id FROM entry_product_edges
          WHERE entry_kind = 'use_case' AND product_id = ?
       )
       ORDER BY a.name COLLATE NOCASE ASC, uc.use_case_name COLLATE NOCASE ASC`,
  );
  return attachTagsToUseCases(stmt.all(productId));
}

/** Count of consolidated_use_cases rows linked to a product via authoritative edges. */
export function getConsolidatedCountForProduct(productId: number): number {
  const row = getDb()
    .prepare<[number], { c: number }>(
      `SELECT COUNT(*) AS c
         FROM entry_product_edges
        WHERE entry_kind = 'consolidated'
          AND product_id = ?`,
    )
    .get(productId);
  return row?.c ?? 0;
}

// -----------------------------------------------------------------------------
// Last-updated timestamp (used by About / footer)
// -----------------------------------------------------------------------------

let _lastUpdatedCache: string | null | undefined = undefined;

/**
 * Most recent `date_accessed` across all agencies — used as the "data last
 * updated" footer / About timestamp.
 */
export function getLastUpdatedDate(): string | null {
  if (_lastUpdatedCache !== undefined) return _lastUpdatedCache;
  const row = getDb()
    .prepare<[], { d: string | null }>(
      `SELECT MAX(date_accessed) AS d FROM agencies WHERE date_accessed IS NOT NULL`,
    )
    .get();
  _lastUpdatedCache = row?.d ?? null;
  return _lastUpdatedCache;
}

// -----------------------------------------------------------------------------
// External evidence (out-of-inventory corroboration)
// -----------------------------------------------------------------------------

function externalEvidenceTableExists(): boolean {
  const row = getDb()
    .prepare<[], { name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'use_case_external_evidence'`,
    )
    .get();
  return !!row;
}

/** External-corroboration rows for one use case. Empty array if the table
 *  hasn't been built yet (e.g. running against a pre-evidence DB snapshot). */
export function getExternalEvidenceForUseCase(
  useCaseId: number,
): UseCaseExternalEvidence[] {
  if (!externalEvidenceTableExists()) return [];
  return getDb()
    .prepare<[number], UseCaseExternalEvidence>(
      `${EXTERNAL_EVIDENCE_SELECT}
       WHERE use_case_id = ?
       ORDER BY CASE status
                  WHEN 'corroborated' THEN 0
                  WHEN 'inventory_only' THEN 1
                  WHEN 'searched_no_source' THEN 2
                ELSE 3 END,
                CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1
                                WHEN 'low' THEN 2 ELSE 3 END,
                topic`,
    )
    .all(useCaseId);
}

/** External-corroboration rows for one consolidated entry. */
export function getExternalEvidenceForConsolidated(
  consolidatedId: number,
): UseCaseExternalEvidence[] {
  if (!externalEvidenceTableExists()) return [];
  return getDb()
    .prepare<[number], UseCaseExternalEvidence>(
      `${EXTERNAL_EVIDENCE_SELECT}
       WHERE consolidated_use_case_id = ?
       ORDER BY CASE status
                  WHEN 'corroborated' THEN 0
                  WHEN 'inventory_only' THEN 1
                  WHEN 'searched_no_source' THEN 2
                ELSE 3 END,
                CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1
                                WHEN 'low' THEN 2 ELSE 3 END,
                topic`,
    )
    .all(consolidatedId);
}

// -----------------------------------------------------------------------------
// Peer use cases (similarity sidebar on the detail page)
// -----------------------------------------------------------------------------

export interface PeerUseCaseRow {
  id: number;
  slug: string | null;
  use_case_name: string;
  agency_id: number;
  agency_abbreviation: string;
  agency_name: string;
  ai_sophistication: string | null;
  deployment_scope: string | null;
  stage_of_development: string | null;
  topic_area: string | null;
  shared_dimensions: number;
}

export function getPeerUseCases(
  useCaseId: number,
  limit = 6,
): PeerUseCaseRow[] {
  const db = getDb();
  const seed = db
    .prepare<
      [number],
      {
        agency_id: number;
        ai_sophistication: string | null;
        deployment_scope: string | null;
        use_type: string | null;
        high_impact_designation: string | null;
        entry_type: string | null;
        topic_area: string | null;
      }
    >(
      `SELECT uc.agency_id,
              tag.ai_sophistication,
              tag.deployment_scope,
              tag.use_type,
              tag.high_impact_designation,
              tag.entry_type,
              uc.topic_area
         FROM use_cases uc
         LEFT JOIN use_case_tags tag ON tag.use_case_id = uc.id
        WHERE uc.id = ?`,
    )
    .get(useCaseId);

  if (!seed) return [];

  const conds: string[] = [];
  const params: (string | number)[] = [];
  const push = (col: string, val: string | null) => {
    if (val == null || val === "") return;
    conds.push(`(CASE WHEN ${col} = ? THEN 1 ELSE 0 END)`);
    params.push(val);
  };
  push("tag2.ai_sophistication", seed.ai_sophistication);
  push("tag2.deployment_scope", seed.deployment_scope);
  push("tag2.use_type", seed.use_type);
  push("tag2.high_impact_designation", seed.high_impact_designation);
  push("tag2.entry_type", seed.entry_type);
  push("uc2.topic_area", seed.topic_area);

  // Need at least 2 dimensions populated on the seed to even attempt — a
  // use case with only entry_type set will match too many random peers.
  if (conds.length < 2) return [];

  const sumExpr = conds.join(" + ");

  const rows = db
    .prepare<
      (string | number)[],
      PeerUseCaseRow
    >(
      `SELECT uc2.id,
              uc2.slug,
              uc2.use_case_name,
              a.id AS agency_id,
              a.abbreviation AS agency_abbreviation,
              a.name AS agency_name,
              tag2.ai_sophistication,
              tag2.deployment_scope,
              uc2.stage_of_development,
              uc2.topic_area,
              (${sumExpr}) AS shared_dimensions
         FROM use_cases uc2
         JOIN agencies a ON a.id = uc2.agency_id
         LEFT JOIN use_case_tags tag2 ON tag2.use_case_id = uc2.id
        WHERE uc2.id <> ?
          AND uc2.agency_id <> ?
          AND (${sumExpr}) >= 3
        ORDER BY shared_dimensions DESC,
                 COALESCE(uc2.operational_date, '') DESC,
                 uc2.use_case_name COLLATE NOCASE ASC
        LIMIT ?`,
    )
    .all(...params, useCaseId, seed.agency_id, ...params, limit);

  return rows;
}

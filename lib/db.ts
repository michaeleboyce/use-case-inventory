/**
 * SQLite query layer for the Federal AI Use Case Inventory dashboard.
 *
 * All functions run on the server (Server Components) and return typed rows
 * that can be passed directly into React props. The database is opened once
 * in read-only mode and kept warm for the lifetime of the Node process.
 *
 * Usage (in a Server Component):
 *
 *   import { getGlobalStats, getAgencies } from '@/lib/db';
 *   const stats = getGlobalStats();
 *
 * Constraints:
 *   - Every query uses a prepared statement (SQL is static; parameters are bound).
 *   - No function returns `any` — see `@/lib/types` for the row shapes.
 *   - Callers must not mutate the returned objects (better-sqlite3 gives plain
 *     objects, but they should be treated as read-only view-models).
 */

import { getDb, rawDb } from "./db/shared/init";
import {
  STAGE_BUCKET_SQL,
  USE_CASE_SELECT,
  EXTERNAL_EVIDENCE_SELECT,
  EFFECTIVE_FEDRAMP_LINKS_CTE,
} from "./db/shared/sql-fragments";

// Re-export so existing `import { rawDb, STAGE_BUCKET_SQL } from '@/lib/db'`
// callers keep working without changes.
export { rawDb, STAGE_BUCKET_SQL };

// Domain modules (per-domain split in progress; see virtual-sniffing-peacock.md).
export {
  getAllTemplates,
  getTemplateById,
  getEntriesForTemplate,
  type TemplateEntryRow,
} from "./db/templates";
export {
  getGlobalStats,
  getProductCatalogStats,
  getCommandPaletteIndex,
  type CommandPaletteIndex,
} from "./db/stats";
export {
  getAgencies,
  getAllAgenciesIncludingEmpty,
  getAgencyByAbbr,
  getAgencyById,
  getAgencyMaturity,
  getRecentlyModifiedAgencies,
  getAgencyOptions,
  getAgencyInventoryLinks,
  getAgencyCompareData,
  type AgencyCompareData,
} from "./db/agencies";
export {
  getAllProducts,
  getProductById,
  getTopProducts,
  getProductsForAgency,
  getProductOptions,
  getChildProducts,
  getProductsByVendor,
  getProductNamesById,
} from "./db/products";
export {
  getBureauBreakdown,
  getEntryTypeBreakdown,
  getAISophisticationBreakdown,
  getDeploymentScopeBreakdown,
  getCategoryDistributionForAgency,
  getYoYGrowthData,
  getVendorMarketShare,
  getCategoryDistribution,
  getProductAgencyHeatmap,
  getCodingToolAgencies,
  getMaturityTierSummary,
  getAgencyTypeByTier,
  getProductAgencyMatrix,
  getArchitectureDistribution,
  getLLMVendorShare,
  getEntryTypeMixByAgency,
  getAnalyticsInsights,
  getMaturityScatterData,
  getEnterpriseLLMAgencies,
  getCrossCutSummary,
  getCrossCutHeatmap,
  type CrossCutKey,
  type CrossCutValueRow,
  type CrossCutHeatmapCell,
} from "./db/analytics";

import type {
  Agency,
  AgencyMaturity,
  AgencyWithMaturity,
  BreakdownRow,
  BureauBreakdown,
  ConsolidatedUseCase,
  ConsolidatedWithTags,
  CoverageAgencyDrill,
  CoverageAgencyRow,
  CoverageFitCell,
  CoverageStat,
  CoverageVendorRow,
  FedrampAgency,
  FedrampAssessor,
  FedrampAuthorization,
  FedrampCoverageState,
  CategoryDistributionRow,
  FedrampProduct,
  FedrampSnapshot,
  GlobalStats,
  HeatmapCell,
  LinkQueueRow,
  Product,
  ProductCatalogStats,
  ProductDetail,
  ProductWithCounts,
  TemplateDetail,
  TemplateWithCounts,
  UseCase,
  UseCaseExternalEvidence,
  UseCaseFilterInput,
  UseCaseRow,
  UseCaseTag,
  UseCaseTemplate,
  UseCaseWithTags,
  VendorShareRow,
  YoYRow,
} from "./types";

// STAGE_BUCKET_SQL, DB_PATH, getDb(), and rawDb() now live in
// `lib/db/shared/{init,sql-fragments}.ts` (imported above).

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Agencies that actually contributed data to the 2025 inventory are filtered
 * by the SQL literal `'FOUND_2025','FOUND_2024_ONLY'`. Everything else
 * (NOT_FOUND, EXEMPT, SITE_DOWN, ZERO_USE_CASES, etc.) is still queryable by
 * id/abbreviation via `getAgencyById` / `getAgencyByAbbr`.
 */

// -----------------------------------------------------------------------------
// Agencies
// -----------------------------------------------------------------------------

/**
 * All agencies that have any inventory data. Sorted by name. Use
 * `getAllAgenciesIncludingEmpty()` if you need every row regardless of status.
 */
// Agencies (getAgencies, getAllAgenciesIncludingEmpty, getAgencyByAbbr,
// getAgencyById, getAgencyMaturity) moved to ./db/agencies (re-exported below).

// -----------------------------------------------------------------------------
// Global stats (for homepage / About page)
// -----------------------------------------------------------------------------

// getGlobalStats moved to ./db/stats (re-exported below).

// -----------------------------------------------------------------------------
// Use cases
// -----------------------------------------------------------------------------

// USE_CASE_SELECT now lives in `lib/db/shared/sql-fragments.ts`.

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
// Products
// -----------------------------------------------------------------------------

// getProductCatalogStats moved to ./db/stats (re-exported below).

/** All products with usage counts from authoritative product-edge rows. */
// getAllProducts, getProductById, getTopProducts moved to ./db/products.

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
// Templates
// -----------------------------------------------------------------------------

// getAllTemplates, getTemplateById moved to ./db/templates (re-exported below).

// -----------------------------------------------------------------------------
// Per-agency breakdown helpers (for donut/stacked charts on agency pages)
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Agent 4 additions — consolidated-use-case detail, related use cases,
// and export support.
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

/** Minimal agency listing for filter dropdowns (id + abbr + name only).
 *  Surfaces every agency that has at least one row in `inventory_entries`
 *  (use_cases ∪ consolidated_use_cases). The previous implementation filtered
 *  on `status IN ('FOUND_2025','FOUND_2024_ONLY')`, which excluded agencies
 *  whose only 2025 data is consolidated (EXIM/NEH/FLRA) and included
 *  agencies that have neither (status=FOUND_2024_ONLY: PT/USAGM/USCCR). */
// getAgencyOptions moved to ./db/agencies (re-exported below).

/** Minimal product listing for filter dropdowns. */
// getProductOptions moved to ./db/products.

// -----------------------------------------------------------------------------
// Product detail — auxiliary helpers (Agent 5)
// -----------------------------------------------------------------------------

// getChildProducts moved to ./db/products.

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

// getProductsByVendor + getProductNamesById moved to ./db/products.

// TemplateEntryRow + getEntriesForTemplate moved to ./db/templates (re-exported below).

// -----------------------------------------------------------------------------
// Agent 7 additions — comparison page, About page, command palette.
// -----------------------------------------------------------------------------

/**
 * Most recent `date_accessed` across all agencies — used as the "data last
 * updated" footer / About timestamp.
 */
let _lastUpdatedCache: string | null | undefined = undefined;
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

// getAgencyInventoryLinks moved to ./db/agencies (re-exported below).

// AgencyCompareData + getAgencyCompareData moved to ./db/agencies (re-exported below).

// CommandPaletteIndex + getCommandPaletteIndex moved to ./db/stats (re-exported below).

// -----------------------------------------------------------------------------
// External evidence
// -----------------------------------------------------------------------------

// EXTERNAL_EVIDENCE_SELECT now lives in `lib/db/shared/sql-fragments.ts`.

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

// =============================================================================
// FEDRAMP MARKETPLACE + COVERAGE HELPERS
//
// These read from the FedRAMP mirror tables (fedramp_products,
// fedramp_authorizations, fedramp_agencies, fedramp_assessors,
// fedramp_snapshot) populated by `python load_fedramp.py`, plus the link/queue
// tables (fedramp_product_links, fedramp_agency_links, fedramp_link_queue)
// populated by `python link_fedramp.py --apply`.
//
// Convention: marketplace helpers replicate the shape of the standalone
// 2025-fedramp dashboard; coverage helpers cross-reference the inventory
// (`use_cases`, `consolidated_use_cases`, `products`, `agencies`) with the
// FedRAMP mirror to produce the four panels of /fedramp/coverage/.
//
// Phase-5 inheritance model:
//   `products.parent_product_id` lets a child product inherit its parent's
//   FedRAMP link without duplicating the row. Coverage queries below use
//   `effective_fedramp_links`, a recursive CTE (cap = 5 levels) that walks
//   each product up its parent chain and emits (inventory_product_id,
//   fedramp_id, inherited_from_parent_id) — the latter is NULL for direct
//   links and set to the ancestor whose row was actually matched.
// =============================================================================

/**
 * Recursive-CTE fragment that resolves every `products.id` to its effective
 * set of FedRAMP links: direct links plus any links found by walking up
 * `parent_product_id` (capped at 5 hops to guard against accidental cycles).
 *
 * The CTE emits one row per (inventory_product_id, fedramp_id) pair with
 * `inherited_from_parent_id` set to NULL when the link is direct, or the
 * ancestor product id when it came from the parent walk. Use as:
 *
 *   WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
 *   SELECT ... FROM effective_fedramp_links ...
 */
// EFFECTIVE_FEDRAMP_LINKS_CTE now lives in `lib/db/shared/sql-fragments.ts`.

// -----------------------------------------------------------------------------
// FedRAMP marketplace
// -----------------------------------------------------------------------------

export function getFedrampProducts(): FedrampProduct[] {
  return getDb()
    .prepare<[], FedrampProduct>(
      `SELECT * FROM fedramp_products ORDER BY csp COLLATE NOCASE ASC, cso COLLATE NOCASE ASC`,
    )
    .all();
}

export function getFedrampProductById(
  fedrampId: string,
): FedrampProduct | null {
  return (
    getDb()
      .prepare<[string], FedrampProduct>(
        `SELECT * FROM fedramp_products WHERE fedramp_id = ? LIMIT 1`,
      )
      .get(fedrampId) ?? null
  );
}

export function getFedrampProductsByVendor(csp: string): FedrampProduct[] {
  return getDb()
    .prepare<[string], FedrampProduct>(
      `SELECT * FROM fedramp_products
        WHERE LOWER(csp) = LOWER(?)
        ORDER BY cso COLLATE NOCASE ASC`,
    )
    .all(csp);
}

/** Distinct CSPs with offering counts. */
export function getFedrampCsps(): Array<{
  csp: string;
  csp_slug: string;
  offering_count: number;
  authorized_count: number;
  total_authorizations: number;
  total_reuses: number;
}> {
  return getDb()
    .prepare<
      [],
      {
        csp: string;
        csp_slug: string;
        offering_count: number;
        authorized_count: number;
        total_authorizations: number;
        total_reuses: number;
      }
    >(`
      SELECT csp,
             csp_slug,
             COUNT(*) AS offering_count,
             SUM(CASE WHEN status = 'FedRAMP Authorized' THEN 1 ELSE 0 END) AS authorized_count,
             COALESCE(SUM(authorization_count), 0) AS total_authorizations,
             COALESCE(SUM(reuse_count), 0) AS total_reuses
        FROM fedramp_products
       GROUP BY csp_slug
       ORDER BY total_authorizations DESC, offering_count DESC
    `)
    .all();
}

export function getFedrampCspBySlug(slug: string): {
  csp: string;
  csp_slug: string;
  offering_count: number;
  authorized_count: number;
  total_authorizations: number;
  total_reuses: number;
} | null {
  return (
    getDb()
      .prepare<
        [string],
        {
          csp: string;
          csp_slug: string;
          offering_count: number;
          authorized_count: number;
          total_authorizations: number;
          total_reuses: number;
        }
      >(`
        SELECT MAX(csp) AS csp,
               csp_slug,
               COUNT(*) AS offering_count,
               SUM(CASE WHEN status = 'FedRAMP Authorized' THEN 1 ELSE 0 END) AS authorized_count,
               COALESCE(SUM(authorization_count), 0) AS total_authorizations,
               COALESCE(SUM(reuse_count), 0) AS total_reuses
          FROM fedramp_products
         WHERE csp_slug = ?
         GROUP BY csp_slug
      `)
      .get(slug) ?? null
  );
}

export function getFedrampProductsByCsp(slug: string): FedrampProduct[] {
  return getDb()
    .prepare<[string], FedrampProduct>(
      `SELECT * FROM fedramp_products
        WHERE csp_slug = ?
        ORDER BY cso COLLATE NOCASE ASC`,
    )
    .all(slug);
}

export function getFedrampAgencies(): FedrampAgency[] {
  return getDb()
    .prepare<[], FedrampAgency>(
      `SELECT id, parent_agency, parent_slug
         FROM fedramp_agencies
        ORDER BY parent_agency COLLATE NOCASE ASC`,
    )
    .all();
}

/**
 * Look up a FedRAMP agency by parent_slug. Named `getFedrampAgencyByAbbr`
 * per the plan for symmetry with `getAgencyByAbbr`, but the FedRAMP
 * marketplace uses slugs (not abbreviations) as its primary lookup key
 * — so this accepts the slug.
 */
export function getFedrampAgencyByAbbr(
  parentSlug: string,
): FedrampAgency | null {
  return (
    getDb()
      .prepare<[string], FedrampAgency>(
        `SELECT id, parent_agency, parent_slug
           FROM fedramp_agencies
          WHERE parent_slug = ?
          LIMIT 1`,
      )
      .get(parentSlug) ?? null
  );
}

export function getFedrampAssessors(): FedrampAssessor[] {
  return getDb()
    .prepare<[], FedrampAssessor>(
      `SELECT id, name, slug FROM fedramp_assessors
        ORDER BY name COLLATE NOCASE ASC`,
    )
    .all();
}

export function getFedrampProductsByAssessor(
  assessorId: number,
): FedrampProduct[] {
  return getDb()
    .prepare<[number], FedrampProduct>(
      `SELECT * FROM fedramp_products
        WHERE assessor_id = ?
        ORDER BY csp COLLATE NOCASE ASC, cso COLLATE NOCASE ASC`,
    )
    .all(assessorId);
}

export function getFedrampAuthorizationsForProduct(
  fedrampId: string,
): Array<FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }> {
  return getDb()
    .prepare<
      [string],
      FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }
    >(`
      SELECT auth.*,
             a.parent_agency AS parent_agency,
             a.parent_slug AS parent_slug
        FROM fedramp_authorizations auth
        LEFT JOIN fedramp_agencies a ON a.id = auth.agency_id
       WHERE auth.fedramp_id = ?
       ORDER BY auth.ato_issuance_date DESC
    `)
    .all(fedrampId);
}

/**
 * Batched variant of `getFedrampAuthorizationsForProduct` — single SQL query
 * for many fedramp_ids, avoiding the N+1 in `/products/[id]`. Returns a Map
 * keyed by `fedramp_id`. The per-row shape matches the single-product helper
 * so consumers don't need to remap. Empty input → empty Map (no DB hit).
 */
export function getFedrampAuthorizationsForProducts(
  fedrampIds: string[],
): Map<
  string,
  Array<FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }>
> {
  const result = new Map<
    string,
    Array<FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }>
  >();
  if (fedrampIds.length === 0) return result;
  // Pre-seed every requested id so callers can safely look up missing ids.
  for (const id of fedrampIds) result.set(id, []);
  const placeholders = fedrampIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare<
      string[],
      FedrampAuthorization & { parent_agency: string | null; parent_slug: string | null }
    >(`
      SELECT auth.*,
             a.parent_agency AS parent_agency,
             a.parent_slug AS parent_slug
        FROM fedramp_authorizations auth
        LEFT JOIN fedramp_agencies a ON a.id = auth.agency_id
       WHERE auth.fedramp_id IN (${placeholders})
       ORDER BY auth.ato_issuance_date DESC
    `)
    .all(...fedrampIds);
  for (const row of rows) {
    const bucket = result.get(row.fedramp_id);
    if (bucket) bucket.push(row);
    else result.set(row.fedramp_id, [row]);
  }
  return result;
}

export function getFedrampAuthorizationsForAgency(
  agencyId: number,
): Array<FedrampAuthorization & { csp: string; cso: string; csp_slug: string; impact_level: string | null; status: string }> {
  return getDb()
    .prepare<
      [number],
      FedrampAuthorization & {
        csp: string;
        cso: string;
        csp_slug: string;
        impact_level: string | null;
        status: string;
      }
    >(`
      SELECT auth.*,
             p.csp AS csp,
             p.cso AS cso,
             p.csp_slug AS csp_slug,
             p.impact_level AS impact_level,
             p.status AS status
        FROM fedramp_authorizations auth
        JOIN fedramp_products p ON p.fedramp_id = auth.fedramp_id
       WHERE auth.agency_id = ?
       ORDER BY auth.ato_issuance_date DESC
    `)
    .all(agencyId);
}

export function getFedrampSnapshot(): FedrampSnapshot | null {
  return (
    getDb()
      .prepare<[], FedrampSnapshot>(
        `SELECT snapshot_date, product_count, ato_event_count, agency_count,
                csp_count, assessor_count, built_at
           FROM fedramp_snapshot WHERE id = 1`,
      )
      .get() ?? null
  );
}

// -----------------------------------------------------------------------------
// Cross-reference / coverage
// -----------------------------------------------------------------------------

/**
 * All FedRAMP products linked to a given inventory product. Strong
 * `alias_match` rows + `manual_csv` overrides + `research_w1_w2_w3` rows
 * are surfaced through the same helper so consumers don't have to know
 * about the source distinction.
 *
 * Phase-5 inheritance: when no direct link exists, we walk up
 * `parent_product_id` (cap = 5 hops) and surface the parent's links with
 * `inherited_from_parent_id` set to the ancestor whose row matched. Direct
 * links return `inherited_from_parent_id = null`.
 */
export function getFedrampLinksForInventoryProduct(
  inventoryProductId: number,
): Array<FedrampProduct & {
  confidence: string;
  source: string;
  score: number | null;
  inherited_from_parent_id: number | null;
  inherited_from_parent_name: string | null;
}> {
  return getDb()
    .prepare<
      [number],
      FedrampProduct & {
        confidence: string;
        source: string;
        score: number | null;
        inherited_from_parent_id: number | null;
        inherited_from_parent_name: string | null;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE},
      -- Dedupe to one row per (inventory_product_id, fedramp_id): prefer the
      -- shallowest depth (direct over inherited), then 'manual' confidence,
      -- then highest score. Keeps the React-key invariant on the consumer.
      ranked AS (
        SELECT efl.*,
               ROW_NUMBER() OVER (
                 PARTITION BY efl.inventory_product_id, efl.fedramp_id
                 ORDER BY efl.inherited_depth ASC,
                          CASE efl.confidence
                            WHEN 'manual' THEN 0
                            WHEN 'strong' THEN 1
                            WHEN 'weak'   THEN 2
                            ELSE 3
                          END,
                          efl.score DESC NULLS LAST
               ) AS rn
          FROM effective_fedramp_links efl
      )
      SELECT p.*,
             r.confidence AS confidence,
             r.source AS source,
             r.score AS score,
             r.inherited_from_parent_id AS inherited_from_parent_id,
             parent.canonical_name AS inherited_from_parent_name
        FROM ranked r
        JOIN fedramp_products p ON p.fedramp_id = r.fedramp_id
        LEFT JOIN products parent ON parent.id = r.inherited_from_parent_id
       WHERE r.inventory_product_id = ?
         AND r.rn = 1
       ORDER BY r.inherited_depth ASC, r.confidence DESC, r.score DESC
    `)
    .all(inventoryProductId);
}

/** Reverse direction — every inventory product linked to a single FedRAMP id. */
export function getInventoryProductsForFedrampProduct(
  fedrampId: string,
): Array<{
  id: number;
  canonical_name: string;
  vendor: string | null;
  use_case_count: number;
  agency_count: number;
}> {
  return getDb()
    .prepare<
      [string],
      {
        id: number;
        canonical_name: string;
        vendor: string | null;
        use_case_count: number;
        agency_count: number;
      }
    >(`
      SELECT p.id,
             p.canonical_name,
             p.vendor,
             COALESCE(uc_counts.use_case_count, 0) AS use_case_count,
             COALESCE(uc_counts.agency_count, 0) AS agency_count
        FROM fedramp_product_links l
        JOIN products p ON p.id = l.inventory_product_id
        LEFT JOIN (
          SELECT product_id,
                 COUNT(*) AS use_case_count,
                 COUNT(DISTINCT agency_id) AS agency_count
            FROM entry_product_edges
           GROUP BY product_id
        ) uc_counts ON uc_counts.product_id = p.id
       WHERE l.fedramp_id = ?
       ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
    `)
    .all(fedrampId);
}

/**
 * Multi-valued FedRAMP attributes (one CSO can have many business functions
 * and serve as multiple service models). Returned as Maps keyed by
 * fedramp_id for efficient join in the products listing.
 */
export function getFedrampProductBusinessFunctions(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const rows = getDb()
    .prepare<[], { fedramp_id: string; function: string }>(
      `SELECT fedramp_id, function FROM fedramp_business_functions ORDER BY function COLLATE NOCASE ASC`,
    )
    .all();
  for (const r of rows) {
    const arr = result.get(r.fedramp_id);
    if (arr) arr.push(r.function);
    else result.set(r.fedramp_id, [r.function]);
  }
  return result;
}

export function getFedrampProductServiceModels(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const rows = getDb()
    .prepare<[], { fedramp_id: string; model: string }>(
      `SELECT fedramp_id, model FROM fedramp_service_models ORDER BY model COLLATE NOCASE ASC`,
    )
    .all();
  for (const r of rows) {
    const arr = result.get(r.fedramp_id);
    if (arr) arr.push(r.model);
    else result.set(r.fedramp_id, [r.model]);
  }
  return result;
}

/** Distinct values for facet dropdowns (alphabetized). */
export function getDistinctBusinessFunctions(): string[] {
  return getDb()
    .prepare<[], { function: string }>(
      `SELECT DISTINCT function FROM fedramp_business_functions ORDER BY function COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.function);
}

export function getDistinctServiceModels(): string[] {
  return getDb()
    .prepare<[], { model: string }>(
      `SELECT DISTINCT model FROM fedramp_service_models ORDER BY model COLLATE NOCASE ASC`,
    )
    .all()
    .map((r) => r.model);
}

/**
 * Forward supply-chain edge: the other CSOs this product `leverages` (depends
 * on). The source data's `system_name` is free text and only resolves to a
 * fedramp_id for ~half the rows; unresolved rows render as plain labels.
 * Resolution is case-insensitive against `fedramp_products.cso`.
 */
export function getLeveragedSystemsForFedrampProduct(
  fedrampId: string,
): Array<{
  system_name: string;
  target_fedramp_id: string | null;
  target_csp: string | null;
  target_cso: string | null;
  target_status: string | null;
  target_impact_level: string | null;
}> {
  return getDb()
    .prepare<
      [string],
      {
        system_name: string;
        target_fedramp_id: string | null;
        target_csp: string | null;
        target_cso: string | null;
        target_status: string | null;
        target_impact_level: string | null;
      }
    >(`
      SELECT ls.system_name,
             p.fedramp_id   AS target_fedramp_id,
             p.csp          AS target_csp,
             p.cso          AS target_cso,
             p.status       AS target_status,
             p.impact_level AS target_impact_level
        FROM fedramp_leveraged_systems ls
        LEFT JOIN fedramp_products p
          ON LOWER(p.cso) = LOWER(ls.system_name)
       WHERE ls.fedramp_id = ?
       ORDER BY ls.system_name COLLATE NOCASE ASC
    `)
    .all(fedrampId);
}

/**
 * Reverse supply-chain edge: which other CSOs `leverage` THIS product. Joins
 * back via the same fuzzy `system_name`↔`cso` match used in the forward
 * direction. Empty when the product is a leaf (nothing depends on it).
 */
export function getProductsLeveragedBy(
  fedrampId: string,
): Array<{
  source_fedramp_id: string;
  source_csp: string;
  source_cso: string;
  source_csp_slug: string;
  source_status: string;
  source_impact_level: string | null;
}> {
  return getDb()
    .prepare<
      [string],
      {
        source_fedramp_id: string;
        source_csp: string;
        source_cso: string;
        source_csp_slug: string;
        source_status: string;
        source_impact_level: string | null;
      }
    >(`
      SELECT src.fedramp_id   AS source_fedramp_id,
             src.csp          AS source_csp,
             src.cso          AS source_cso,
             src.csp_slug     AS source_csp_slug,
             src.status       AS source_status,
             src.impact_level AS source_impact_level
        FROM fedramp_products tgt
        JOIN fedramp_leveraged_systems ls
          ON LOWER(ls.system_name) = LOWER(tgt.cso)
        JOIN fedramp_products src
          ON src.fedramp_id = ls.fedramp_id
       WHERE tgt.fedramp_id = ?
       ORDER BY src.csp COLLATE NOCASE ASC, src.cso COLLATE NOCASE ASC
    `)
    .all(fedrampId);
}

/**
 * The full ATO scope for a single inventory agency. Joins inventory agency →
 * fedramp_agency_links → fedramp_authorizations → fedramp_products, and
 * cross-references which of those products the agency *also* mentions in its
 * inventory (via fedramp_product_links → use_cases/consolidated_use_cases).
 */
/**
 * AI-FILTERED: only returns FedRAMP products that have a row in
 * `fedramp_product_links` (i.e., are linked to a curated AI inventory
 * product). The unfiltered view would include the agency's full ATO
 * portfolio — out of scope for this AI-inventory dashboard's cross-reference
 * surfaces. Marketplace explorer helpers are intentionally NOT filtered.
 */
export function getAgencyAtoScope(
  inventoryAgencyId: number,
): Array<{
  fedramp_id: string;
  csp: string;
  cso: string;
  csp_slug: string;
  impact_level: string | null;
  status: string;
  ato_issuance_date: string | null;
  ato_expiration_date: string | null;
  appears_in_inventory: number;
}> {
  return getDb()
    .prepare<
      [number, number],
      {
        fedramp_id: string;
        csp: string;
        cso: string;
        csp_slug: string;
        impact_level: string | null;
        status: string;
        ato_issuance_date: string | null;
        ato_expiration_date: string | null;
        appears_in_inventory: number;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT p.fedramp_id,
             p.csp,
             p.cso,
             p.csp_slug,
             p.impact_level,
             p.status,
             MAX(auth.ato_issuance_date) AS ato_issuance_date,
             MAX(auth.ato_expiration_date) AS ato_expiration_date,
             CASE WHEN EXISTS (
               SELECT 1
                 FROM effective_fedramp_links fpl
                 JOIN entry_product_edges epe
                   ON epe.product_id = fpl.inventory_product_id
                WHERE fpl.fedramp_id = p.fedramp_id
                  AND epe.agency_id = ?
             ) THEN 1 ELSE 0 END AS appears_in_inventory
        FROM fedramp_agency_links al
        JOIN fedramp_authorizations auth ON auth.agency_id = al.fedramp_agency_id
        JOIN fedramp_products p ON p.fedramp_id = auth.fedramp_id
       WHERE al.inventory_agency_id = ?
         AND auth.fedramp_id IN (SELECT fedramp_id FROM effective_fedramp_links)
       GROUP BY p.fedramp_id
       ORDER BY p.impact_level_number DESC, p.csp COLLATE NOCASE ASC, p.cso COLLATE NOCASE ASC
    `)
    .all(inventoryAgencyId, inventoryAgencyId);
}

/**
 * Resolve a single use case's FedRAMP coverage state. Walks
 *   use_case → product (or use_case_products) → fedramp_product_links
 *   → fedramp_authorizations (filtered to the using agency).
 */
export function getUseCaseFedrampCoverage(
  useCaseId: number,
): {
  state: FedrampCoverageState;
  fedramp_products: FedrampProduct[];
  authorized_at_using_agency: boolean;
  /** True when ALL surfaced FedRAMP coverage came via a parent product walk
   *  (i.e. no direct link on the inventory product itself). Drives the
   *  "via parent platform" caveat on /use-cases/[slug]. */
  inherited_via_parent: boolean;
} {
  const db = getDb();
  const useCase = db
    .prepare<[number], { product_id: number | null; agency_id: number }>(
      `SELECT product_id, agency_id FROM use_cases WHERE id = ? LIMIT 1`,
    )
    .get(useCaseId);
  if (!useCase) {
    return {
      state: "no_link",
      fedramp_products: [],
      authorized_at_using_agency: false,
      inherited_via_parent: false,
    };
  }
  // Collect candidate inventory product ids from authoritative product edges.
  const productIds = new Set<number>();
  const extras = db
    .prepare<[number], { product_id: number }>(
      `SELECT product_id
         FROM entry_product_edges
        WHERE entry_kind = 'use_case'
          AND entry_id = ?`,
    )
    .all(useCaseId);
  for (const r of extras) productIds.add(r.product_id);

  if (productIds.size === 0) {
    return {
      state: "no_link",
      fedramp_products: [],
      authorized_at_using_agency: false,
      inherited_via_parent: false,
    };
  }
  const ids = [...productIds];
  const ph = ids.map(() => "?").join(",");
  const fedrampProducts = db
    .prepare<number[], FedrampProduct>(
      `WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
       SELECT DISTINCT p.*
         FROM effective_fedramp_links efl
         JOIN fedramp_products p ON p.fedramp_id = efl.fedramp_id
        WHERE efl.inventory_product_id IN (${ph})`,
    )
    .all(...ids);

  if (fedrampProducts.length === 0) {
    return {
      state: "no_fedramp",
      fedramp_products: [],
      authorized_at_using_agency: false,
      inherited_via_parent: false,
    };
  }

  // Coverage is "inherited" when every (inventory_product_id, fedramp_id) row
  // surfaced for these product ids came from a parent walk — i.e. no direct
  // link exists at any of the candidate inventory products.
  const directRow = db
    .prepare<number[], { c: number }>(
      `SELECT COUNT(*) AS c FROM fedramp_product_links
        WHERE inventory_product_id IN (${ph})`,
    )
    .get(...ids);
  const inheritedViaParent = (directRow?.c ?? 0) === 0;

  // Has the using agency authorized any of these FedRAMP products?
  const authRow = db
    .prepare<[number, ...string[]], { c: number }>(
      `SELECT COUNT(*) AS c
         FROM fedramp_authorizations auth
         JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
        WHERE al.inventory_agency_id = ?
          AND auth.fedramp_id IN (${fedrampProducts.map(() => "?").join(",")})`,
    )
    .get(useCase.agency_id, ...fedrampProducts.map((p) => p.fedramp_id));
  const authorized = (authRow?.c ?? 0) > 0;

  return {
    state: authorized ? "covered" : "outside_scope",
    fedramp_products: fedrampProducts,
    authorized_at_using_agency: authorized,
    inherited_via_parent: inheritedViaParent,
  };
}

/** Hub stats for /fedramp/coverage. */
export function getCoverageHubStats(): CoverageStat[] {
  const db = getDb();

  const totalInventoryProducts = (
    db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM products`).get() ?? { c: 0 }
  ).c;
  const matchedProducts = (
    db
      .prepare<[], { c: number }>(
        `WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
         SELECT COUNT(DISTINCT inventory_product_id) AS c FROM effective_fedramp_links`,
      )
      .get() ?? { c: 0 }
  ).c;

  // Mismatched: use cases whose product is FedRAMP-listed (directly or via
  // parent walk) but the using agency lacks an ATO for it.
  const mismatched = (
    db
      .prepare<[], { c: number }>(`
        WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
        SELECT COUNT(*) AS c
          FROM entry_product_edges epe
          JOIN effective_fedramp_links fpl ON fpl.inventory_product_id = epe.product_id
         WHERE NOT EXISTS (
           SELECT 1
             FROM fedramp_authorizations auth
             JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
            WHERE auth.fedramp_id = fpl.fedramp_id
              AND al.inventory_agency_id = epe.agency_id
         )
      `)
      .get() ?? { c: 0 }
  ).c;

  // Agencies with at least one mismatched use case.
  const agenciesWithGaps = (
    db
      .prepare<[], { c: number }>(`
        WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
        SELECT COUNT(DISTINCT epe.agency_id) AS c
          FROM entry_product_edges epe
          JOIN effective_fedramp_links fpl ON fpl.inventory_product_id = epe.product_id
         WHERE NOT EXISTS (
           SELECT 1
             FROM fedramp_authorizations auth
             JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
            WHERE auth.fedramp_id = fpl.fedramp_id
              AND al.inventory_agency_id = epe.agency_id
         )
      `)
      .get() ?? { c: 0 }
  ).c;

  // Inventory products that are FedRAMP-mapped but not used in any use case.
  // Phase-5: a product that gets its coverage via a parent walk also counts
  // as "mapped". A child whose parent is FedRAMP-linked is NOT "unused" if
  // any descendant of it is referenced; conversely the unused metric here
  // operates per-row so it still surfaces e.g. the platform parent rows
  // when nothing references them directly. Using effective_fedramp_links so
  // children whose parent is mapped are caught.
  const unusedProducts = (
    db
      .prepare<[], { c: number }>(`
        WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
        SELECT COUNT(DISTINCT fpl.inventory_product_id) AS c
         FROM effective_fedramp_links fpl
         WHERE NOT EXISTS (
           SELECT 1 FROM entry_product_edges epe
            WHERE epe.product_id = fpl.inventory_product_id
         )
      `)
      .get() ?? { c: 0 }
  ).c;

  const snapshot = getFedrampSnapshot();

  return [
    {
      key: "matched",
      label: "Inventory products mapped to FedRAMP",
      value: matchedProducts,
      denominator: totalInventoryProducts,
      description: "Inventory products with at least one FedRAMP authorization link.",
    },
    {
      key: "mismatched",
      label: "Use cases outside agency ATO scope",
      value: mismatched,
      description:
        "Use cases whose product is FedRAMP-listed but where the using agency has no matching ATO.",
    },
    {
      key: "agencies_with_gaps",
      label: "Agencies with FedRAMP gaps",
      value: agenciesWithGaps,
      description: "Agencies with at least one use case outside their own ATO scope.",
    },
    {
      key: "unused_products",
      label: "Mapped products with zero use cases",
      value: unusedProducts,
      description: "Products linked to FedRAMP but not referenced in any agency inventory.",
    },
    {
      key: "snapshot_date",
      label: "FedRAMP snapshot date",
      value: 0,
      description: snapshot?.snapshot_date ?? null,
    },
  ];
}

/** Panel 1 — vendor coverage rows. One per inventory product.
 *  Phase-5: links flow through `effective_fedramp_links` so children with
 *  inherited coverage are NOT shown as "no FedRAMP". `has_fedramp_link`
 *  counts both direct and inherited; `fedramp_inherited` flags inheritance. */
export function getCoverageVendorRows(): CoverageVendorRow[] {
  return getDb()
    .prepare<[], CoverageVendorRow>(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT p.id AS inventory_product_id,
             p.canonical_name,
             p.vendor,
             COALESCE(uc.use_case_count, 0) AS use_case_count,
             COALESCE(uc.agency_count, 0) AS agency_count,
             CASE WHEN fpl.fedramp_id IS NOT NULL THEN 1 ELSE 0 END AS has_fedramp_link,
             fpl.fedramp_id AS fedramp_id,
             fp.csp AS fedramp_csp,
             fp.cso AS fedramp_cso,
             fp.impact_level AS fedramp_impact_level,
             fp.status AS fedramp_status,
             COALESCE(ato.ato_count, 0) AS fedramp_ato_count,
             CASE WHEN fpl.inherited_from_parent_id IS NOT NULL THEN 1 ELSE 0 END
               AS fedramp_inherited
        FROM products p
        LEFT JOIN (
          SELECT product_id,
                 COUNT(*) AS use_case_count,
                 COUNT(DISTINCT agency_id) AS agency_count
            FROM entry_product_edges
           GROUP BY product_id
        ) uc ON uc.product_id = p.id
        LEFT JOIN (
          -- One representative effective link per inventory product. We
          -- prefer the shallowest (depth=0 = direct) and lowest fedramp_id
          -- as a deterministic tiebreaker.
          SELECT inventory_product_id,
                 MIN(fedramp_id) AS fedramp_id,
                 MIN(inherited_from_parent_id) AS inherited_from_parent_id
            FROM effective_fedramp_links
           GROUP BY inventory_product_id
        ) fpl ON fpl.inventory_product_id = p.id
        LEFT JOIN fedramp_products fp ON fp.fedramp_id = fpl.fedramp_id
        LEFT JOIN (
          SELECT fedramp_id, COUNT(*) AS ato_count
            FROM fedramp_authorizations
           GROUP BY fedramp_id
        ) ato ON ato.fedramp_id = fpl.fedramp_id
       ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Panel 2 — rights/safety × impact-level grid. One row per
 * (high_impact_designation, fedramp_impact_level) bucket reachable from
 * inventory use cases that *do* link to a FedRAMP product. Use cases
 * without a FedRAMP link are excluded; they belong on Panel 1's "no
 * FedRAMP" segment.
 */
export function getCoverageFitGrid(): CoverageFitCell[] {
  return getDb()
    .prepare<[], CoverageFitCell>(`
      SELECT t.high_impact_designation AS high_impact_designation,
             fp.impact_level AS fedramp_impact_level,
             COUNT(*) AS use_case_count
        FROM use_cases uc
        JOIN use_case_tags t ON t.use_case_id = uc.id
        JOIN entry_product_edges epe
          ON epe.entry_kind = 'use_case'
         AND epe.entry_id = uc.id
        JOIN fedramp_product_links fpl ON fpl.inventory_product_id = epe.product_id
        JOIN fedramp_products fp ON fp.fedramp_id = fpl.fedramp_id
       GROUP BY t.high_impact_designation, fp.impact_level
       ORDER BY t.high_impact_designation, fp.impact_level
    `)
    .all();
}

/** Panel 3 — agency coverage. */
/**
 * AI-FILTERED: `fedramp_authorized_count` only counts FedRAMP products with
 * a row in `fedramp_product_links` (linked to an AI-inventory product). The
 * unfiltered count would balloon to the agency's full ATO portfolio (e.g.
 * DOJ ~127) and miscompute the unreported gap. Marketplace explorer helpers
 * are intentionally NOT filtered.
 */
export function getCoverageAgencyRows(): CoverageAgencyRow[] {
  return getDb()
    .prepare<[], CoverageAgencyRow>(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT a.id AS inventory_agency_id,
             a.name AS agency_name,
             a.abbreviation AS agency_abbreviation,
             COALESCE(uc.use_case_count, 0) AS use_case_count,
             COALESCE(used.fedramp_used_count, 0) AS fedramp_used_count,
             COALESCE(authd.fedramp_authorized_count, 0) AS fedramp_authorized_count,
             CASE
               WHEN COALESCE(authd.fedramp_authorized_count, 0) >
                    COALESCE(used.fedramp_used_count, 0)
               THEN COALESCE(authd.fedramp_authorized_count, 0)
                  - COALESCE(used.fedramp_used_count, 0)
               ELSE 0
             END AS authorized_but_unreported
        FROM agencies a
        LEFT JOIN (
          SELECT agency_id, COUNT(*) AS use_case_count
            FROM (
              SELECT agency_id FROM use_cases
              UNION ALL
              SELECT agency_id FROM consolidated_use_cases
            )
           GROUP BY agency_id
        ) uc ON uc.agency_id = a.id
        LEFT JOIN (
          SELECT sub.agency_id,
                 COUNT(DISTINCT fpl.fedramp_id) AS fedramp_used_count
            FROM entry_product_edges sub
            JOIN effective_fedramp_links fpl ON fpl.inventory_product_id = sub.product_id
           GROUP BY sub.agency_id
        ) used ON used.agency_id = a.id
        LEFT JOIN (
          SELECT al.inventory_agency_id,
                 COUNT(DISTINCT auth.fedramp_id) AS fedramp_authorized_count
            FROM fedramp_authorizations auth
            JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
           WHERE auth.fedramp_id IN (SELECT fedramp_id FROM effective_fedramp_links)
           GROUP BY al.inventory_agency_id
        ) authd ON authd.inventory_agency_id = a.id
       WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
       ORDER BY use_case_count DESC, a.name COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Per-agency drill — the VA-style story page.
 *
 * AI-FILTERED: the `authorized_but_unreported` subquery only considers
 * FedRAMP products with a row in `fedramp_product_links` (i.e. linked to
 * a curated AI inventory product). Without this filter, the gap balloons
 * to the agency's full ATO portfolio (DOJ shows 127 ATOs, only ~20
 * AI-linked). Marketplace explorer helpers are intentionally NOT filtered.
 */
export function getCoverageAgencyDrill(
  agencyAbbr: string,
): CoverageAgencyDrill | null {
  const db = getDb();
  const agency = db
    .prepare<[string], { id: number; name: string; abbreviation: string }>(
      `SELECT id, name, abbreviation FROM agencies
        WHERE LOWER(abbreviation) = LOWER(?) LIMIT 1`,
    )
    .get(agencyAbbr);
  if (!agency) return null;

  const authorizedButUnreported = db
    .prepare<
      [number, number],
      {
        fedramp_id: string;
        csp: string;
        cso: string;
        impact_level: string | null;
        ato_issuance_date: string | null;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
      SELECT p.fedramp_id,
             p.csp,
             p.cso,
             p.impact_level,
             MAX(auth.ato_issuance_date) AS ato_issuance_date
        FROM fedramp_agency_links al
        JOIN fedramp_authorizations auth ON auth.agency_id = al.fedramp_agency_id
        JOIN fedramp_products p ON p.fedramp_id = auth.fedramp_id
       WHERE al.inventory_agency_id = ?
         AND auth.fedramp_id IN (SELECT fedramp_id FROM effective_fedramp_links)
         AND NOT EXISTS (
           SELECT 1
             FROM effective_fedramp_links fpl
             JOIN entry_product_edges epe ON epe.product_id = fpl.inventory_product_id
            WHERE fpl.fedramp_id = p.fedramp_id
              AND epe.agency_id = ?
         )
       GROUP BY p.fedramp_id
       ORDER BY p.impact_level_number DESC, p.csp COLLATE NOCASE ASC
    `)
    .all(agency.id, agency.id);

  // Mentioned-without-ATO: use cases at this agency whose product is
  // FedRAMP-listed (directly or via parent walk) but where the agency
  // has no ATO for it.
  const mentionedWithoutAto = db
    .prepare<
      [number, number],
      {
        inventory_product_id: number;
        canonical_name: string;
        use_case_count: number;
        fedramp_id: string | null;
        csp: string | null;
        cso: string | null;
      }
    >(`
      WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE},
      one_eff_link_per_product AS (
        SELECT inventory_product_id, MIN(fedramp_id) AS fedramp_id
          FROM effective_fedramp_links
         GROUP BY inventory_product_id
      )
      SELECT p.id AS inventory_product_id,
             p.canonical_name,
             COUNT(*) AS use_case_count,
             fpl.fedramp_id AS fedramp_id,
             fp.csp AS csp,
             fp.cso AS cso
        FROM entry_product_edges sub
        JOIN products p ON p.id = sub.product_id
        LEFT JOIN one_eff_link_per_product fpl ON fpl.inventory_product_id = p.id
        LEFT JOIN fedramp_products fp ON fp.fedramp_id = fpl.fedramp_id
       WHERE sub.agency_id = ?
         AND fpl.fedramp_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
             FROM fedramp_authorizations auth
             JOIN fedramp_agency_links al ON al.fedramp_agency_id = auth.agency_id
            WHERE auth.fedramp_id = fpl.fedramp_id
              AND al.inventory_agency_id = ?
         )
       GROUP BY p.id
       ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
    `)
    .all(agency.id, agency.id);

  // Unresolved tokens: surface the most-frequent vendor strings present at
  // this agency that lack a product link entirely. (Cheap proxy: count
  // free-text vendor_name occurrences on use_cases without a product_id.)
  const unresolvedTokens = db
    .prepare<
      [number],
      { token: string; count: number }
    >(`
      SELECT TRIM(LOWER(vendor_name)) AS token, COUNT(*) AS count
        FROM use_cases
       WHERE agency_id = ?
         AND product_id IS NULL
         AND vendor_name IS NOT NULL
         AND TRIM(vendor_name) <> ''
       GROUP BY TRIM(LOWER(vendor_name))
       ORDER BY count DESC
       LIMIT 20
    `)
    .all(agency.id);

  return {
    agency,
    authorized_but_unreported: authorizedButUnreported,
    mentioned_without_ato: mentionedWithoutAto,
    unresolved_tokens: unresolvedTokens,
  };
}

/** Panel 4 — FedRAMP-mapped inventory products with zero inventory mentions. */
export function getCoverageUnusedProducts(): Array<{
  inventory_product_id: number;
  canonical_name: string;
  vendor: string | null;
  fedramp_id: string;
  fedramp_csp: string;
  fedramp_cso: string;
  fedramp_impact_level: string | null;
  fedramp_ato_count: number;
}> {
  return getDb()
    .prepare<
      [],
      {
        inventory_product_id: number;
        canonical_name: string;
        vendor: string | null;
        fedramp_id: string;
        fedramp_csp: string;
        fedramp_cso: string;
        fedramp_impact_level: string | null;
        fedramp_ato_count: number;
      }
    >(`
      WITH RECURSIVE descendant_chain(root_id, descendant_id) AS (
        SELECT id, id FROM products
        UNION ALL
        SELECT dc.root_id, p.id
          FROM descendant_chain dc
          JOIN products p ON p.parent_product_id = dc.descendant_id
      )
      SELECT p.id AS inventory_product_id,
             p.canonical_name,
             p.vendor,
             fp.fedramp_id,
             fp.csp AS fedramp_csp,
             fp.cso AS fedramp_cso,
             fp.impact_level AS fedramp_impact_level,
             COALESCE(ato.c, 0) AS fedramp_ato_count
        FROM fedramp_product_links fpl
        JOIN products p ON p.id = fpl.inventory_product_id
        JOIN fedramp_products fp ON fp.fedramp_id = fpl.fedramp_id
        LEFT JOIN (
          SELECT fedramp_id, COUNT(*) AS c FROM fedramp_authorizations GROUP BY fedramp_id
        ) ato ON ato.fedramp_id = fp.fedramp_id
       -- A product is "unused" only if NO descendant (incl. self) is referenced
       -- from any authoritative product edge.
       WHERE NOT EXISTS (
         SELECT 1 FROM descendant_chain dc
          JOIN entry_product_edges epe ON epe.product_id = dc.descendant_id
         WHERE dc.root_id = p.id
       )
       ORDER BY ato.c DESC NULLS LAST, p.canonical_name COLLATE NOCASE ASC
    `)
    .all();
}

// -----------------------------------------------------------------------------
// Link curation queue
// -----------------------------------------------------------------------------

function _hydrateQueueRow(row: {
  id: number;
  link_kind: "product" | "agency";
  inventory_id: number;
  source_text: string | null;
  candidate_fedramp_ids: string | null;
  reason: string;
  status: string;
  decision_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  inventory_name: string | null;
  inventory_group: string | null;
}): LinkQueueRow {
  let candidates: LinkQueueRow["candidates"] = [];
  if (row.candidate_fedramp_ids) {
    try {
      const parsed = JSON.parse(row.candidate_fedramp_ids);
      if (Array.isArray(parsed)) candidates = parsed;
    } catch {
      // Malformed JSON — leave candidates empty rather than crash.
      candidates = [];
    }
  }
  return {
    id: row.id,
    link_kind: row.link_kind,
    inventory_id: row.inventory_id,
    source_text: row.source_text,
    reason: row.reason,
    status: row.status,
    decision_notes: row.decision_notes,
    candidates,
    created_at: row.created_at,
    updated_at: row.updated_at,
    inventory_name: row.inventory_name,
    inventory_group: row.inventory_group,
  };
}

const LINK_QUEUE_SELECT = `
  SELECT q.id,
         q.link_kind,
         q.inventory_id,
         q.source_text,
         q.candidate_fedramp_ids,
         q.reason,
         q.status,
         q.decision_notes,
         q.created_at,
         q.updated_at,
         CASE q.link_kind
           WHEN 'product' THEN p.canonical_name
           WHEN 'agency'  THEN a.name
         END AS inventory_name,
         CASE q.link_kind
           WHEN 'product' THEN p.vendor
           WHEN 'agency'  THEN a.agency_type
         END AS inventory_group
    FROM fedramp_link_queue q
    LEFT JOIN products p ON q.link_kind = 'product' AND p.id = q.inventory_id
    LEFT JOIN agencies a ON q.link_kind = 'agency'  AND a.id = q.inventory_id
`;

/** Group queue rows by vendor (product) / reason / agency. */
export function getLinkQueueGroups(
  groupBy: "vendor" | "reason" | "agency",
): Array<{ key: string; label: string; count: number }> {
  const db = getDb();
  if (groupBy === "vendor") {
    return db
      .prepare<[], { key: string; label: string; count: number }>(`
        SELECT COALESCE(p.vendor, '(no vendor)') AS key,
               COALESCE(p.vendor, '(no vendor)') AS label,
               COUNT(*) AS count
          FROM fedramp_link_queue q
          LEFT JOIN products p ON p.id = q.inventory_id
         WHERE q.link_kind = 'product' AND q.status = 'pending'
         GROUP BY COALESCE(p.vendor, '(no vendor)')
         ORDER BY count DESC, label COLLATE NOCASE ASC
      `)
      .all();
  }
  if (groupBy === "reason") {
    return db
      .prepare<[], { key: string; label: string; count: number }>(`
        SELECT reason AS key,
               reason AS label,
               COUNT(*) AS count
          FROM fedramp_link_queue
         WHERE status = 'pending'
         GROUP BY reason
         ORDER BY count DESC
      `)
      .all();
  }
  // agency
  return db
    .prepare<[], { key: string; label: string; count: number }>(`
      SELECT COALESCE(a.abbreviation, '(no agency)') AS key,
             COALESCE(a.name, '(no agency)') AS label,
             COUNT(*) AS count
        FROM fedramp_link_queue q
        LEFT JOIN agencies a ON a.id = q.inventory_id
       WHERE q.link_kind = 'agency' AND q.status = 'pending'
       GROUP BY COALESCE(a.abbreviation, '(no agency)')
       ORDER BY count DESC, label COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Queue rows for a single group (used by the curation page and CSV export).
 * `value` is the group key returned by `getLinkQueueGroups`. Pass
 * `filter.group = '*'` and any value to fetch all pending rows.
 */
export function getLinkQueueRows(filter: {
  group: "vendor" | "reason" | "agency" | "*";
  value: string;
}): LinkQueueRow[] {
  const db = getDb();
  type Row = Parameters<typeof _hydrateQueueRow>[0];
  let rows: Row[];
  if (filter.group === "*") {
    rows = db
      .prepare<[], Row>(
        `${LINK_QUEUE_SELECT} WHERE q.status = 'pending' ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all();
  } else if (filter.group === "vendor") {
    rows = db
      .prepare<[string], Row>(
        `${LINK_QUEUE_SELECT}
         WHERE q.link_kind = 'product'
           AND q.status = 'pending'
           AND COALESCE(p.vendor, '(no vendor)') = ?
         ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all(filter.value);
  } else if (filter.group === "reason") {
    rows = db
      .prepare<[string], Row>(
        `${LINK_QUEUE_SELECT}
         WHERE q.status = 'pending' AND q.reason = ?
         ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all(filter.value);
  } else {
    rows = db
      .prepare<[string], Row>(
        `${LINK_QUEUE_SELECT}
         WHERE q.link_kind = 'agency'
           AND q.status = 'pending'
           AND COALESCE(a.abbreviation, '(no agency)') = ?
         ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all(filter.value);
  }
  return rows.map(_hydrateQueueRow);
}

// -----------------------------------------------------------------------------
// Cross-cut summaries (drives /browse/[dimension] pages and the home-page
// "Cross-cuts" row). One dimension = one tag/column we want to slice the
// entire inventory by. See lib/urls.ts CrossCutDimension for the slug list.
// -----------------------------------------------------------------------------

/** Discriminator for the supported cross-cut dimensions. Mirrors
 *  CrossCutDimension in lib/urls.ts but extended with `vendor` for the
 *  product-side cross-cut. */

// -----------------------------------------------------------------------------
// Peer similarity — "Use cases like this" panel on /use-cases/[slug].
//
// Definition of "like": shares >= 3 of these tag-value dimensions with the
// input use case (sophistication, scope, use_type, high_impact, entry_type,
// topic_area). Excludes the input itself and same-agency entries (otherwise
// the result collapses to "more from this agency", which we already show).
//
// Ranking: shared-dimension count desc, then operational_date desc (most
// recent first), then use_case_name asc.
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

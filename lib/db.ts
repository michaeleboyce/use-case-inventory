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

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
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
  UseCaseTag,
  UseCaseTemplate,
  UseCaseWithTags,
  VendorShareRow,
  YoYRow,
} from "./types";

/**
 * Normalize the 30+ free-text variants of `use_cases.stage_of_development`
 * into the 4 canonical OMB M-25-21 buckets. Usage:
 *   SELECT ${STAGE_BUCKET_SQL} AS stage_bucket FROM use_cases uc ...
 * Returns one of: 'pre_deployment' | 'pilot' | 'deployed' | 'retired' | 'unknown'.
 * Declared near the top of the file so it's safely accessible from
 * `getGlobalStats` and other functions above the main query-builders (const
 * declarations are not hoisted, so putting it below caused a temporal-dead-
 * zone ReferenceError when the home page rendered).
 */
export const STAGE_BUCKET_SQL = `
  CASE
    WHEN uc.stage_of_development IS NULL OR TRIM(uc.stage_of_development) = ''
      THEN 'unknown'
    WHEN LOWER(uc.stage_of_development) LIKE '%retired%'
      THEN 'retired'
    WHEN LOWER(uc.stage_of_development) LIKE '%pilot%'
      THEN 'pilot'
    WHEN LOWER(uc.stage_of_development) LIKE '%deployed%'
      THEN 'deployed'
    WHEN LOWER(uc.stage_of_development) LIKE '%pre-deployment%'
      OR LOWER(uc.stage_of_development) LIKE '%pre deployment%'
      OR LOWER(uc.stage_of_development) LIKE '%development or acquisition%'
      THEN 'pre_deployment'
    ELSE 'unknown'
  END
`;

// -----------------------------------------------------------------------------
// Connection singleton
// -----------------------------------------------------------------------------

// Prefer an in-project copy of the DB so the file travels with the Next.js
// bundle on Vercel (where `process.cwd()` is the function root, not the repo
// root). Fall back to the parent-directory layout used during local ETL
// iteration where the dashboard lives next to the data/ folder.
const DB_PATH = (() => {
  const inProject = path.join(process.cwd(), "data", "federal_ai_inventory_2025.db");
  const parent = path.join(process.cwd(), "..", "data", "federal_ai_inventory_2025.db");
  if (fs.existsSync(inProject)) return inProject;
  if (fs.existsSync(parent)) return parent;
  // Final fallback: let better-sqlite3 raise the familiar "not found" error
  // against the in-project path so messages point at the right place.
  return inProject;
})();

// Cache the handle across hot-reloads in dev. Node's module cache already
// gives us per-process caching in production.
declare global {
  // eslint-disable-next-line no-var
  var __aiInventoryDb: Database.Database | undefined;
}

function getDb(): Database.Database {
  if (!globalThis.__aiInventoryDb) {
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    // Read-only connection: no journal mode change needed. A small cache
    // pragma keeps frequently-used pages warm without bloating RSS.
    db.pragma("cache_size = -32000"); // ~32 MB page cache
    globalThis.__aiInventoryDb = db;
  }
  return globalThis.__aiInventoryDb;
}

/** Expose a raw handle for ad-hoc scripts. Do not use from React trees. */
export function rawDb(): Database.Database {
  return getDb();
}

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
export function getAgencies(): Agency[] {
  const stmt = getDb().prepare<[], Agency>(`
    SELECT *
      FROM agencies
     WHERE status IN ('FOUND_2025', 'FOUND_2024_ONLY')
     ORDER BY name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

/** Every row in the `agencies` table, including those with no data. */
export function getAllAgenciesIncludingEmpty(): Agency[] {
  const stmt = getDb().prepare<[], Agency>(`
    SELECT * FROM agencies ORDER BY name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

/** Look up a single agency by its abbreviation (e.g. "VA", "DHS"). */
export function getAgencyByAbbr(abbr: string): AgencyWithMaturity | null {
  const stmt = getDb().prepare<[string], Agency>(`
    SELECT * FROM agencies WHERE LOWER(abbreviation) = LOWER(?) LIMIT 1
  `);
  const agency = stmt.get(abbr);
  if (!agency) return null;
  const maturity = getMaturityForAgency(agency.id);
  return { ...agency, maturity };
}

/** Look up a single agency by numeric primary key. */
export function getAgencyById(id: number): AgencyWithMaturity | null {
  const stmt = getDb().prepare<[number], Agency>(
    `SELECT * FROM agencies WHERE id = ? LIMIT 1`,
  );
  const agency = stmt.get(id);
  if (!agency) return null;
  const maturity = getMaturityForAgency(agency.id);
  return { ...agency, maturity };
}

function getMaturityForAgency(agencyId: number): AgencyMaturity | null {
  const stmt = getDb().prepare<[number], AgencyMaturity>(
    `SELECT * FROM agency_ai_maturity WHERE agency_id = ? LIMIT 1`,
  );
  return stmt.get(agencyId) ?? null;
}

/** Every `agency_ai_maturity` row joined onto its parent agency. */
export function getAgencyMaturity(): AgencyWithMaturity[] {
  // We query the two tables in one shot and assemble into the shape
  // `AgencyWithMaturity` on the JS side. Two prepared statements are cheap.
  const agencies = getDb()
    .prepare<[], Agency>(
      `SELECT a.*
         FROM agencies a
         JOIN agency_ai_maturity m ON m.agency_id = a.id
        ORDER BY a.name COLLATE NOCASE ASC`,
    )
    .all();
  const maturityRows = getDb()
    .prepare<[], AgencyMaturity>(`SELECT * FROM agency_ai_maturity`)
    .all();
  const byAgency = new Map<number, AgencyMaturity>();
  for (const m of maturityRows) byAgency.set(m.agency_id, m);
  return agencies.map((a) => ({ ...a, maturity: byAgency.get(a.id) ?? null }));
}

// -----------------------------------------------------------------------------
// Global stats (for homepage / About page)
// -----------------------------------------------------------------------------

export function getGlobalStats(): GlobalStats {
  const db = getDb();
  const total_use_cases = (
    db.prepare(`SELECT COUNT(*) AS c FROM use_cases`).get() as { c: number }
  ).c;
  const total_consolidated = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM consolidated_use_cases`)
      .get() as { c: number }
  ).c;
  const total_agencies = (
    db.prepare(`SELECT COUNT(*) AS c FROM agencies`).get() as { c: number }
  ).c;
  const total_agencies_with_data = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT agency_id) AS c FROM inventory_entries`,
      )
      .get() as { c: number }
  ).c;
  const total_products = (
    db.prepare(`SELECT COUNT(*) AS c FROM products`).get() as { c: number }
  ).c;
  const total_templates = (
    db.prepare(`SELECT COUNT(*) AS c FROM use_case_templates`).get() as {
      c: number;
    }
  ).c;
  const total_coding_entries = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM use_case_tags WHERE is_coding_tool = 1`)
      .get() as { c: number }
  ).c;
  const total_genai_entries = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM use_case_tags WHERE is_generative_ai = 1`,
      )
      .get() as { c: number }
  ).c;
  const total_high_impact_entries = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM use_case_tags WHERE high_impact_designation = 'high_impact'`,
      )
      .get() as { c: number }
  ).c;

  // Stage-bucket counts over canonical use_cases only. Consolidated rows
  // have no stage_of_development column so they're excluded from this mix.
  const stageRows = db
    .prepare<[], { bucket: string; c: number }>(
      `SELECT ${STAGE_BUCKET_SQL} AS bucket, COUNT(*) AS c FROM use_cases uc GROUP BY bucket`,
    )
    .all();
  const stage_bucket_counts: Record<string, number> = {
    pre_deployment: 0,
    pilot: 0,
    deployed: 0,
    retired: 0,
    unknown: 0,
  };
  for (const r of stageRows) stage_bucket_counts[r.bucket] = r.c;

  return {
    total_use_cases,
    total_consolidated,
    total_agencies,
    total_agencies_with_data,
    total_products,
    total_templates,
    total_coding_entries,
    total_genai_entries,
    total_high_impact_entries,
    stage_bucket_counts,
  };
}

// -----------------------------------------------------------------------------
// Use cases
// -----------------------------------------------------------------------------

const USE_CASE_SELECT = `
  SELECT uc.*,
         a.name AS agency_name,
         a.abbreviation AS agency_abbreviation,
         p.canonical_name AS product_name,
         t.short_name AS template_short_name
    FROM use_cases uc
    JOIN agencies a ON a.id = uc.agency_id
    LEFT JOIN products p ON p.id = uc.product_id
    LEFT JOIN use_case_templates t ON t.id = uc.template_id
`;

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
 * Full-text / faceted search over use cases. All filters are optional and
 * combined with AND. Pagination via `limit` / `offset`.
 */
export function getUseCasesFiltered(
  filters: UseCaseFilterInput = {},
): { rows: UseCaseWithTags[]; total: number } {
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

  if (joinTags) {
    if (filters.entryType) {
      where.push("tag.entry_type = ?");
      params.push(filters.entryType);
    }
    if (filters.deploymentScope) {
      where.push("tag.deployment_scope = ?");
      params.push(filters.deploymentScope);
    }
    if (filters.aiSophistication) {
      where.push("tag.ai_sophistication = ?");
      params.push(filters.aiSophistication);
    }
    if (filters.isCodingTool === true) where.push("tag.is_coding_tool = 1");
    if (filters.isCodingTool === false) where.push("COALESCE(tag.is_coding_tool,0) = 0");
    if (filters.isGenAI === true) where.push("tag.is_generative_ai = 1");
    if (filters.isGenAI === false) where.push("COALESCE(tag.is_generative_ai,0) = 0");

    // Multi-value tag filters
    if (filters.entryTypes && filters.entryTypes.length > 0) {
      where.push(
        `tag.entry_type IN (${filters.entryTypes.map(() => "?").join(",")})`,
      );
      params.push(...filters.entryTypes);
    }
    if (filters.deploymentScopes && filters.deploymentScopes.length > 0) {
      where.push(
        `tag.deployment_scope IN (${filters.deploymentScopes.map(() => "?").join(",")})`,
      );
      params.push(...filters.deploymentScopes);
    }
    if (filters.aiSophistications && filters.aiSophistications.length > 0) {
      where.push(
        `tag.ai_sophistication IN (${filters.aiSophistications.map(() => "?").join(",")})`,
      );
      params.push(...filters.aiSophistications);
    }
    if (filters.architectureTypes && filters.architectureTypes.length > 0) {
      where.push(
        `tag.architecture_type IN (${filters.architectureTypes.map(() => "?").join(",")})`,
      );
      params.push(...filters.architectureTypes);
    }
    if (filters.useTypes && filters.useTypes.length > 0) {
      where.push(
        `tag.use_type IN (${filters.useTypes.map(() => "?").join(",")})`,
      );
      params.push(...filters.useTypes);
    }
    if (
      filters.highImpactDesignations &&
      filters.highImpactDesignations.length > 0
    ) {
      where.push(
        `tag.high_impact_designation IN (${filters.highImpactDesignations.map(() => "?").join(",")})`,
      );
      params.push(...filters.highImpactDesignations);
    }
    if (filters.isGeneralLLMAccess === true)
      where.push("tag.is_general_llm_access = 1");
    if (filters.isPublicFacing === true) where.push("tag.is_public_facing = 1");
    if (filters.hasATOorFedRAMP === true)
      where.push("tag.has_ato_or_fedramp = 1");
    if (filters.hasMeaningfulRiskDocs === true)
      where.push("tag.has_meaningful_risk_docs = 1");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tagJoin = joinTags
    ? "LEFT JOIN use_case_tags tag ON tag.use_case_id = uc.id"
    : "";

  const limit = Math.min(filters.limit ?? 100, 1000);
  const offset = filters.offset ?? 0;

  const sql = `
    ${USE_CASE_SELECT.replace("FROM use_cases uc", `FROM use_cases uc ${tagJoin}`)}
    ${whereSql}
    ORDER BY uc.use_case_name COLLATE NOCASE ASC
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS c
      FROM use_cases uc
      JOIN agencies a ON a.id = uc.agency_id
      ${tagJoin}
      ${whereSql}
  `;

  const rows = getDb()
    .prepare<(string | number)[], JoinedUseCaseRow>(sql)
    .all(...params, limit, offset);
  const total = (
    getDb()
      .prepare<(string | number)[], { c: number }>(countSql)
      .get(...params) ?? { c: 0 }
  ).c;

  return { rows: attachTagsToUseCases(rows), total };
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

export function getProductCatalogStats(): ProductCatalogStats {
  return getDb()
    .prepare<[], ProductCatalogStats>(
      `
      SELECT
        (SELECT COUNT(*) FROM products) AS canonical_products,
        (SELECT COUNT(*) FROM products WHERE product_origin = 'commercial') AS commercial_products,
        (SELECT COUNT(*) FROM products WHERE product_origin = 'agency_internal_platform') AS agency_internal_products,
        (SELECT COUNT(DISTINCT vendor) FROM products WHERE vendor IS NOT NULL AND TRIM(vendor) <> '') AS distinct_vendors,
        (SELECT COUNT(*) FROM entry_product_edges) AS linked_entry_product_edges,
        (SELECT COUNT(*) FROM (
          SELECT DISTINCT entry_kind, entry_id FROM entry_product_edges
        )) AS linked_entries,
        (SELECT COUNT(*) FROM review_queue_products WHERE COALESCE(llm_reviewed, 0) = 0) AS pending_product_reviews
      `,
    )
    .get()!;
}

/** All products with usage counts from authoritative product-edge rows. */
export function getAllProducts(): ProductWithCounts[] {
  const stmt = getDb().prepare<[], ProductWithCounts>(`
    SELECT p.*,
           COALESCE(uc_counts.use_case_count, 0) AS use_case_count,
           COALESCE(uc_counts.agency_count, 0) AS agency_count
      FROM products p
      LEFT JOIN (
        SELECT product_id,
               COUNT(*) AS use_case_count,
               COUNT(DISTINCT agency_id) AS agency_count
          FROM entry_product_edges
         GROUP BY product_id
      ) uc_counts ON uc_counts.product_id = p.id
     ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

/** Product detail with aliases + list of agencies that have deployed it. */
export function getProductById(id: number): ProductDetail | null {
  const db = getDb();
  const product = db
    .prepare<[number], Product>(`SELECT * FROM products WHERE id = ? LIMIT 1`)
    .get(id);
  if (!product) return null;

  const aliases = db
    .prepare<[number], { alias_text: string }>(
      `SELECT alias_text FROM product_aliases WHERE product_id = ? ORDER BY alias_text`,
    )
    .all(id)
    .map((r) => r.alias_text);

  const agencies = db
    .prepare<
      [number],
      { id: number; name: string; abbreviation: string; count: number }
    >(`
      SELECT a.id, a.name, a.abbreviation, COUNT(*) AS count
        FROM entry_product_edges epe
        JOIN agencies a ON a.id = epe.agency_id
       WHERE epe.product_id = ?
       GROUP BY a.id
       ORDER BY count DESC, a.name COLLATE NOCASE ASC
    `)
    .all(id);

  const use_case_count = (
    db
      .prepare<[number], { c: number }>(
        `SELECT COUNT(*) AS c FROM entry_product_edges WHERE product_id = ?`,
      )
      .get(id) ?? { c: 0 }
  ).c;

  return { ...product, aliases, agencies, use_case_count };
}

/** Top products by distinct-agency adoption. */
export function getTopProducts(n = 10): ProductWithCounts[] {
  return getAllProducts()
    .slice()
    .sort((a, b) => b.agency_count - a.agency_count)
    .slice(0, n);
}

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

export function getAllTemplates(): TemplateWithCounts[] {
  // Templates are referenced from both use_cases and consolidated_use_cases;
  // count across both so the list view matches reality.
  const stmt = getDb().prepare<[], TemplateWithCounts>(`
    SELECT t.*,
           COALESCE(counts.use_case_count, 0) AS use_case_count,
           COALESCE(counts.agency_count, 0) AS agency_count
      FROM use_case_templates t
      LEFT JOIN (
        SELECT template_id,
               COUNT(*) AS use_case_count,
               COUNT(DISTINCT agency_id) AS agency_count
          FROM (
            SELECT template_id, agency_id FROM use_cases
              WHERE template_id IS NOT NULL
            UNION ALL
            SELECT template_id, agency_id FROM consolidated_use_cases
              WHERE template_id IS NOT NULL
          )
         GROUP BY template_id
      ) counts ON counts.template_id = t.id
     ORDER BY use_case_count DESC, t.short_name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

export function getTemplateById(id: number): TemplateDetail | null {
  const db = getDb();
  const template = db
    .prepare<[number], UseCaseTemplate>(
      `SELECT * FROM use_case_templates WHERE id = ? LIMIT 1`,
    )
    .get(id);
  if (!template) return null;

  // Templates can be referenced from either `use_cases` or
  // `consolidated_use_cases` (the Appendix B COTS table is the common case).
  // Both must be unioned so the stats on the template detail page reflect
  // actual usage — otherwise template_id references that only exist on the
  // consolidated side are silently dropped.
  const agencies = db
    .prepare<[number, number], { id: number; name: string; abbreviation: string; count: number }>(`
      SELECT a.id, a.name, a.abbreviation, SUM(n) AS count
        FROM (
          SELECT agency_id, COUNT(*) AS n FROM use_cases
            WHERE template_id = ? GROUP BY agency_id
          UNION ALL
          SELECT agency_id, COUNT(*) AS n FROM consolidated_use_cases
            WHERE template_id = ? GROUP BY agency_id
        ) sub
        JOIN agencies a ON a.id = sub.agency_id
       GROUP BY a.id
       ORDER BY count DESC, a.name COLLATE NOCASE ASC
    `)
    .all(id, id);

  const products = db
    .prepare<[number], { id: number; canonical_name: string; vendor: string | null; count: number }>(`
      SELECT p.id, p.canonical_name, p.vendor, COUNT(*) AS count
        FROM entry_product_edges epe
        JOIN inventory_entries ie
          ON ie.entry_kind = epe.entry_kind
         AND ie.entry_id = epe.entry_id
        JOIN products p ON p.id = epe.product_id
       WHERE ie.template_id = ?
       GROUP BY p.id
       ORDER BY count DESC, p.canonical_name COLLATE NOCASE ASC
    `)
    .all(id);

  const use_case_count = (
    db
      .prepare<[number, number], { c: number }>(
        `SELECT
           (SELECT COUNT(*) FROM use_cases WHERE template_id = ?)
           +
           (SELECT COUNT(*) FROM consolidated_use_cases WHERE template_id = ?)
           AS c`,
      )
      .get(id, id) ?? { c: 0 }
  ).c;

  return { ...template, agencies, products, use_case_count };
}

// -----------------------------------------------------------------------------
// Per-agency breakdown helpers (for donut/stacked charts on agency pages)
// -----------------------------------------------------------------------------

export function getBureauBreakdown(agencyId: number): BureauBreakdown[] {
  const stmt = getDb().prepare<[number], BureauBreakdown>(`
    SELECT COALESCE(bureau_component, '(Unassigned)') AS label,
           bureau_component,
           COUNT(*) AS count
      FROM use_cases
     WHERE agency_id = ?
     GROUP BY bureau_component
     ORDER BY count DESC
  `);
  return stmt.all(agencyId);
}

/*
 * The per-agency breakdown helpers below union use_case_tags rows from BOTH
 * source tables (individual and consolidated) so the donuts on the agency
 * detail page reflect every entry the agency filed — not just the individual
 * ones. `use_case_tags` carries either `use_case_id` OR
 * `consolidated_use_case_id`, never both, so the CHECK constraint on the
 * table guarantees a clean union.
 */
export function getEntryTypeBreakdown(agencyId: number): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT COALESCE(entry_type, 'unknown') AS label, COUNT(*) AS count
      FROM (
        SELECT t.entry_type FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT t.entry_type FROM use_case_tags t
          JOIN consolidated_use_cases c ON c.id = t.consolidated_use_case_id
         WHERE c.agency_id = ?
      )
     GROUP BY entry_type
     ORDER BY count DESC
  `);
  return stmt.all(agencyId, agencyId);
}

export function getAISophisticationBreakdown(
  agencyId: number,
): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT COALESCE(ai_sophistication, 'unknown') AS label, COUNT(*) AS count
      FROM (
        SELECT t.ai_sophistication FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT t.ai_sophistication FROM use_case_tags t
          JOIN consolidated_use_cases c ON c.id = t.consolidated_use_case_id
         WHERE c.agency_id = ?
      )
     GROUP BY ai_sophistication
     ORDER BY count DESC
  `);
  return stmt.all(agencyId, agencyId);
}

export function getDeploymentScopeBreakdown(
  agencyId: number,
): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT COALESCE(deployment_scope, 'unknown') AS label, COUNT(*) AS count
      FROM (
        SELECT t.deployment_scope FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT t.deployment_scope FROM use_case_tags t
          JOIN consolidated_use_cases c ON c.id = t.consolidated_use_case_id
         WHERE c.agency_id = ?
      )
     GROUP BY deployment_scope
     ORDER BY count DESC
  `);
  return stmt.all(agencyId, agencyId);
}

/** Per-agency rollup of distinct entries by IFP product category.
 *
 * Mirrors the global `getCategoryDistribution()` but filtered to one agency
 * and returns the BreakdownRow shape ({label, count}) used by the three
 * sibling per-agency breakdowns above. Counts each (entry, product_type)
 * pair once via UNION ALL across both use_cases and consolidated_use_cases
 * so an agency that uses 5 productivity products on one consolidated row
 * still counts that row as one productivity touch rather than 5.
 *
 * Excludes the 'unclassified' placeholder — same convention as
 * _crossCutSql for product_type and getCategoryDistribution. */
export function getCategoryDistributionForAgency(
  agencyId: number,
): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT p.product_type AS label, COUNT(*) AS count
      FROM (
        SELECT ucp.use_case_id AS entry_id, ucp.product_id
          FROM use_case_products ucp
          JOIN use_cases uc ON uc.id = ucp.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT cucp.consolidated_use_case_id AS entry_id, cucp.product_id
          FROM consolidated_use_case_products cucp
          JOIN consolidated_use_cases c ON c.id = cucp.consolidated_use_case_id
         WHERE c.agency_id = ?
      ) edges
      JOIN products p ON p.id = edges.product_id
     WHERE p.product_type IS NOT NULL
       AND TRIM(p.product_type) <> ''
       AND LOWER(TRIM(p.product_type)) <> 'unclassified'
     GROUP BY p.product_type
     ORDER BY count DESC, p.product_type COLLATE NOCASE ASC
  `);
  return stmt.all(agencyId, agencyId);
}

export function getProductsForAgency(
  agencyId: number,
): Array<{
  id: number;
  canonical_name: string;
  vendor: string | null;
  use_case_count: number;
}> {
  const stmt = getDb().prepare<
    [number],
    { id: number; canonical_name: string; vendor: string | null; use_case_count: number }
  >(`
    SELECT p.id, p.canonical_name, p.vendor, COUNT(*) AS use_case_count
      FROM entry_product_edges epe
      JOIN products p ON p.id = epe.product_id
     WHERE epe.agency_id = ?
     GROUP BY p.id
     ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
  `);
  return stmt.all(agencyId);
}

// -----------------------------------------------------------------------------
// Cross-cutting analytics
// -----------------------------------------------------------------------------

/** Year-over-year growth per agency (for analytics bar chart). */
export function getYoYGrowthData(): YoYRow[] {
  const stmt = getDb().prepare<[], YoYRow>(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           m.year_over_year_growth,
           m.total_use_cases
      FROM agency_ai_maturity m
      JOIN agencies a ON a.id = m.agency_id
     WHERE m.year_over_year_growth IS NOT NULL
     ORDER BY m.year_over_year_growth DESC
  `);
  return stmt.all();
}

/** Vendor market share = products/use cases/agencies per vendor. Drops
 *  vendors with zero attributed entries (catalog-only products with no
 *  inventory edges) so they don't pollute the chart with all-0 bars. */
export function getVendorMarketShare(): VendorShareRow[] {
  const stmt = getDb().prepare<[], VendorShareRow>(`
    SELECT p.vendor AS vendor,
           COUNT(DISTINCT p.id) AS product_count,
           COUNT(sub.product_id) AS use_case_count,
           COUNT(DISTINCT sub.agency_id) AS agency_count
      FROM products p
      LEFT JOIN entry_product_edges sub ON sub.product_id = p.id
     WHERE p.vendor IS NOT NULL AND p.vendor <> ''
     GROUP BY p.vendor
    HAVING COUNT(sub.product_id) > 0
     ORDER BY use_case_count DESC, agency_count DESC
  `);
  return stmt.all();
}

/** Per-IFP-category rollup: product count + use-case reach + agency count.
 *
 * Distinct from `getVendorMarketShare` (which buckets by `products.vendor`):
 * this buckets by `products.product_type`, the IFP-curated category. Excludes
 * the `'unclassified'` placeholder (set by cleanup_products_taxonomy.py for
 * any product with no assigned category) so the chart surfaces only
 * meaningful buckets.
 *
 * Used by /products §II "By category" chart. */
export function getCategoryDistribution(): CategoryDistributionRow[] {
  const stmt = getDb().prepare<[], CategoryDistributionRow>(`
    SELECT p.product_type AS category,
           COUNT(DISTINCT p.id) AS product_count,
           COUNT(DISTINCT ucp.use_case_id) AS use_case_count,
           COUNT(DISTINCT uc.agency_id) AS agency_count
      FROM products p
      LEFT JOIN use_case_products ucp ON ucp.product_id = p.id
      LEFT JOIN use_cases uc ON uc.id = ucp.use_case_id
     WHERE p.product_type IS NOT NULL
       AND TRIM(p.product_type) <> ''
       AND LOWER(TRIM(p.product_type)) <> 'unclassified'
     GROUP BY p.product_type
     ORDER BY use_case_count DESC, agency_count DESC, product_count DESC
  `);
  return stmt.all();
}

/** Product × agency heatmap cells (only non-zero combinations are returned). */
export function getProductAgencyHeatmap(): HeatmapCell[] {
  const stmt = getDb().prepare<[], HeatmapCell>(`
    SELECT p.id AS product_id,
           p.canonical_name AS product_name,
           a.id AS agency_id,
           a.abbreviation AS agency_abbreviation,
           COUNT(*) AS count
      FROM entry_product_edges sub
      JOIN products p ON p.id = sub.product_id
      JOIN agencies a ON a.id = sub.agency_id
     GROUP BY p.id, a.id
     ORDER BY count DESC
  `);
  return stmt.all();
}

/** Agencies ranked by coding-tool use case count. */
export function getCodingToolAgencies(): Array<{
  agency_id: number;
  name: string;
  abbreviation: string;
  coding_tool_count: number;
}> {
  const stmt = getDb().prepare<
    [],
    { agency_id: number; name: string; abbreviation: string; coding_tool_count: number }
  >(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           COALESCE(m.coding_tool_count, 0) AS coding_tool_count
      FROM agencies a
      LEFT JOIN agency_ai_maturity m ON m.agency_id = a.id
     WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
     ORDER BY coding_tool_count DESC, a.name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

/** Homepage: maturity-tier summary with member abbreviation lists. */
export function getMaturityTierSummary(): Array<{
  tier: string;
  count: number;
  agencies: Array<{ id: number; name: string; abbreviation: string }>;
}> {
  const db = getDb();
  const rows = db
    .prepare<
      [],
      { tier: string; id: number; name: string; abbreviation: string }
    >(`
      SELECT COALESCE(m.maturity_tier, 'none') AS tier,
             a.id AS id,
             a.name AS name,
             a.abbreviation AS abbreviation
        FROM agency_ai_maturity m
        JOIN agencies a ON a.id = m.agency_id
       ORDER BY a.abbreviation COLLATE NOCASE ASC
    `)
    .all();
  const order = ["leading", "progressing", "early", "minimal", "none"];
  const byTier = new Map<
    string,
    Array<{ id: number; name: string; abbreviation: string }>
  >();
  for (const t of order) byTier.set(t, []);
  for (const r of rows) {
    const key = byTier.has(r.tier) ? r.tier : "none";
    byTier.get(key)!.push({ id: r.id, name: r.name, abbreviation: r.abbreviation });
  }
  return order.map((tier) => ({
    tier,
    count: byTier.get(tier)?.length ?? 0,
    agencies: byTier.get(tier) ?? [],
  }));
}

/** Homepage: agency_type x maturity_tier pivot for the stacked bar chart. */
export function getAgencyTypeByTier(): Array<{
  agency_type: string;
  leading: number;
  progressing: number;
  early: number;
  minimal: number;
  none: number;
}> {
  const db = getDb();
  const rows = db
    .prepare<
      [],
      { agency_type: string | null; tier: string | null }
    >(`
      SELECT COALESCE(a.agency_type, 'OTHER') AS agency_type,
             COALESCE(m.maturity_tier, 'none') AS tier
        FROM agencies a
        JOIN agency_ai_maturity m ON m.agency_id = a.id
    `)
    .all();

  const buckets = new Map<
    string,
    { agency_type: string; leading: number; progressing: number; early: number; minimal: number; none: number }
  >();
  for (const r of rows) {
    const type = r.agency_type ?? "OTHER";
    if (!buckets.has(type)) {
      buckets.set(type, {
        agency_type: type,
        leading: 0,
        progressing: 0,
        early: 0,
        minimal: 0,
        none: 0,
      });
    }
    const b = buckets.get(type)!;
    const tierKey = r.tier ?? "none";
    if (
      tierKey === "leading" ||
      tierKey === "progressing" ||
      tierKey === "early" ||
      tierKey === "minimal" ||
      tierKey === "none"
    ) {
      b[tierKey] += 1;
    } else {
      b.none += 1;
    }
  }
  return Array.from(buckets.values()).sort((a, b) =>
    a.agency_type.localeCompare(b.agency_type),
  );
}

/** Homepage: five most-recently-modified agencies (ignores NULLs). */
export function getRecentlyModifiedAgencies(n = 5): Agency[] {
  const stmt = getDb().prepare<[number], Agency>(`
    SELECT *
      FROM agencies
     WHERE status IN ('FOUND_2025','FOUND_2024_ONLY')
       AND last_modified IS NOT NULL
     ORDER BY last_modified DESC
     LIMIT ?
  `);
  return stmt.all(n);
}

// -----------------------------------------------------------------------------
// Analytics page helpers (Agent 6)
// -----------------------------------------------------------------------------

/**
 * Dense product × agency matrix for the heatmap. Returns the top N products
 * (by total use case count) × top M agencies (by total use case count) with
 * sparse cells — the consumer fills in zeros for missing combinations.
 */
export function getProductAgencyMatrix(
  topProducts = 15,
  topAgencies = 20,
): {
  products: Array<{ id: number; canonical_name: string; vendor: string | null; total: number }>;
  agencies: Array<{ id: number; name: string; abbreviation: string; total: number }>;
  cells: Array<{ product_id: number; agency_id: number; count: number }>;
} {
  const db = getDb();

  // Heatmap must span both inventory tables — Copilot-style products that only
  // surface in the consolidated filings were being dropped otherwise.
  const products = db
    .prepare<[number], { id: number; canonical_name: string; vendor: string | null; total: number }>(`
      SELECT p.id, p.canonical_name, p.vendor, COUNT(epe.product_id) AS total
        FROM products p
        JOIN entry_product_edges epe ON epe.product_id = p.id
       GROUP BY p.id
       ORDER BY total DESC, p.canonical_name COLLATE NOCASE ASC
       LIMIT ?
    `)
    .all(topProducts);

  const agencies = db
    .prepare<[number], { id: number; name: string; abbreviation: string; total: number }>(`
      SELECT a.id, a.name, a.abbreviation, COUNT(ie.entry_id) AS total
        FROM agencies a
        JOIN inventory_entries ie ON ie.agency_id = a.id
       GROUP BY a.id
       ORDER BY total DESC, a.name COLLATE NOCASE ASC
       LIMIT ?
    `)
    .all(topAgencies);

  if (products.length === 0 || agencies.length === 0) {
    return { products, agencies, cells: [] };
  }

  const productIds = products.map((p) => p.id);
  const agencyIds = agencies.map((a) => a.id);
  const pPh = productIds.map(() => "?").join(",");
  const aPh = agencyIds.map(() => "?").join(",");

  const cells = db
    .prepare<number[], { product_id: number; agency_id: number; count: number }>(`
      SELECT product_id, agency_id, COUNT(*) AS count
        FROM entry_product_edges
       WHERE product_id IN (${pPh})
         AND agency_id IN (${aPh})
       GROUP BY product_id, agency_id
    `)
    .all(...productIds, ...agencyIds);

  return { products, agencies, cells };
}

/** Distribution of tag.architecture_type across all entries (individual + consolidated). */
export function getArchitectureDistribution(): BreakdownRow[] {
  const stmt = getDb().prepare<[], BreakdownRow>(`
    SELECT COALESCE(architecture_type, 'unknown') AS label,
           COUNT(*) AS count
      FROM use_case_tags
     GROUP BY architecture_type
     ORDER BY count DESC
  `);
  return stmt.all();
}

/**
 * Vendor share restricted to general-LLM entries — i.e. the "which chatbot do
 * agency staff actually have access to" slice. Counts across both individual
 * and consolidated tag rows since most agency-wide LLM access is reported
 * on the consolidated side.
 */
export function getLLMVendorShare(): BreakdownRow[] {
  const stmt = getDb().prepare<[], BreakdownRow>(`
    SELECT CASE
             WHEN is_microsoft_copilot = 1 THEN 'Microsoft'
             WHEN is_openai = 1 THEN 'OpenAI'
             WHEN is_anthropic = 1 THEN 'Anthropic'
             WHEN is_google = 1 THEN 'Google'
             WHEN is_aws_ai = 1 THEN 'Amazon'
             ELSE 'Other'
           END AS label,
           COUNT(*) AS count
      FROM use_case_tags
     WHERE ai_sophistication = 'general_llm'
     GROUP BY label
     ORDER BY count DESC
  `);
  return stmt.all();
}

/**
 * For the entry-type-mix stacked bar. One row per agency (that has data),
 * columns are raw counts of each tag.entry_type. The client normalizes to %.
 *
 * Counts span BOTH `use_cases` and `consolidated_use_cases` because the
 * `generic_use_pattern` entry_type lives almost entirely on the
 * consolidated side (~900 rows) — joining only `use_cases` made that
 * column read as zero for every agency, even though the data is real.
 */
export function getEntryTypeMixByAgency(): Array<{
  agency_id: number;
  name: string;
  abbreviation: string;
  total: number;
  custom_system: number;
  product_deployment: number;
  bespoke_application: number;
  generic_use_pattern: number;
  product_feature: number;
  unknown: number;
}> {
  const stmt = getDb().prepare<
    [],
    { agency_id: number; name: string; abbreviation: string; entry_type: string | null; count: number }
  >(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           COALESCE(tag.entry_type, 'unknown') AS entry_type,
           COUNT(*) AS count
      FROM (
        SELECT id AS entry_id, agency_id, 'use_case' AS kind FROM use_cases
        UNION ALL
        SELECT id AS entry_id, agency_id, 'consolidated' AS kind FROM consolidated_use_cases
      ) e
      JOIN agencies a ON a.id = e.agency_id
      LEFT JOIN use_case_tags tag
        ON (e.kind = 'use_case' AND tag.use_case_id = e.entry_id)
        OR (e.kind = 'consolidated' AND tag.consolidated_use_case_id = e.entry_id)
     WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
     GROUP BY a.id, entry_type
  `);
  const rows = stmt.all();

  const KNOWN = new Set([
    "custom_system",
    "product_deployment",
    "bespoke_application",
    "generic_use_pattern",
    "product_feature",
  ]);

  const byAgency = new Map<
    number,
    {
      agency_id: number;
      name: string;
      abbreviation: string;
      total: number;
      custom_system: number;
      product_deployment: number;
      bespoke_application: number;
      generic_use_pattern: number;
      product_feature: number;
      unknown: number;
    }
  >();
  for (const r of rows) {
    if (!byAgency.has(r.agency_id)) {
      byAgency.set(r.agency_id, {
        agency_id: r.agency_id,
        name: r.name,
        abbreviation: r.abbreviation,
        total: 0,
        custom_system: 0,
        product_deployment: 0,
        bespoke_application: 0,
        generic_use_pattern: 0,
        product_feature: 0,
        unknown: 0,
      });
    }
    const agg = byAgency.get(r.agency_id)!;
    agg.total += r.count;
    const key = r.entry_type ?? "unknown";
    if (KNOWN.has(key)) {
      (agg as unknown as Record<string, number>)[key] += r.count;
    } else {
      agg.unknown += r.count;
    }
  }

  return Array.from(byAgency.values())
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Data for the insight callout cards at the top of the Analytics page. */
export function getAnalyticsInsights(): {
  cfo_act_total: number;
  cfo_act_with_enterprise_llm: number;
  github_copilot_agencies: number;
  top_product_id: number | null;
  top_product_name: string | null;
  top_product_agencies: number;
  zero_coding_agencies: number;
  distinct_products_total: number;
  nasa_yoy_growth: number | null;
} {
  const db = getDb();

  const cfo_act_total = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(*) AS c FROM agencies WHERE agency_type = 'CFO_ACT' AND status IN ('FOUND_2025','FOUND_2024_ONLY')`,
      )
      .get() ?? { c: 0 }
  ).c;

  const cfo_act_with_enterprise_llm = (
    db
      .prepare<[], { c: number }>(`
        SELECT COUNT(*) AS c
          FROM agencies a
          JOIN agency_ai_maturity m ON m.agency_id = a.id
         WHERE a.agency_type = 'CFO_ACT'
           AND a.status IN ('FOUND_2025','FOUND_2024_ONLY')
           AND m.has_enterprise_llm = 1
      `)
      .get() ?? { c: 0 }
  ).c;

  const github_copilot_agencies = (
    db
      .prepare<[], { c: number }>(`
        SELECT COUNT(DISTINCT uc.agency_id) AS c
          FROM use_cases uc
          JOIN use_case_tags tag ON tag.use_case_id = uc.id
         WHERE tag.is_github_copilot = 1
      `)
      .get() ?? { c: 0 }
  ).c;

  const topProductRow = db
    .prepare<
      [],
      { id: number; canonical_name: string; agency_count: number }
    >(`
      SELECT p.id,
             p.canonical_name,
             COUNT(DISTINCT epe.agency_id) AS agency_count
        FROM products p
        JOIN entry_product_edges epe ON epe.product_id = p.id
       GROUP BY p.id
       ORDER BY agency_count DESC
       LIMIT 1
    `)
    .get();

  const zero_coding_agencies = (
    db
      .prepare<[], { c: number }>(`
        SELECT COUNT(*) AS c
          FROM agencies a
          JOIN agency_ai_maturity m ON m.agency_id = a.id
         WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
           AND COALESCE(m.coding_tool_count, 0) = 0
      `)
      .get() ?? { c: 0 }
  ).c;

  const distinct_products_total = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT product_id) AS c FROM entry_product_edges`,
      )
      .get() ?? { c: 0 }
  ).c;

  const nasaRow = db
    .prepare<
      [],
      { year_over_year_growth: number | null }
    >(`
      SELECT m.year_over_year_growth
        FROM agencies a
        JOIN agency_ai_maturity m ON m.agency_id = a.id
       WHERE a.abbreviation = 'NASA'
       LIMIT 1
    `)
    .get();

  return {
    cfo_act_total,
    cfo_act_with_enterprise_llm,
    github_copilot_agencies,
    top_product_id: topProductRow?.id ?? null,
    top_product_name: topProductRow?.canonical_name ?? null,
    top_product_agencies: topProductRow?.agency_count ?? 0,
    zero_coding_agencies,
    distinct_products_total,
    nasa_yoy_growth: nasaRow?.year_over_year_growth ?? null,
  };
}

/** Agencies with maturity rows — for the scatter plot (YoY growth vs volume). */
export function getMaturityScatterData(): Array<{
  agency_id: number;
  name: string;
  abbreviation: string;
  year_over_year_growth: number | null;
  total_use_cases: number | null;
  maturity_tier: string | null;
}> {
  const stmt = getDb().prepare<
    [],
    {
      agency_id: number;
      name: string;
      abbreviation: string;
      year_over_year_growth: number | null;
      total_use_cases: number | null;
      maturity_tier: string | null;
    }
  >(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           m.year_over_year_growth,
           m.total_use_cases,
           m.maturity_tier
      FROM agencies a
      JOIN agency_ai_maturity m ON m.agency_id = a.id
     WHERE m.year_over_year_growth IS NOT NULL
       AND m.total_use_cases IS NOT NULL
  `);
  return stmt.all();
}

/** Agencies that have enterprise-wide LLM access. */
export function getEnterpriseLLMAgencies(): Array<{
  agency_id: number;
  name: string;
  abbreviation: string;
  general_llm_count: number;
  has_enterprise_llm: number | null;
}> {
  const stmt = getDb().prepare<
    [],
    {
      agency_id: number;
      name: string;
      abbreviation: string;
      general_llm_count: number;
      has_enterprise_llm: number | null;
    }
  >(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           COALESCE(m.general_llm_count, 0) AS general_llm_count,
           m.has_enterprise_llm AS has_enterprise_llm
      FROM agencies a
      LEFT JOIN agency_ai_maturity m ON m.agency_id = a.id
     WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
     ORDER BY has_enterprise_llm DESC, general_llm_count DESC, a.name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

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

/** Minimal agency listing for filter dropdowns (id + abbr + name only). */
export function getAgencyOptions(): Array<{
  id: number;
  name: string;
  abbreviation: string;
}> {
  return getDb()
    .prepare<[], { id: number; name: string; abbreviation: string }>(
      `SELECT id, name, abbreviation
         FROM agencies
        WHERE status IN ('FOUND_2025','FOUND_2024_ONLY')
        ORDER BY name COLLATE NOCASE ASC`,
    )
    .all();
}

/** Minimal product listing for filter dropdowns. */
export function getProductOptions(): Array<{
  id: number;
  canonical_name: string;
  vendor: string | null;
  use_case_count: number;
}> {
  return getDb()
    .prepare<
      [],
      { id: number; canonical_name: string; vendor: string | null; use_case_count: number }
    >(
      `SELECT p.id,
              p.canonical_name,
              p.vendor,
              (
                SELECT COUNT(*) FROM entry_product_edges epe WHERE epe.product_id = p.id
              ) AS use_case_count
         FROM products p
        ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC`,
    )
    .all();
}

// -----------------------------------------------------------------------------
// Product detail — auxiliary helpers (Agent 5)
// -----------------------------------------------------------------------------

/** Child products that declare the given id as their parent_product_id. */
export function getChildProducts(parentId: number): Product[] {
  const stmt = getDb().prepare<[number], Product>(
    `SELECT * FROM products WHERE parent_product_id = ? ORDER BY canonical_name COLLATE NOCASE ASC`,
  );
  return stmt.all(parentId);
}

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

/** Other products by the same vendor (excluding the given id). */
export function getProductsByVendor(
  vendor: string,
  excludeId: number,
): ProductWithCounts[] {
  const stmt = getDb().prepare<[string, number], ProductWithCounts>(`
    SELECT p.*,
           COALESCE(uc_counts.use_case_count, 0) AS use_case_count,
           COALESCE(uc_counts.agency_count, 0) AS agency_count
      FROM products p
      LEFT JOIN (
        SELECT product_id,
               COUNT(*) AS use_case_count,
               COUNT(DISTINCT agency_id) AS agency_count
          FROM entry_product_edges
         GROUP BY product_id
      ) uc_counts ON uc_counts.product_id = p.id
     WHERE p.vendor = ? AND p.id <> ?
     ORDER BY use_case_count DESC, p.canonical_name COLLATE NOCASE ASC
  `);
  return stmt.all(vendor, excludeId);
}

/** id → canonical_name lookup (for "Part of: X" on child-product cards). */
export function getProductNamesById(): Record<number, string> {
  const rows = getDb()
    .prepare<[], { id: number; canonical_name: string }>(
      `SELECT id, canonical_name FROM products`,
    )
    .all();
  const out: Record<number, string> = {};
  for (const r of rows) out[r.id] = r.canonical_name;
  return out;
}

// -----------------------------------------------------------------------------
// Template detail — auxiliary helpers (Agent 5)
// -----------------------------------------------------------------------------

export interface TemplateEntryRow {
  use_case_id: number | null;
  use_case_name: string;
  slug: string | null;
  agency_id: number;
  agency_name: string;
  agency_abbreviation: string;
  product_id: number | null;
  product_name: string | null;
  vendor: string | null;
  commercial_examples: string | null;
  estimated_licenses_users: string | null;
}

/**
 * Per-entry rows for a template — combines use_cases and any consolidated
 * rows for the same agency/template that don't already appear in use_cases.
 */
export function getEntriesForTemplate(templateId: number): TemplateEntryRow[] {
  const stmt = getDb().prepare<[number, number], TemplateEntryRow>(`
    SELECT uc.id AS use_case_id,
           uc.use_case_name AS use_case_name,
           uc.slug AS slug,
           a.id AS agency_id,
           a.name AS agency_name,
           a.abbreviation AS agency_abbreviation,
           p.id AS product_id,
           p.canonical_name AS product_name,
           p.vendor AS vendor,
           c.commercial_examples AS commercial_examples,
           c.estimated_licenses_users AS estimated_licenses_users
      FROM use_cases uc
      JOIN agencies a ON a.id = uc.agency_id
      LEFT JOIN products p ON p.id = uc.product_id
      LEFT JOIN consolidated_use_cases c
             ON c.agency_id = uc.agency_id
            AND c.template_id = uc.template_id
     WHERE uc.template_id = ?

    UNION ALL

    SELECT NULL AS use_case_id,
           c.ai_use_case AS use_case_name,
           c.slug AS slug,
           a.id AS agency_id,
           a.name AS agency_name,
           a.abbreviation AS agency_abbreviation,
           p.id AS product_id,
           p.canonical_name AS product_name,
           p.vendor AS vendor,
           c.commercial_examples AS commercial_examples,
           c.estimated_licenses_users AS estimated_licenses_users
      FROM consolidated_use_cases c
      JOIN agencies a ON a.id = c.agency_id
      LEFT JOIN products p ON p.id = c.product_id
     WHERE c.template_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM use_cases uc2
          WHERE uc2.template_id = c.template_id
            AND uc2.agency_id = c.agency_id
       )
     ORDER BY agency_name COLLATE NOCASE ASC
  `);
  return stmt.all(templateId, templateId);
}

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

/** Agencies with an `inventory_page_url`. Used by About page data-sources list. */
export function getAgencyInventoryLinks(): Array<{
  id: number;
  name: string;
  abbreviation: string;
  inventory_page_url: string | null;
  csv_download_url: string | null;
  date_accessed: string | null;
}> {
  return getDb()
    .prepare<
      [],
      {
        id: number;
        name: string;
        abbreviation: string;
        inventory_page_url: string | null;
        csv_download_url: string | null;
        date_accessed: string | null;
      }
    >(`
      SELECT id, name, abbreviation, inventory_page_url, csv_download_url, date_accessed
        FROM agencies
       WHERE inventory_page_url IS NOT NULL AND inventory_page_url <> ''
       ORDER BY name COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Full comparison payload for a single agency — everything the /compare grid
 * needs, in one round trip.
 */
export interface AgencyCompareData {
  id: number;
  name: string;
  abbreviation: string;
  agency_type: string | null;
  status: string | null;
  maturity_tier: string | null;
  total_use_cases: number;
  distinct_products_deployed: number;
  general_llm_count: number;
  coding_tool_count: number;
  agentic_ai_count: number;
  custom_system_count: number;
  pct_deployed: number | null;
  pct_high_impact: number | null;
  pct_with_risk_docs: number | null;
  year_over_year_growth: number | null;
  has_enterprise_llm: number | null;
  has_coding_assistants: number | null;
  entry_type_mix: {
    custom_system: number;
    product_deployment: number;
    bespoke_application: number;
    generic_use_pattern: number;
    product_feature: number;
    unknown: number;
  };
  ai_sophistication_mix: Array<{ label: string; count: number }>;
  top_products: Array<{
    id: number;
    canonical_name: string;
    vendor: string | null;
    use_case_count: number;
  }>;
}

export function getAgencyCompareData(
  abbr: string,
): AgencyCompareData | null {
  const agency = getAgencyByAbbr(abbr);
  if (!agency) return null;

  const m = agency.maturity;
  const entryRows = getEntryTypeBreakdown(agency.id);
  const entryMix = {
    custom_system: 0,
    product_deployment: 0,
    bespoke_application: 0,
    generic_use_pattern: 0,
    product_feature: 0,
    unknown: 0,
  };
  for (const r of entryRows) {
    const key = r.label as keyof typeof entryMix;
    if (key in entryMix) entryMix[key] += r.count;
    else entryMix.unknown += r.count;
  }
  const sophistication = getAISophisticationBreakdown(agency.id).map((r) => ({
    label: r.label,
    count: r.count,
  }));
  const topProducts = getProductsForAgency(agency.id).slice(0, 5);

  return {
    id: agency.id,
    name: agency.name,
    abbreviation: agency.abbreviation,
    agency_type: agency.agency_type,
    status: agency.status,
    maturity_tier: m?.maturity_tier ?? null,
    total_use_cases: m?.total_use_cases ?? 0,
    distinct_products_deployed: m?.distinct_products_deployed ?? 0,
    general_llm_count: m?.general_llm_count ?? 0,
    coding_tool_count: m?.coding_tool_count ?? 0,
    agentic_ai_count: m?.agentic_ai_count ?? 0,
    custom_system_count: m?.custom_system_count ?? 0,
    pct_deployed: m?.pct_deployed ?? null,
    pct_high_impact: m?.pct_high_impact ?? null,
    pct_with_risk_docs: m?.pct_with_risk_docs ?? null,
    year_over_year_growth: m?.year_over_year_growth ?? null,
    has_enterprise_llm: m?.has_enterprise_llm ?? null,
    has_coding_assistants: m?.has_coding_assistants ?? null,
    entry_type_mix: entryMix,
    ai_sophistication_mix: sophistication,
    top_products: topProducts,
  };
}

/**
 * Command palette payload — small lists of agencies, products, templates, and
 * a capped list of use cases. The limit keeps the initial bundle small; fuzzy
 * matching happens client-side through cmdk.
 */
export interface CommandPaletteIndex {
  agencies: Array<{ id: number; abbreviation: string; name: string }>;
  products: Array<{ id: number; canonical_name: string; vendor: string | null }>;
  templates: Array<{ id: number; short_name: string | null; template_text: string }>;
  useCases: Array<{
    id: number;
    slug: string | null;
    use_case_name: string;
    agency_abbreviation: string;
  }>;
}

const _paletteCache = new Map<number, CommandPaletteIndex>();
export function getCommandPaletteIndex(
  useCaseLimit = 500,
): CommandPaletteIndex {
  const cached = _paletteCache.get(useCaseLimit);
  if (cached) return cached;
  const db = getDb();
  const agencies = db
    .prepare<[], { id: number; abbreviation: string; name: string }>(`
      SELECT id, abbreviation, name
        FROM agencies
       WHERE status IN ('FOUND_2025','FOUND_2024_ONLY')
       ORDER BY name COLLATE NOCASE ASC
    `)
    .all();
  const products = db
    .prepare<[], { id: number; canonical_name: string; vendor: string | null }>(`
      SELECT id, canonical_name, vendor
        FROM products
       ORDER BY canonical_name COLLATE NOCASE ASC
    `)
    .all();
  const templates = db
    .prepare<[], { id: number; short_name: string | null; template_text: string }>(`
      SELECT id, short_name, template_text
        FROM use_case_templates
       ORDER BY short_name COLLATE NOCASE ASC
    `)
    .all();
  const useCases = db
    .prepare<
      [number],
      { id: number; slug: string | null; use_case_name: string; agency_abbreviation: string }
    >(`
      SELECT uc.id, uc.slug, uc.use_case_name, a.abbreviation AS agency_abbreviation
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
       WHERE uc.slug IS NOT NULL
       ORDER BY uc.use_case_name COLLATE NOCASE ASC
       LIMIT ?
    `)
    .all(useCaseLimit);

  const result = { agencies, products, templates, useCases };
  _paletteCache.set(useCaseLimit, result);
  return result;
}

// -----------------------------------------------------------------------------
// External evidence
// -----------------------------------------------------------------------------

const EXTERNAL_EVIDENCE_SELECT = `
  SELECT id, use_case_id, consolidated_use_case_id, topic, status,
         source_url, source_quote, confidence, search_method,
         captured_at, captured_by, notes
    FROM use_case_external_evidence
`;

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
const EFFECTIVE_FEDRAMP_LINKS_CTE = `
  product_chain(inventory_product_id, ancestor_id, depth) AS (
    SELECT id, id, 0 FROM products
    UNION ALL
    SELECT pc.inventory_product_id, p.parent_product_id, pc.depth + 1
      FROM product_chain pc
      JOIN products p ON p.id = pc.ancestor_id
     WHERE p.parent_product_id IS NOT NULL
       AND pc.depth < 5
  ),
  effective_fedramp_links AS (
    SELECT pc.inventory_product_id,
           l.fedramp_id,
           CASE WHEN pc.depth = 0 THEN NULL ELSE pc.ancestor_id END
             AS inherited_from_parent_id,
           pc.depth AS inherited_depth,
           l.confidence,
           l.source,
           l.score,
           l.notes
      FROM product_chain pc
      JOIN fedramp_product_links l
        ON l.inventory_product_id = pc.ancestor_id
  )
`;

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
export type CrossCutKey =
  | "entry_type"
  | "sophistication"
  | "scope"
  | "use_type"
  | "high_impact"
  | "topic_area"
  | "vendor"
  | "product_type";

export interface CrossCutValueRow {
  value: string;
  count: number;
  top_agencies: Array<{ id: number; abbreviation: string; count: number }>;
  top_products: Array<{ id: number; canonical_name: string; count: number }>;
}

export interface CrossCutHeatmapCell {
  value: string;
  agency_id: number;
  agency_abbreviation: string;
  count: number;
}

/** Resolve a dimension to (table.column) for the COUNT/GROUP BY. Vendor and
 *  topic_area need different join paths than the use_case_tags dims. */
function _crossCutSql(dim: CrossCutKey): {
  fromJoin: string;
  groupCol: string;
  whereGroupNotEmpty: string;
} {
  if (dim === "topic_area") {
    return {
      fromJoin: "FROM use_cases uc JOIN agencies a ON a.id = uc.agency_id",
      groupCol: "uc.topic_area",
      whereGroupNotEmpty: "uc.topic_area IS NOT NULL AND uc.topic_area <> ''",
    };
  }
  if (dim === "vendor") {
    return {
      fromJoin: `
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
        JOIN entry_product_edges epe
          ON epe.entry_kind = 'use_case' AND epe.entry_id = uc.id
        JOIN products p ON p.id = epe.product_id`,
      groupCol: "p.vendor",
      whereGroupNotEmpty: "p.vendor IS NOT NULL AND p.vendor <> ''",
    };
  }
  if (dim === "product_type") {
    // IFP-curated products.product_type. Same JOIN path as `vendor` (through
    // entry_product_edges → products) but groups by product_type and
    // excludes the 'unclassified' placeholder so the cross-cut surfaces
    // only meaningful categories.
    return {
      fromJoin: `
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
        JOIN entry_product_edges epe
          ON epe.entry_kind = 'use_case' AND epe.entry_id = uc.id
        JOIN products p ON p.id = epe.product_id`,
      groupCol: "p.product_type",
      whereGroupNotEmpty:
        "p.product_type IS NOT NULL AND TRIM(p.product_type) <> '' AND LOWER(TRIM(p.product_type)) <> 'unclassified'",
    };
  }
  const tagCol = {
    entry_type: "tag.entry_type",
    sophistication: "tag.ai_sophistication",
    scope: "tag.deployment_scope",
    use_type: "tag.use_type",
    high_impact: "tag.high_impact_designation",
  }[dim];
  return {
    fromJoin: `
      FROM use_cases uc
      JOIN agencies a ON a.id = uc.agency_id
      JOIN use_case_tags tag ON tag.use_case_id = uc.id`,
    groupCol: tagCol,
    whereGroupNotEmpty: `${tagCol} IS NOT NULL AND ${tagCol} <> ''`,
  };
}

/** Per-value rollup for one cross-cut dimension. For each distinct value:
 *  the use-case count, top 3 agencies by count, and top 3 products by
 *  count among those use cases. */
export function getCrossCutSummary(dim: CrossCutKey): CrossCutValueRow[] {
  const db = getDb();
  const { fromJoin, groupCol, whereGroupNotEmpty } = _crossCutSql(dim);

  const valueRows = db
    .prepare<[], { value: string; count: number }>(
      `SELECT ${groupCol} AS value, COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
        GROUP BY ${groupCol}
        ORDER BY count DESC, value COLLATE NOCASE ASC`,
    )
    .all();

  const agencyStmt = db.prepare<
    [string],
    { id: number; abbreviation: string; count: number }
  >(
    `SELECT a.id, a.abbreviation, COUNT(DISTINCT uc.id) AS count
       ${fromJoin}
      WHERE ${groupCol} = ?
      GROUP BY a.id, a.abbreviation
      ORDER BY count DESC
      LIMIT 3`,
  );

  // Top products per value — joins via entry_product_edges. For dim=vendor
  // we already have p in scope; for the others we need a separate join.
  const productSql =
    dim === "vendor"
      ? `SELECT p.id, p.canonical_name, COUNT(DISTINCT uc.id) AS count
           ${fromJoin}
          WHERE ${groupCol} = ?
          GROUP BY p.id, p.canonical_name
          ORDER BY count DESC
          LIMIT 3`
      : `SELECT p.id, p.canonical_name, COUNT(DISTINCT uc.id) AS count
           ${fromJoin}
           JOIN entry_product_edges epe2
             ON epe2.entry_kind = 'use_case' AND epe2.entry_id = uc.id
           JOIN products p ON p.id = epe2.product_id
          WHERE ${groupCol} = ?
          GROUP BY p.id, p.canonical_name
          ORDER BY count DESC
          LIMIT 3`;
  const productStmt = db.prepare<
    [string],
    { id: number; canonical_name: string; count: number }
  >(productSql);

  return valueRows.map((row) => ({
    value: row.value,
    count: row.count,
    top_agencies: agencyStmt.all(row.value),
    top_products: productStmt.all(row.value),
  }));
}

/** value × agency cell counts for the heatmap view. Caller picks the agency
 *  cap (default 15) and cells are returned for those agencies only. The
 *  `valueTotals` map carries the TRUE per-value count across ALL agencies
 *  (not just the top 15) so the heatmap UI can show an accurate row total
 *  even when a value's use cases are concentrated at small agencies
 *  outside the visible columns. */
export function getCrossCutHeatmap(
  dim: CrossCutKey,
  agencyLimit = 15,
): {
  agencies: Array<{ id: number; abbreviation: string; total: number }>;
  values: string[];
  cells: CrossCutHeatmapCell[];
  valueTotals: Record<string, number>;
} {
  const db = getDb();
  const { fromJoin, groupCol, whereGroupNotEmpty } = _crossCutSql(dim);

  const agencies = db
    .prepare<[number], { id: number; abbreviation: string; total: number }>(
      `SELECT a.id, a.abbreviation, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
        GROUP BY a.id, a.abbreviation
        ORDER BY total DESC
        LIMIT ?`,
    )
    .all(agencyLimit);

  if (agencies.length === 0) {
    return { agencies: [], values: [], cells: [], valueTotals: {} };
  }

  const valueRows = db
    .prepare<[], { value: string; total: number }>(
      `SELECT ${groupCol} AS value, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
        GROUP BY ${groupCol}
        ORDER BY total DESC, value COLLATE NOCASE ASC`,
    )
    .all();
  const values = valueRows.map((r) => r.value);
  const valueTotals: Record<string, number> = {};
  for (const r of valueRows) valueTotals[r.value] = r.total;

  const agencyIds = agencies.map((a) => a.id);
  const placeholders = agencyIds.map(() => "?").join(",");
  const cells = db
    .prepare<
      number[],
      { value: string; agency_id: number; agency_abbreviation: string; count: number }
    >(
      `SELECT ${groupCol} AS value,
              a.id AS agency_id,
              a.abbreviation AS agency_abbreviation,
              COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
          AND a.id IN (${placeholders})
        GROUP BY ${groupCol}, a.id, a.abbreviation`,
    )
    .all(...agencyIds);

  return { agencies, values, cells, valueTotals };
}

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

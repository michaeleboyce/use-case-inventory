import { getDb } from "../shared/init";
import { USE_CASE_SELECT } from "../shared/sql-fragments";
import type { ConsolidatedUseCase, ConsolidatedWithTags, UseCaseTag, UseCaseWithTags } from "../../types";
import { attachTagsToUseCases, type JoinedUseCaseRow } from "./shared";

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

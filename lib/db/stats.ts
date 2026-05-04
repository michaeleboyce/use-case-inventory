/**
 * Cross-domain stats and indexes — the things that don't naturally belong to a
 * single entity. Headline counts, the catalog snapshot, and the command-palette
 * payload (a multi-domain search index).
 */

import { getDb } from "./shared/init";
import { STAGE_BUCKET_SQL } from "./shared/sql-fragments";
import type { GlobalStats, ProductCatalogStats } from "../types";

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

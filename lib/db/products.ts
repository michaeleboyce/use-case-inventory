/**
 * Product (canonical-product catalog) queries — `products` and
 * `product_aliases`. The product hierarchy (`parent_product_id`) is
 * surfaced via `getChildProducts`/`getProductNamesById`; the FedRAMP
 * inheritance walk over the same hierarchy lives in `./fedramp.ts`.
 */

import { getDb } from "./shared/init";
import type { Product, ProductDetail, ProductWithCounts } from "../types";

/**
 * Catalog of products with rolled-up use-case + agency counts. Returns
 * every product (including the catalog tail with zero links); the client
 * filters in /products via a "Min entries" select that defaults to ≥ 2.
 */
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

/** Products that a single agency has deployed, with use-case counts. */
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

/** Child products that declare the given id as their parent_product_id. */
export function getChildProducts(parentId: number): Product[] {
  const stmt = getDb().prepare<[number], Product>(
    `SELECT * FROM products WHERE parent_product_id = ? ORDER BY canonical_name COLLATE NOCASE ASC`,
  );
  return stmt.all(parentId);
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

/**
 * Frontier-product penetration — cross-product adoption for a fixed, hand-picked
 * set of the frontier general-purpose LLM products. This is deliberately an
 * EXPLICIT canonical-name allow-list, NOT `products.is_frontier_llm` (which is
 * scoped differently — it flags model families, not the specific deployable
 * products readers recognize, and would pull in scoping we don't want here).
 *
 * Per row:
 *   - `agencies` / `edges`: distinct agencies and total product attributions
 *     across BOTH entry kinds (individual use_cases + consolidated), via
 *     `entry_product_edges`.
 *   - stage mix (`deployed` / `piloted` / `preDeployment` / `otherStage`):
 *     computed from `use_cases.stage_normalized` over INDIVIDUAL entries only.
 *     Consolidated entries carry no stage, so they contribute to `edges` and
 *     `consolidatedEdges` but never to the stage mix — the page footnotes this.
 *
 * `productId` is re-resolved by canonical_name at query time, so links stay
 * valid across ETL rebuilds (ids rotate; canonical_name is stable).
 */
export const FRONTIER_PENETRATION_PRODUCTS = [
  "Microsoft 365 Copilot",
  "Microsoft 365 Copilot Chat",
  "ChatGPT",
  "OpenAI API",
  "Azure OpenAI",
  "Claude",
  "Gemini",
  "GitHub Copilot",
  "AWS Bedrock",
  "Perplexity",
] as const;

export interface FrontierPenetrationRow {
  productId: number;
  canonicalName: string;
  vendor: string | null;
  agencies: number;
  edges: number;
  individualEdges: number;
  consolidatedEdges: number;
  deployed: number;
  piloted: number;
  preDeployment: number;
  otherStage: number;
}

export function getFrontierPenetration(): FrontierPenetrationRow[] {
  const names = FRONTIER_PENETRATION_PRODUCTS;
  const placeholders = names.map(() => "?").join(",");
  const rows = getDb()
    .prepare<
      string[],
      {
        product_id: number;
        canonical_name: string;
        vendor: string | null;
        agencies: number;
        edges: number;
        individual_edges: number;
        consolidated_edges: number;
        deployed: number;
        piloted: number;
        pre_deployment: number;
      }
    >(
      `SELECT p.id AS product_id,
              p.canonical_name,
              p.vendor,
              COUNT(DISTINCT epe.agency_id) AS agencies,
              COUNT(*) AS edges,
              SUM(CASE WHEN epe.entry_kind = 'use_case' THEN 1 ELSE 0 END)
                AS individual_edges,
              SUM(CASE WHEN epe.entry_kind = 'consolidated' THEN 1 ELSE 0 END)
                AS consolidated_edges,
              SUM(CASE WHEN epe.entry_kind = 'use_case'
                        AND uc.stage_normalized = 'deployed' THEN 1 ELSE 0 END)
                AS deployed,
              SUM(CASE WHEN epe.entry_kind = 'use_case'
                        AND uc.stage_normalized = 'pilot' THEN 1 ELSE 0 END)
                AS piloted,
              SUM(CASE WHEN epe.entry_kind = 'use_case'
                        AND uc.stage_normalized = 'pre_deployment' THEN 1 ELSE 0 END)
                AS pre_deployment
         FROM products p
         JOIN entry_product_edges epe ON epe.product_id = p.id
         LEFT JOIN use_cases uc
                ON epe.entry_kind = 'use_case' AND uc.id = epe.entry_id
        WHERE p.canonical_name IN (${placeholders})
        GROUP BY p.id
        ORDER BY agencies DESC, edges DESC, p.canonical_name COLLATE NOCASE ASC`,
    )
    .all(...names);

  return rows.map((r) => ({
    productId: r.product_id,
    canonicalName: r.canonical_name,
    vendor: r.vendor,
    agencies: r.agencies,
    edges: r.edges,
    individualEdges: r.individual_edges,
    consolidatedEdges: r.consolidated_edges,
    deployed: r.deployed,
    piloted: r.piloted,
    preDeployment: r.pre_deployment,
    // Remainder of the individual edges falls into retired/unknown/other; deriving
    // it by subtraction guarantees the four stage buckets sum to individualEdges
    // even when stage_normalized is NULL for some rows.
    otherStage:
      r.individual_edges - r.deployed - r.piloted - r.pre_deployment,
  }));
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

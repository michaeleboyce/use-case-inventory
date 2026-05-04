/**
 * Product (canonical-product catalog) queries — `products` and
 * `product_aliases`. The product hierarchy (`parent_product_id`) is
 * surfaced via `getChildProducts`/`getProductNamesById`; the FedRAMP
 * inheritance walk over the same hierarchy lives in `./fedramp.ts`.
 */

import { getDb } from "./shared/init";
import type { Product, ProductDetail, ProductWithCounts } from "../types";

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

import { getDb } from "../shared/init";
import type { HeatmapCell } from "../../types";

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

/**
 * Dense product × agency matrix for the heatmap. Returns the top N products
 * × top M agencies; sparse cells (zeros) are filled in by the consumer.
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

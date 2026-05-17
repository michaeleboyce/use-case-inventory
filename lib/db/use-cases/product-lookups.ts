import { getDb } from "../shared/init";
import { USE_CASE_SELECT } from "../shared/sql-fragments";
import type { Product, UseCaseWithTags } from "../../types";
import { attachTagsToUseCases, type JoinedUseCaseRow } from "./shared";

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

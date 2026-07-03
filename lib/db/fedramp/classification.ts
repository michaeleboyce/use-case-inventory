/**
 * Queries over `fedramp_ai_classification` — the independent per-product AI
 * labeling of the FedRAMP marketplace (ETL repo: scripts/classify_fedramp_ai.py).
 *
 * "AI by classification" is distinct from "AI by linkage" (a product linked to
 * a curated inventory product via fedramp_product_links). The unlinked-AI board
 * is the intersection of "AI by classification" with "no inventory link" — the
 * FedRAMP-authorized AI tools absent from agency use-case inventories.
 *
 * Every helper guards on the table existing so a stale DB copy (or a build
 * predating the classification pass) degrades to empty rather than throwing.
 */

import { getDb } from "../shared/init";
import type {
  AiByImpactRow,
  AiClassificationCounts,
  FedrampAiClassification,
  UnlinkedAiAtoAgencyRow,
  UnlinkedAiByAgencyRow,
  UnlinkedAiProductRow,
} from "../../types";

/** True iff fedramp_ai_classification is present in this DB. */
export function hasAiClassification(): boolean {
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM sqlite_master
          WHERE type = 'table' AND name = 'fedramp_ai_classification'`,
      )
      .get(),
  );
}

type ClassificationDbRow = Omit<FedrampAiClassification, "signals"> & {
  signals: string | null;
};

function decodeSignals(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/** Classification for a single product, or null if unclassified / table absent. */
export function getAiClassificationFor(
  fedrampId: string,
): FedrampAiClassification | null {
  if (!hasAiClassification()) return null;
  const row = getDb()
    .prepare<[string], ClassificationDbRow>(
      `SELECT fedramp_id, category, confidence, reasoning, signals, model,
              classified_at
         FROM fedramp_ai_classification
        WHERE fedramp_id = ?`,
    )
    .get(fedrampId);
  if (!row) return null;
  return { ...row, signals: decodeSignals(row.signals) };
}

/**
 * Batched lookup. Returns a Map pre-seeded with every requested id (missing /
 * unclassified ids map to null) so callers can index without undefined checks.
 * Mirrors getFedrampAuthorizationsForProducts in marketplace.ts.
 */
export function getAiClassificationMap(
  fedrampIds: string[],
): Map<string, FedrampAiClassification | null> {
  const result = new Map<string, FedrampAiClassification | null>();
  for (const id of fedrampIds) result.set(id, null);
  if (fedrampIds.length === 0 || !hasAiClassification()) return result;
  const placeholders = fedrampIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare<string[], ClassificationDbRow>(
      `SELECT fedramp_id, category, confidence, reasoning, signals, model,
              classified_at
         FROM fedramp_ai_classification
        WHERE fedramp_id IN (${placeholders})`,
    )
    .all(...fedrampIds);
  for (const row of rows) {
    result.set(row.fedramp_id, { ...row, signals: decodeSignals(row.signals) });
  }
  return result;
}

/** Per-category counts plus the AI linked-vs-unlinked split. */
export function getAiClassificationCounts(): AiClassificationCounts {
  const empty: AiClassificationCounts = {
    core_ai: 0,
    ai_featured: 0,
    not_ai: 0,
    ai_linked: 0,
    ai_unlinked: 0,
    ai_unlinked_authorized: 0,
    ai_unlinked_pipeline: 0,
  };
  if (!hasAiClassification()) return empty;
  const db = getDb();
  const cats = db
    .prepare<[], { category: string; c: number }>(
      `SELECT category, COUNT(*) AS c
         FROM fedramp_ai_classification GROUP BY category`,
    )
    .all();
  const out = { ...empty };
  for (const r of cats) {
    if (r.category === "core_ai") out.core_ai = r.c;
    else if (r.category === "ai_featured") out.ai_featured = r.c;
    else if (r.category === "not_ai") out.not_ai = r.c;
  }
  out.ai_linked = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT c.fedramp_id) AS c
           FROM fedramp_ai_classification c
           JOIN fedramp_product_links l ON l.fedramp_id = c.fedramp_id
          WHERE c.category IN ('core_ai', 'ai_featured')`,
      )
      .get() ?? { c: 0 }
  ).c;
  out.ai_unlinked = out.core_ai + out.ai_featured - out.ai_linked;
  out.ai_unlinked_authorized = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(*) AS c
           FROM fedramp_ai_classification c
           JOIN fedramp_products p ON p.fedramp_id = c.fedramp_id
          WHERE c.category IN ('core_ai', 'ai_featured')
            AND p.status = 'FedRAMP Authorized'
            AND c.fedramp_id NOT IN (SELECT fedramp_id FROM fedramp_product_links)`,
      )
      .get() ?? { c: 0 }
  ).c;
  out.ai_unlinked_pipeline = out.ai_unlinked - out.ai_unlinked_authorized;
  return out;
}

/**
 * Count of AI-classified products (core_ai|ai_featured) per FedRAMP impact
 * level, ordered High → Moderate → Low → Li-SaaS for the homepage chart.
 * Products with a null impact_level are bucketed as "Unspecified".
 */
export function getAiClassificationByImpactLevel(): AiByImpactRow[] {
  if (!hasAiClassification()) return [];
  const rows = getDb()
    .prepare<[], { impact_level: string | null; count: number }>(
      `SELECT p.impact_level AS impact_level, COUNT(*) AS count
         FROM fedramp_ai_classification c
         JOIN fedramp_products p ON p.fedramp_id = c.fedramp_id
        WHERE c.category IN ('core_ai', 'ai_featured')
        GROUP BY p.impact_level`,
    )
    .all();
  const rank: Record<string, number> = {
    High: 0,
    Moderate: 1,
    Low: 2,
    "Li-SaaS": 3,
    Unspecified: 4,
  };
  return rows
    .map((r) => ({ impact_level: r.impact_level ?? "Unspecified", count: r.count }))
    .sort((a, b) => (rank[a.impact_level] ?? 9) - (rank[b.impact_level] ?? 9));
}

/**
 * One row per AI-classified FedRAMP product with NO inventory link, ordered by
 * the number of agency authorizations (the gap signal: many agencies hold an
 * ATO, none report using it). `agency_count` counts authorizations whose
 * FedRAMP agency maps to an inventory agency; `ato_count` is the raw distinct
 * authorizing-agency count.
 */
export function getUnlinkedAiProducts(): UnlinkedAiProductRow[] {
  if (!hasAiClassification()) return [];
  type DbRow = Omit<UnlinkedAiProductRow, "signals"> & { signals: string | null };
  const rows = getDb()
    .prepare<[], DbRow>(
      `SELECT c.fedramp_id,
              p.csp,
              p.cso,
              c.category,
              c.confidence,
              c.reasoning,
              c.signals,
              p.impact_level,
              p.status,
              (SELECT COUNT(DISTINCT a.agency_id)
                 FROM fedramp_authorizations a
                WHERE a.fedramp_id = c.fedramp_id
                  AND a.agency_id IS NOT NULL) AS ato_count,
              (SELECT COUNT(DISTINCT al.inventory_agency_id)
                 FROM fedramp_authorizations a
                 JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
                WHERE a.fedramp_id = c.fedramp_id) AS agency_count
         FROM fedramp_ai_classification c
         JOIN fedramp_products p ON p.fedramp_id = c.fedramp_id
        WHERE c.category IN ('core_ai', 'ai_featured')
          AND c.fedramp_id NOT IN (SELECT fedramp_id FROM fedramp_product_links)
        ORDER BY ato_count DESC, c.category, p.csp, p.cso`,
    )
    .all();
  return rows.map((r) => ({ ...r, signals: decodeSignals(r.signals) }));
}

/**
 * Agencies holding an ATO for a given (unlinked-AI) product — the row
 * expansion. Uses the inventory-agency name/abbr when the FedRAMP agency maps
 * to one, else the FedRAMP parent_agency name. One row per distinct agency,
 * most-recent ATO first.
 */
export function getAgenciesHoldingAto(
  fedrampId: string,
): UnlinkedAiAtoAgencyRow[] {
  if (!hasAiClassification()) return [];
  return getDb()
    .prepare<[string], UnlinkedAiAtoAgencyRow>(
      `SELECT al.inventory_agency_id AS inventory_agency_id,
              COALESCE(ia.name, fa.parent_agency) AS agency_name,
              ia.abbreviation AS agency_abbreviation,
              MAX(a.ato_issuance_date) AS ato_issuance_date,
              a.ato_type AS authorization_type
         FROM fedramp_authorizations a
         JOIN fedramp_agencies fa ON fa.id = a.agency_id
         LEFT JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
         LEFT JOIN agencies ia ON ia.id = al.inventory_agency_id
        WHERE a.fedramp_id = ?
          AND a.agency_id IS NOT NULL
        GROUP BY fa.id
        ORDER BY ato_issuance_date DESC NULLS LAST, agency_name`,
    )
    .all(fedrampId);
}

/**
 * Leaderboard: inventory agencies ranked by how many distinct unlinked-AI
 * FedRAMP products they hold an ATO for — "agencies sitting on the most AI
 * authorizations absent from their own inventories."
 */
export function getUnlinkedAiByAgency(limit = 15): UnlinkedAiByAgencyRow[] {
  if (!hasAiClassification()) return [];
  return getDb()
    .prepare<[number], UnlinkedAiByAgencyRow>(
      `SELECT ia.id AS inventory_agency_id,
              ia.name AS agency_name,
              ia.abbreviation AS agency_abbreviation,
              COUNT(DISTINCT a.fedramp_id) AS unlinked_ai_ato_count
         FROM fedramp_ai_classification c
         JOIN fedramp_authorizations a ON a.fedramp_id = c.fedramp_id
         JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
         JOIN agencies ia ON ia.id = al.inventory_agency_id
        WHERE c.category IN ('core_ai', 'ai_featured')
          AND c.fedramp_id NOT IN (SELECT fedramp_id FROM fedramp_product_links)
        GROUP BY ia.id
        ORDER BY unlinked_ai_ato_count DESC, ia.name
        LIMIT ?`,
    )
    .all(limit);
}

/**
 * Per-agency drill section: the unlinked-AI products a specific inventory
 * agency holds an ATO for. Feeds the additive section on
 * /fedramp/coverage/agencies/[abbr].
 */
export function getUnlinkedAiProductsForAgency(
  inventoryAgencyId: number,
): UnlinkedAiProductRow[] {
  if (!hasAiClassification()) return [];
  type DbRow = Omit<UnlinkedAiProductRow, "signals"> & { signals: string | null };
  const rows = getDb()
    .prepare<[number], DbRow>(
      `SELECT c.fedramp_id,
              p.csp,
              p.cso,
              c.category,
              c.confidence,
              c.reasoning,
              c.signals,
              p.impact_level,
              p.status,
              0 AS ato_count,
              0 AS agency_count
         FROM fedramp_ai_classification c
         JOIN fedramp_products p ON p.fedramp_id = c.fedramp_id
         JOIN fedramp_authorizations a ON a.fedramp_id = c.fedramp_id
         JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
        WHERE c.category IN ('core_ai', 'ai_featured')
          AND c.fedramp_id NOT IN (SELECT fedramp_id FROM fedramp_product_links)
          AND al.inventory_agency_id = ?
        GROUP BY c.fedramp_id
        ORDER BY c.category, p.csp, p.cso`,
    )
    .all(inventoryAgencyId);
  return rows.map((r) => ({ ...r, signals: decodeSignals(r.signals) }));
}

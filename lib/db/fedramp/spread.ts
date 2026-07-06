/**
 * Queries behind /fedramp/coverage/spread — "authorization ≠ adoption."
 *
 * FedRAMP's design premise is authorize-once, reuse-everywhere. This board
 * asks whether that reuse actually happens for AI: how many authorized
 * core-AI products spread beyond a single agency ATO, and what the ledger
 * records for the named 20x frontier products (resolved by cso name — never
 * by hard-coded ids, per AGENTS.md multi-agent safety).
 *
 * Every helper guards on the classification table existing so a stale DB
 * copy degrades to empty rather than throwing.
 */

import { getDb } from "../shared/init";
import { hasAiClassification } from "./classification";
import type {
  AiServiceForProductRow,
  AiServiceInReachRow,
  AiServiceInScopeRow,
  AiServiceShelfCounts,
  CoreAiSpreadRow,
  FirstCoreAiAtoRow,
  FrontierProductStatus,
  FrontierReachAgencyRow,
  SpreadCounts,
  UnlinkedAiAtoAgencyRow,
} from "../../types";

/** The named 20x-pathway frontier products the spread board narrates. */
export const FRONTIER_CSO_NAMES = [
  "ChatGPT Enterprise and API Platform",
  "Gemini for Government",
  "Perplexity Enterprise and API Platform",
] as const;

/**
 * One row per FedRAMP-Authorized core-AI product with its spread signals:
 * distinct ATO-holding agencies, the marketplace reuse tally, and whether any
 * inventory agency reports actually using it.
 */
export function getAuthorizedCoreAiSpread(): CoreAiSpreadRow[] {
  if (!hasAiClassification()) return [];
  return getDb()
    .prepare<[], CoreAiSpreadRow>(
      `SELECT c.fedramp_id,
              p.csp,
              p.cso,
              p.impact_level,
              p.auth_date,
              (SELECT COUNT(DISTINCT a.agency_id)
                 FROM fedramp_authorizations a
                WHERE a.fedramp_id = c.fedramp_id
                  AND a.agency_id IS NOT NULL) AS ato_count,
              COALESCE(p.reuse_count, 0) AS reuse_count,
              CASE WHEN EXISTS (
                SELECT 1 FROM fedramp_product_links l
                 WHERE l.fedramp_id = c.fedramp_id
              ) THEN 1 ELSE 0 END AS linked_to_inventory,
              (SELECT COUNT(DISTINCT epe.agency_id)
                 FROM fedramp_product_links l
                 JOIN entry_product_edges epe ON epe.product_id = l.inventory_product_id
                WHERE l.fedramp_id = c.fedramp_id) AS reporting_agency_count
         FROM fedramp_ai_classification c
         JOIN fedramp_products p ON p.fedramp_id = c.fedramp_id
        WHERE c.category = 'core_ai'
          AND p.status = 'FedRAMP Authorized'
        ORDER BY ato_count DESC, p.auth_date DESC`,
    )
    .all();
}

/** Headline cuts: single-ATO concentration and the ATO'd-but-unreported gap. */
export function getSpreadCounts(): SpreadCounts {
  const empty: SpreadCounts = {
    authorized_core_ai: 0,
    single_ato: 0,
    multi_ato: 0,
    ato_pairs: 0,
    ato_pairs_with_reported_use: 0,
  };
  if (!hasAiClassification()) return empty;
  const db = getDb();

  const concentration = db
    .prepare<[], { authorized_core_ai: number; single_ato: number; multi_ato: number }>(
      `WITH per_product AS (
         SELECT c.fedramp_id,
                (SELECT COUNT(DISTINCT a.agency_id)
                   FROM fedramp_authorizations a
                  WHERE a.fedramp_id = c.fedramp_id
                    AND a.agency_id IS NOT NULL) AS n
           FROM fedramp_ai_classification c
           JOIN fedramp_products p ON p.fedramp_id = c.fedramp_id
          WHERE c.category = 'core_ai'
            AND p.status = 'FedRAMP Authorized'
       )
       SELECT COUNT(*) AS authorized_core_ai,
              SUM(CASE WHEN n <= 1 THEN 1 ELSE 0 END) AS single_ato,
              SUM(CASE WHEN n > 1 THEN 1 ELSE 0 END) AS multi_ato
         FROM per_product`,
    )
    .get() ?? { authorized_core_ai: 0, single_ato: 0, multi_ato: 0 };

  // (agency × product) ATO pairs mappable to an inventory agency, and how many
  // of them the agency's own inventory corroborates with a reported use case.
  const pairs = db
    .prepare<[], { ato_pairs: number; with_use: number }>(
      `WITH ato AS (
         SELECT DISTINCT c.fedramp_id, al.inventory_agency_id
           FROM fedramp_ai_classification c
           JOIN fedramp_products p ON p.fedramp_id = c.fedramp_id
           JOIN fedramp_authorizations a ON a.fedramp_id = c.fedramp_id
           JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
          WHERE c.category = 'core_ai'
            AND p.status = 'FedRAMP Authorized'
       ),
       usage AS (
         SELECT DISTINCT l.fedramp_id, epe.agency_id AS inventory_agency_id
           FROM fedramp_product_links l
           JOIN entry_product_edges epe ON epe.product_id = l.inventory_product_id
       )
       SELECT COUNT(*) AS ato_pairs,
              SUM(CASE WHEN u.inventory_agency_id IS NOT NULL THEN 1 ELSE 0 END) AS with_use
         FROM ato
         LEFT JOIN usage u
           ON u.fedramp_id = ato.fedramp_id
          AND u.inventory_agency_id = ato.inventory_agency_id`,
    )
    .get() ?? { ato_pairs: 0, with_use: 0 };

  return {
    authorized_core_ai: concentration.authorized_core_ai,
    single_ato: concentration.single_ato ?? 0,
    multi_ato: concentration.multi_ato ?? 0,
    ato_pairs: pairs.ato_pairs,
    ato_pairs_with_reported_use: pairs.with_use ?? 0,
  };
}

/**
 * True iff the per-service AI classification sidecar is present in this DB
 * build (ETL: scripts/apply_fedramp_service_classification.py). The
 * services-in-scope mirror ships alongside it; guard on both before querying.
 */
export function hasServiceClassification(): boolean {
  const db = getDb();
  const has = (name: string) =>
    Boolean(
      db
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
        )
        .get(name),
    );
  return has("fedramp_ai_service_classification") && has("fedramp_authorized_services");
}

/**
 * The "shelf inside the shelf": one row per (core-AI service × host package).
 * FedRAMP scopes authorization to the service level, but tracks adoption only
 * at the package level — these rows are the capability already inside
 * packages agencies hold ATOs for.
 */
export function getAiServicesInScope(): AiServiceInScopeRow[] {
  if (!hasServiceClassification()) return [];
  return getDb()
    .prepare<[], AiServiceInScopeRow>(
      `SELECT s.service,
              c.confidence,
              c.reasoning,
              c.source,
              p.fedramp_id AS host_fedramp_id,
              p.csp,
              p.cso,
              p.impact_level,
              s.recency,
              (SELECT COUNT(DISTINCT al.inventory_agency_id)
                 FROM fedramp_authorizations a
                 JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
                WHERE a.fedramp_id = p.fedramp_id) AS agencies_with_host_ato
         FROM fedramp_authorized_services s
         JOIN fedramp_ai_service_classification c ON c.service = s.service
         JOIN fedramp_products p ON p.fedramp_id = s.fedramp_id
        WHERE c.category = 'core_ai'
        ORDER BY agencies_with_host_ato DESC, s.service, p.cso`,
    )
    .all();
}

/** Headline counts behind the shelf section and the hub card. */
export function getAiServiceShelfCounts(): AiServiceShelfCounts {
  const empty: AiServiceShelfCounts = {
    core_ai_services: 0,
    ai_featured_services: 0,
    host_packages: 0,
    agencies_in_reach: 0,
  };
  if (!hasServiceClassification()) return empty;
  const db = getDb();
  const cats = db
    .prepare<[], { core_ai_services: number; ai_featured_services: number; host_packages: number }>(
      `SELECT COUNT(DISTINCT CASE WHEN c.category = 'core_ai' THEN s.service END) AS core_ai_services,
              COUNT(DISTINCT CASE WHEN c.category = 'ai_featured' THEN s.service END) AS ai_featured_services,
              COUNT(DISTINCT CASE WHEN c.category = 'core_ai' THEN s.fedramp_id END) AS host_packages
         FROM fedramp_authorized_services s
         JOIN fedramp_ai_service_classification c ON c.service = s.service`,
    )
    .get() ?? { core_ai_services: 0, ai_featured_services: 0, host_packages: 0 };
  const reach = db
    .prepare<[], { n: number }>(
      `SELECT COUNT(DISTINCT al.inventory_agency_id) AS n
         FROM fedramp_authorized_services s
         JOIN fedramp_ai_service_classification c
           ON c.service = s.service AND c.category = 'core_ai'
         JOIN fedramp_authorizations a ON a.fedramp_id = s.fedramp_id
         JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id`,
    )
    .get() ?? { n: 0 };
  return { ...cats, agencies_in_reach: reach.n };
}

/**
 * Every in-scope service of one package, AI-labeled where the per-service
 * classification exists. AI categories sort first (core_ai, then
 * ai_featured), then everything else alphabetically — the product page shows
 * the AI slice prominently and folds the rest into a disclosure.
 */
export function getServicesInScopeForProduct(
  fedrampId: string,
): AiServiceForProductRow[] {
  const db = getDb();
  const hasServices = Boolean(
    db
      .prepare(
        `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'fedramp_authorized_services'`,
      )
      .get(),
  );
  if (!hasServices) return [];
  const hasLabels = hasServiceClassification();
  return db
    .prepare<[string], AiServiceForProductRow>(
      `SELECT s.service,
              s.recency,
              ${hasLabels ? "c.category, c.confidence, c.source" : "NULL AS category, NULL AS confidence, NULL AS source"}
         FROM fedramp_authorized_services s
         ${hasLabels ? "LEFT JOIN fedramp_ai_service_classification c ON c.service = s.service" : ""}
        WHERE s.fedramp_id = ?
        ORDER BY CASE ${hasLabels ? "c.category" : "NULL"}
                   WHEN 'core_ai' THEN 0
                   WHEN 'ai_featured' THEN 1
                   ELSE 2
                 END,
                 s.service`,
    )
    .all(fedrampId);
}

/**
 * Core-AI services in scope of packages a specific inventory agency holds an
 * ATO for — the per-agency "frontier-adjacent services in reach" list.
 * In scope of an authorization the agency already holds; says nothing about
 * whether the agency enabled the service.
 */
export function getAiServicesInReachForAgency(
  inventoryAgencyId: number,
): AiServiceInReachRow[] {
  if (!hasServiceClassification()) return [];
  return getDb()
    .prepare<[number], AiServiceInReachRow>(
      `SELECT s.service,
              p.fedramp_id AS host_fedramp_id,
              p.cso,
              p.impact_level,
              MAX(a.ato_issuance_date) AS ato_issuance_date,
              c.source
         FROM fedramp_authorized_services s
         JOIN fedramp_ai_service_classification c
           ON c.service = s.service AND c.category = 'core_ai'
         JOIN fedramp_products p ON p.fedramp_id = s.fedramp_id
         JOIN fedramp_authorizations a ON a.fedramp_id = s.fedramp_id
         JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
        WHERE al.inventory_agency_id = ?
        GROUP BY s.service, p.fedramp_id
        ORDER BY s.service, p.cso`,
    )
    .all(inventoryAgencyId);
}

/**
 * Per-agency rollup: how many core-AI services sit in scope of packages each
 * agency holds. Feeds the reach-vs-access table on /fedramp/coverage/agencies.
 */
export function getFrontierReachByAgency(): FrontierReachAgencyRow[] {
  if (!hasServiceClassification()) return [];
  return getDb()
    .prepare<[], FrontierReachAgencyRow>(
      `SELECT ia.id AS inventory_agency_id,
              ia.name AS agency_name,
              ia.abbreviation AS agency_abbreviation,
              COUNT(DISTINCT s.service) AS core_ai_services_in_reach,
              COUNT(DISTINCT s.fedramp_id) AS host_packages
         FROM fedramp_authorized_services s
         JOIN fedramp_ai_service_classification c
           ON c.service = s.service AND c.category = 'core_ai'
         JOIN fedramp_authorizations a ON a.fedramp_id = s.fedramp_id
         JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
         JOIN agencies ia ON ia.id = al.inventory_agency_id
        GROUP BY ia.id
        ORDER BY core_ai_services_in_reach DESC, ia.name`,
    )
    .all();
}

/**
 * Earliest agency ATO on any package whose scope catalog carries a core-AI
 * service — the "capability first legally in reach" clock, one row per
 * inventory agency, ordered by date. Feeds the divergence timeline; says
 * nothing about enablement or staff access.
 */
export function getFirstCoreAiAtoByAgency(): FirstCoreAiAtoRow[] {
  if (!hasServiceClassification()) return [];
  return getDb()
    .prepare<[], FirstCoreAiAtoRow>(
      `SELECT ia.id AS inventory_agency_id,
              ia.name AS agency_name,
              ia.abbreviation AS agency_abbreviation,
              MIN(a.ato_issuance_date) AS first_ato_date
         FROM fedramp_authorized_services s
         JOIN fedramp_ai_service_classification c
           ON c.service = s.service AND c.category = 'core_ai'
         JOIN fedramp_authorizations a ON a.fedramp_id = s.fedramp_id
         JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
         JOIN agencies ia ON ia.id = al.inventory_agency_id
        WHERE a.ato_issuance_date IS NOT NULL
        GROUP BY ia.id
        ORDER BY first_ato_date, ia.name`,
    )
    .all();
}

/**
 * Ledger snapshot for the named frontier products, resolved by cso name.
 * Products absent from this DB build are simply omitted.
 */
export function getFrontierTrioStatus(): FrontierProductStatus[] {
  const db = getDb();
  const placeholders = FRONTIER_CSO_NAMES.map(() => "?").join(",");
  const rows = db
    .prepare<string[], Omit<FrontierProductStatus, "ato_holders">>(
      `SELECT p.fedramp_id, p.csp, p.cso, p.status, p.auth_date,
              p.impact_level, COALESCE(p.reuse_count, 0) AS reuse_count
         FROM fedramp_products p
        WHERE p.cso IN (${placeholders})
        ORDER BY p.auth_date`,
    )
    .all(...FRONTIER_CSO_NAMES);

  const holders = db.prepare<[string], UnlinkedAiAtoAgencyRow>(
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
  );

  return rows.map((r) => ({ ...r, ato_holders: holders.all(r.fedramp_id) }));
}

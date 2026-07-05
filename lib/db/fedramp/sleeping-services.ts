/**
 * Sleeping services — the service-level FedRAMP → AI gap.
 *
 * The product-level sleeping board (coverage.ts) asks "who holds an ATO on
 * an AI-linked FedRAMP *product* but reports no use?". This module asks the
 * finer question: which AI *services inside* packages agencies already hold
 * ATOs for (Azure OpenAI inside Azure, Bedrock inside AWS, …) have proven
 * peer adopters while the ATO holder reports nothing — and does the holder
 * report anything in the same capability class at all?
 *
 * Data comes from two ETL sidecars (see the monorepo):
 *   - fedramp_service_product_map  — curated crosswalk: core-AI in-scope
 *     service → inventory product canonical_name (+ capability category,
 *     gen_ai flag, evidence tier). String-keyed; resolved to products.id
 *     here at query time (ids rotate across rebuilds).
 *   - product_capability_labels    — LLM-labeled capability categories per
 *     edged product; backs the "nothing similar deployed" test.
 *
 * The pair set is computed live in one prepared statement, mirroring the
 * product-level board. All derived shapes (funnel, frontier grid, board,
 * capability matrix, timing histogram) are built in TS by the page's
 * view-model from the single pair array.
 */
import { getDb } from "../shared/init";
import type { SleepingServicePairRow, SleepingTimingBucket } from "../../types";

/** 2025 inventory reporting cutoff: an ATO issued after this date cannot
 *  have produced a 2025 inventory row — those pairs are excluded from
 *  headline counts and rendered grayed. */
export const SLEEPING_INVENTORY_CUTOFF = "2025-12-31";

/** Issuance dates below this are marketplace junk (epoch zeros). */
export const SLEEPING_ATO_DATE_FLOOR = "2000-01-01";

export function hasSleepingServices(): boolean {
  const db = getDb();
  const has = (name: string) =>
    Boolean(
      db
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
        )
        .get(name),
    );
  return (
    has("fedramp_service_product_map") &&
    has("product_capability_labels") &&
    has("fedramp_authorized_services")
  );
}

export function bucketTiming(
  firstAtoDate: string | null,
): SleepingTimingBucket {
  if (!firstAtoDate) return "unknown";
  if (firstAtoDate > SLEEPING_INVENTORY_CUTOFF) return "post_cutoff";
  if (firstAtoDate >= "2025-07-01") return "2025h2";
  if (firstAtoDate >= "2025-01-01") return "2025h1";
  if (firstAtoDate >= "2023-01-01") return "2023_24";
  return "2022_or_earlier";
}

/**
 * The one big query. Emits a row per (mapped product × agency) for both
 * roles; only products with ≥1 lead user anywhere are included. Service
 * variants of one product (e.g. the three Gemini SKUs) are collapsed into
 * a single product row per agency, aggregating gen_ai with MAX and
 * confidence with a strong-wins CASE (lexical MIN/MAX on the enum text is
 * a trap).
 */
export function getSleepingServicePairs(): SleepingServicePairRow[] {
  if (!hasSleepingServices()) return [];
  return getDb()
    .prepare<[], SleepingServicePairRow>(`
      WITH RECURSIVE
      map AS (
        SELECT m.service,
               m.product_canonical_name AS product,
               p.id AS pid,
               m.capability_category,
               m.gen_ai,
               m.confidence,
               m.evidence_tier
          FROM fedramp_service_product_map m
          JOIN products p
            ON LOWER(p.canonical_name) = LOWER(m.product_canonical_name)
      ),
      descendants(root_pid, node, depth) AS (
        SELECT DISTINCT pid, pid, 0 FROM map
        UNION ALL
        SELECT d.root_pid, c.id, d.depth + 1
          FROM descendants d
          JOIN products c ON c.parent_product_id = d.node
         WHERE d.depth < 5
      ),
      leads AS (
        SELECT DISTINCT m.product, e.agency_id
          FROM map m
          JOIN descendants d ON d.root_pid = m.pid
          JOIN entry_product_edges e ON e.product_id = d.node
      ),
      reach AS (
        SELECT m.product,
               al.inventory_agency_id AS agency_id,
               GROUP_CONCAT(DISTINCT m.service) AS services,
               MIN(CASE WHEN a.ato_issuance_date >= '${SLEEPING_ATO_DATE_FLOOR}'
                        THEN a.ato_issuance_date END) AS first_ato_date,
               MAX(CASE WHEN s.recency = 'last_90' THEN 1 ELSE 0 END)
                 AS recency_last90,
               GROUP_CONCAT(DISTINCT fp.cso) AS host_packages
          FROM map m
          JOIN fedramp_authorized_services s ON s.service = m.service
          JOIN fedramp_authorizations a ON a.fedramp_id = s.fedramp_id
          JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
          JOIN fedramp_products fp ON fp.fedramp_id = s.fedramp_id
         GROUP BY m.product, al.inventory_agency_id
      ),
      product_attrs AS (
        SELECT product,
               MIN(capability_category) AS capability_category,
               MAX(gen_ai) AS gen_ai,
               CASE WHEN MAX(CASE WHEN confidence = 'strong' THEN 1 ELSE 0 END) = 1
                    THEN 'strong' ELSE 'inferred' END AS confidence,
               MIN(evidence_tier) AS evidence_tier,
               GROUP_CONCAT(DISTINCT service) AS all_services
          FROM map
         GROUP BY product
      ),
      pairs AS (
        SELECT product, agency_id FROM reach
        UNION
        SELECT product, agency_id FROM leads
      ),
      similar AS (
        SELECT DISTINCT e.agency_id, l.category
          FROM entry_product_edges e
          JOIN products p ON p.id = e.product_id
          JOIN product_capability_labels l
            ON l.canonical_name = p.canonical_name
         WHERE l.category != 'none'
      )
      SELECT pr.product,
             COALESCE(r.services, pa.all_services) AS services,
             pa.capability_category,
             pa.gen_ai,
             pa.confidence,
             pa.evidence_tier,
             pr.agency_id,
             ag.abbreviation AS agency_abbr,
             ag.name AS agency_name,
             CASE WHEN ld.agency_id IS NOT NULL THEN 'lead' ELSE 'sleeping' END
               AS role,
             CASE WHEN r.agency_id IS NOT NULL THEN 1 ELSE 0 END AS has_reach,
             r.first_ato_date,
             COALESCE(r.recency_last90, 0) AS recency_last90,
             CASE WHEN ld.agency_id IS NOT NULL THEN 1
                  WHEN EXISTS (
                    SELECT 1 FROM similar si
                     WHERE si.agency_id = pr.agency_id
                       AND si.category = pa.capability_category
                  ) THEN 1 ELSE 0 END AS similar_deployed,
             (SELECT GROUP_CONCAT(DISTINCT p2.canonical_name)
                FROM entry_product_edges e2
                JOIN products p2 ON p2.id = e2.product_id
                JOIN product_capability_labels l2
                  ON l2.canonical_name = p2.canonical_name
               WHERE e2.agency_id = pr.agency_id
                 AND l2.category = pa.capability_category
             ) AS similar_products,
             r.host_packages
        FROM pairs pr
        JOIN product_attrs pa ON pa.product = pr.product
        JOIN agencies ag ON ag.id = pr.agency_id
        LEFT JOIN reach r
          ON r.product = pr.product AND r.agency_id = pr.agency_id
        LEFT JOIN leads ld
          ON ld.product = pr.product AND ld.agency_id = pr.agency_id
       WHERE EXISTS (SELECT 1 FROM leads l3 WHERE l3.product = pr.product)
       ORDER BY pr.product, ag.abbreviation COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Distinct (agency, capability category) pairs the agency reports via any
 * labeled product — the capability matrix's "reports something in this
 * class" signal, independent of the crosswalk.
 */
export function getAgencyReportedCategories(): Array<{
  agency_id: number;
  category: string;
}> {
  if (!hasSleepingServices()) return [];
  return getDb()
    .prepare<[], { agency_id: number; category: string }>(`
      SELECT DISTINCT e.agency_id, l.category
        FROM entry_product_edges e
        JOIN products p ON p.id = e.product_id
        JOIN product_capability_labels l ON l.canonical_name = p.canonical_name
       WHERE l.category != 'none'
    `)
    .all();
}

/**
 * Sleeping rows for one agency — feeds the "AI services in reach,
 * unreported" section on the per-agency coverage drill. Post-cutoff rows
 * are included; the section renders them grayed like the main board.
 */
export function getSleepingServicesForAgency(
  inventoryAgencyId: number,
): SleepingServicePairRow[] {
  return getSleepingServicePairs().filter(
    (r) => r.agency_id === inventoryAgencyId && r.role === "sleeping",
  );
}

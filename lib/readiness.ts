/**
 * Federal AI Readiness Scorecard — query layer for the IFP-facing rubric.
 *
 * Populated by the ETL script `scripts/compute_agency_readiness.py` into the
 * `agency_readiness` table. This module is the dashboard's only entry point
 * into that data — all server components and per-agency pages should read
 * through these helpers, not raw SQL.
 *
 * The rubric definition / weights / tier bands live in
 * `lib/readiness-rubric.ts` (single source of truth for both this query layer
 * and the methodology page). Constants there MUST stay in sync with the
 * Python script of the same name.
 */
import { rawDb } from "./db";
import type {
  AgencyReadiness,
  AgencyReadinessWithName,
  ReadinessTier,
} from "./types";

interface ReadinessRow {
  agency_id: number;
  internal_capacity: number | null;
  frontier_capability: number | null;
  procurement_hygiene: number | null;
  risk_relevant_governance: number | null;
  adoption_breadth: number | null;
  composite_score: number | null;
  tier: string | null;
  tier_label: string | null;
  rank: number | null;
  headline_inputs_json: string | null;
  computed_at: string;
  agency_abbreviation: string;
  agency_name: string;
}

function hydrate(row: ReadinessRow): AgencyReadinessWithName {
  let headline_inputs: AgencyReadiness["headline_inputs"] = {};
  if (row.headline_inputs_json) {
    try {
      headline_inputs = JSON.parse(row.headline_inputs_json) as AgencyReadiness["headline_inputs"];
    } catch {
      headline_inputs = {};
    }
  }
  return {
    agency_id: row.agency_id,
    internal_capacity: row.internal_capacity ?? 0,
    frontier_capability: row.frontier_capability ?? 0,
    procurement_hygiene: row.procurement_hygiene ?? 0,
    risk_relevant_governance: row.risk_relevant_governance ?? 0,
    adoption_breadth: row.adoption_breadth ?? 0,
    composite_score: row.composite_score ?? 0,
    tier: (row.tier ?? "F") as ReadinessTier,
    tier_label: row.tier_label ?? "Insufficient Capacity",
    rank: row.rank ?? 0,
    headline_inputs,
    computed_at: row.computed_at,
    agency_abbreviation: row.agency_abbreviation,
    agency_name: row.agency_name,
    agency_slug: row.agency_abbreviation.toLowerCase(),
  };
}

const SELECT_BASE = `
  SELECT r.agency_id,
         r.internal_capacity,
         r.frontier_capability,
         r.procurement_hygiene,
         r.risk_relevant_governance,
         r.adoption_breadth,
         r.composite_score,
         r.tier,
         r.tier_label,
         r.rank,
         r.headline_inputs_json,
         r.computed_at,
         a.abbreviation AS agency_abbreviation,
         a.name AS agency_name
    FROM agency_readiness r
    JOIN agencies a ON a.id = r.agency_id
`;

/** All scored agencies, sorted by rank (1 = best). */
export function getAgencyReadinessRanked(): AgencyReadinessWithName[] {
  const rows = rawDb()
    .prepare<[], ReadinessRow>(`${SELECT_BASE} ORDER BY r.rank ASC, a.abbreviation ASC`)
    .all();
  return rows.map(hydrate);
}

/** Look up a single agency's readiness by numeric agency id. */
export function getAgencyReadiness(
  agencyId: number,
): AgencyReadinessWithName | null {
  const row = rawDb()
    .prepare<[number], ReadinessRow>(
      `${SELECT_BASE} WHERE r.agency_id = ? LIMIT 1`,
    )
    .get(agencyId);
  return row ? hydrate(row) : null;
}

/** Look up a single agency's readiness by abbreviation/slug (case-insensitive). */
export function getAgencyReadinessByAbbr(
  abbr: string,
): AgencyReadinessWithName | null {
  const row = rawDb()
    .prepare<[string], ReadinessRow>(
      `${SELECT_BASE} WHERE LOWER(a.abbreviation) = LOWER(?) LIMIT 1`,
    )
    .get(abbr);
  return row ? hydrate(row) : null;
}

export interface ReadinessTierSummaryRow {
  tier: ReadinessTier;
  label: string;
  count: number;
  agencies: string[];
}

/**
 * Tier band order — must stay in sync with `lib/readiness-rubric.ts` (which
 * Agent C owns and which is the published source of truth for the
 * methodology page). We duplicate the minimum needed here so this file
 * compiles before that one lands, and so the rendering layer doesn't have
 * to depend on rubric metadata for a simple group-by.
 */
const TIER_ORDER: ReadonlyArray<{ tier: ReadinessTier; label: string }> = [
  { tier: "A", label: "Frontier-Ready" },
  { tier: "B", label: "Operational" },
  { tier: "C", label: "Building" },
  { tier: "D", label: "Preliminary" },
  { tier: "F", label: "Insufficient Capacity" },
];

/** Tier-by-tier rollup for the league-table band visualization. Returned
 * in published order (A → F), regardless of whether a tier is empty. */
export function getReadinessTierSummary(): ReadinessTierSummaryRow[] {
  const all = getAgencyReadinessRanked();
  const grouped = new Map<ReadinessTier, AgencyReadinessWithName[]>();
  for (const r of all) {
    const arr = grouped.get(r.tier) ?? [];
    arr.push(r);
    grouped.set(r.tier, arr);
  }
  return TIER_ORDER.map((b) => {
    const rows = grouped.get(b.tier) ?? [];
    return {
      tier: b.tier,
      label: b.label,
      count: rows.length,
      agencies: rows.map((r) => r.agency_abbreviation),
    };
  });
}

export interface HeadlineStats {
  /** Share of use cases that are built in-house — custom-coded OR developed
   *  in-house OR on an agency-internal platform. Capacity-first hero stat. */
  internal_build_pct: number;
  /** Share of use cases at "deployed" stage (vs. pre-deployment / pilot /
   *  acquisition / retired). Real-deployment signal. */
  production_rate_pct: number;
  /** Share of use cases on products with at least one FedRAMP authorization. */
  fedramp_coverage_pct: number;
  /** Count of agencies in the top "Frontier-Ready" tier. */
  frontier_ready_agency_count: number;
  total_agencies_scored: number;
  computed_at: string | null;
  /** Compliance baseline — share of use cases lacking a meaningful risk doc.
   *  Surfaced on the methodology page as a caveat about compliance vs.
   *  capacity; intentionally NOT featured as a homepage hero number. */
  hi_no_risk_docs_pct: number;
}

/** Headline candidates for the homepage hero + methodology page. The four
 * "capacity-first" candidates are designed to be hero-quotable; the
 * compliance baseline (`hi_no_risk_docs_pct`) is preserved so the
 * methodology page can explicitly contrast it with the chosen hero.
 */
export function getHeadlineStats(): HeadlineStats {
  const db = rawDb();

  const total_uc = (
    db.prepare(`SELECT COUNT(*) AS c FROM use_cases`).get() as { c: number }
  ).c || 1;

  // 1) internal_build_pct — custom_code OR in-house dev OR on an internal-
  //    platform product. Done in TS (not SQL) because the encodings are
  //    messy and a single regex is cleaner than a 6-CASE WHEN.
  interface UcRow {
    id: number;
    has_custom_code: string | null;
    development_type: string | null;
  }
  const ucRows = db
    .prepare<[], UcRow>(
      `SELECT id, has_custom_code, development_type FROM use_cases`,
    )
    .all();
  const internalUcIds = new Set<number>();
  for (const r of ucRows) {
    const cc = (r.has_custom_code ?? "").trim().toLowerCase();
    const dt = (r.development_type ?? "").toLowerCase().replace(/-/g, " ");
    if (
      cc === "yes" ||
      cc === "true" ||
      cc === "1" ||
      (cc.includes("ato") && !cc.includes("waiver"))
    ) {
      internalUcIds.add(r.id);
    } else if (dt.includes("in house")) {
      internalUcIds.add(r.id);
    }
  }
  // Plus: use cases linked to a product with origin='agency_internal_platform'
  const internalPlatformUcs = db
    .prepare<[], { id: number }>(
      `SELECT DISTINCT uc.id FROM use_cases uc
         JOIN use_case_products ucp ON ucp.use_case_id = uc.id
         JOIN products p ON p.id = ucp.product_id
        WHERE p.product_origin = 'agency_internal_platform'`,
    )
    .all();
  for (const r of internalPlatformUcs) internalUcIds.add(r.id);
  const internal_build_pct =
    Math.round(1000 * (internalUcIds.size / total_uc)) / 10;

  // 2) production_rate_pct — stage matches "deployed" or "operation and maintenance"
  const stageRows = db
    .prepare<[], { stage_of_development: string | null }>(
      `SELECT stage_of_development FROM use_cases`,
    )
    .all();
  let deployedCount = 0;
  for (const r of stageRows) {
    const s = (r.stage_of_development ?? "").toLowerCase();
    if (s.includes("deployed") || s.includes("operation and maintenance")) {
      deployedCount += 1;
    }
  }
  const production_rate_pct =
    Math.round(1000 * (deployedCount / total_uc)) / 10;

  // 3) fedramp_coverage_pct
  const uc_with_product = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT uc.id) AS c
           FROM use_cases uc
           JOIN use_case_products ucp ON ucp.use_case_id = uc.id`,
      )
      .get() as { c: number }
  ).c || 1;
  const uc_fedramp = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT uc.id) AS c
           FROM use_cases uc
           JOIN use_case_products ucp ON ucp.use_case_id = uc.id
           JOIN fedramp_product_links fpl ON fpl.inventory_product_id = ucp.product_id`,
      )
      .get() as { c: number }
  ).c;
  const fedramp_coverage_pct =
    Math.round(1000 * (uc_fedramp / uc_with_product)) / 10;

  // 4) frontier_ready_agency_count
  const frontier_ready_agency_count = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM agency_readiness WHERE tier = 'A'`)
      .get() as { c: number }
  ).c;

  const total_agencies_scored = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM agency_readiness`)
      .get() as { c: number }
  ).c;

  // Compliance baseline (caveat-only — see HeadlineStats docs)
  const with_risk = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE t.has_meaningful_risk_docs = 1`,
      )
      .get() as { c: number }
  ).c;
  const hi_no_risk_docs_pct =
    Math.round(1000 * (1 - with_risk / total_uc)) / 10;

  const computed_at_row = db
    .prepare(`SELECT MAX(computed_at) AS t FROM agency_readiness`)
    .get() as { t: string | null };

  return {
    internal_build_pct,
    production_rate_pct,
    fedramp_coverage_pct,
    frontier_ready_agency_count,
    total_agencies_scored,
    computed_at: computed_at_row?.t ?? null,
    hi_no_risk_docs_pct,
  };
}

/* --------------------------------------------------------------------- */
/* Sub-story queries                                                      */
/* --------------------------------------------------------------------- */
/* Powers the lower sections of `/readiness` (vendor concentration,       */
/* frontier penetration, reporting completeness heatmap). Kept here so    */
/* the page only has to import from one module.                           */
/* --------------------------------------------------------------------- */

export interface VendorReach {
  vendor: string;
  use_case_count: number;
  agency_count: number;
  share_of_total: number; // 0..1
}

export interface VendorConcentration {
  top_vendors: VendorReach[]; // top 10
  herfindahl_index: number; // 0..1, sum of squared shares
  top5_share: number; // 0..1
}

/**
 * Vendor concentration across the federal use-case inventory.
 *
 * Counts each (use_case, vendor) pair once. A vendor is identified by
 * `products.vendor` (preferred) joined through `use_case_products`; for
 * use cases not linked to a curated product we fall back to
 * `use_cases.vendor_name`. The Herfindahl-Hirschman index is returned on
 * the 0..1 scale (sum of squared shares); multiply by 10,000 for the
 * classical antitrust scale.
 */
export function getVendorConcentration(): VendorConcentration {
  const db = rawDb();

  interface VendorRow {
    vendor: string;
    use_case_count: number;
    agency_count: number;
  }

  // Use cases reached via curated product link, grouped by products.vendor.
  // UNION with use cases that have no product link but do have a raw
  // vendor_name on the inventory row. COALESCE ensures we don't double-count
  // rows that appear in both halves.
  const rows = db
    .prepare<[], VendorRow>(
      `
      WITH per_uc AS (
        SELECT DISTINCT uc.id AS use_case_id,
               uc.agency_id,
               TRIM(p.vendor) AS vendor
          FROM use_cases uc
          JOIN use_case_products ucp ON ucp.use_case_id = uc.id
          JOIN products p ON p.id = ucp.product_id
         WHERE p.vendor IS NOT NULL AND TRIM(p.vendor) <> ''
        UNION
        SELECT DISTINCT uc.id AS use_case_id,
               uc.agency_id,
               TRIM(uc.vendor_name) AS vendor
          FROM use_cases uc
         WHERE uc.vendor_name IS NOT NULL
           AND TRIM(uc.vendor_name) <> ''
           AND NOT EXISTS (
             SELECT 1 FROM use_case_products ucp
              JOIN products p ON p.id = ucp.product_id
              WHERE ucp.use_case_id = uc.id
                AND p.vendor IS NOT NULL AND TRIM(p.vendor) <> ''
           )
      )
      SELECT vendor,
             COUNT(DISTINCT use_case_id) AS use_case_count,
             COUNT(DISTINCT agency_id)   AS agency_count
        FROM per_uc
       GROUP BY vendor
       ORDER BY use_case_count DESC, vendor ASC
      `,
    )
    .all();

  const total = rows.reduce((sum, r) => sum + r.use_case_count, 0) || 1;
  const enriched: VendorReach[] = rows.map((r) => ({
    vendor: r.vendor,
    use_case_count: r.use_case_count,
    agency_count: r.agency_count,
    share_of_total: r.use_case_count / total,
  }));

  const herfindahl_index = enriched.reduce(
    (sum, v) => sum + v.share_of_total * v.share_of_total,
    0,
  );
  const top5_share = enriched
    .slice(0, 5)
    .reduce((sum, v) => sum + v.share_of_total, 0);

  return {
    top_vendors: enriched.slice(0, 10),
    herfindahl_index,
    top5_share,
  };
}

export interface FrontierStat {
  agency_abbreviation: string;
  frontier_pct: number; // 0..1
  frontier_count: number;
  total_count: number;
}

export interface FrontierPenetration {
  federal_frontier_pct: number; // 0..1 across all use cases
  top_agencies: FrontierStat[]; // top 10 by frontier_pct, min 5 use cases
}

/**
 * Share of use cases that touch a frontier model, both federation-wide and
 * per agency. We restrict the top-agency list to agencies with at least 5
 * use cases so a single frontier filing at a tiny agency doesn't dominate.
 */
export function getFrontierPenetration(): FrontierPenetration {
  const db = rawDb();

  const fed = db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN frontier_uc IS NOT NULL THEN 1 ELSE 0 END) AS frontier_count,
        COUNT(*) AS total_count
        FROM (
          SELECT uc.id,
                 (SELECT 1 FROM use_case_tags t
                   WHERE t.use_case_id = uc.id AND t.is_frontier_model = 1
                   LIMIT 1) AS frontier_uc
            FROM use_cases uc
        )
      `,
    )
    .get() as { frontier_count: number | null; total_count: number };
  const federal_frontier_pct = fed.total_count
    ? (fed.frontier_count ?? 0) / fed.total_count
    : 0;

  interface AgencyRow {
    agency_abbreviation: string;
    frontier_count: number;
    total_count: number;
  }
  const agencyRows = db
    .prepare<[], AgencyRow>(
      `
      SELECT a.abbreviation AS agency_abbreviation,
             SUM(CASE WHEN EXISTS(
               SELECT 1 FROM use_case_tags t
                WHERE t.use_case_id = uc.id AND t.is_frontier_model = 1
             ) THEN 1 ELSE 0 END) AS frontier_count,
             COUNT(*) AS total_count
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
       GROUP BY a.id
      HAVING total_count >= 5
       ORDER BY (frontier_count * 1.0 / total_count) DESC,
                frontier_count DESC,
                a.abbreviation ASC
       LIMIT 10
      `,
    )
    .all();

  const top_agencies: FrontierStat[] = agencyRows.map((r) => ({
    agency_abbreviation: r.agency_abbreviation,
    frontier_count: r.frontier_count,
    total_count: r.total_count,
    frontier_pct: r.total_count ? r.frontier_count / r.total_count : 0,
  }));

  return { federal_frontier_pct, top_agencies };
}

export interface FieldCompletenessRow {
  agency_abbreviation: string;
  overall_completeness: number; // 0..1 avg across the 10 fields
  per_field: Record<string, number>; // 0..1 per field
}

/** The 10 M-25-21 fields used in the reporting_quality dimension.
 * Must stay in sync with scripts/compute_agency_readiness.py. */
const REPORTING_FIELDS = [
  "problem_statement",
  "expected_benefits",
  "system_outputs",
  "vendor_name",
  "training_data_description",
  "link_to_data",
  "justification",
  "ai_classification",
  "topic_area",
  "stage_of_development",
] as const;

/**
 * Per-agency completeness across the 10 reporting-quality fields. Returned
 * sorted by overall_completeness desc for direct rendering into a heatmap.
 */
export function getReportingCompleteness(): FieldCompletenessRow[] {
  const db = rawDb();

  // Build one big query: per agency, count non-null+non-empty per field,
  // divide by total use case count. We use NULLIF(TRIM(col), '') so empty
  // strings don't inflate the score.
  const selects = REPORTING_FIELDS.map(
    (f) =>
      `AVG(CASE WHEN NULLIF(TRIM(COALESCE(uc.${f}, '')), '') IS NOT NULL THEN 1.0 ELSE 0.0 END) AS ${f}`,
  ).join(",\n             ");

  interface RawRow {
    agency_abbreviation: string;
    [field: string]: number | string;
  }
  const rows = db
    .prepare<[], RawRow>(
      `
      SELECT a.abbreviation AS agency_abbreviation,
             ${selects}
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
       GROUP BY a.id
      `,
    )
    .all();

  const result: FieldCompletenessRow[] = rows.map((r) => {
    const per_field: Record<string, number> = {};
    let sum = 0;
    for (const f of REPORTING_FIELDS) {
      const v = Number(r[f] ?? 0);
      per_field[f] = v;
      sum += v;
    }
    return {
      agency_abbreviation: String(r.agency_abbreviation),
      overall_completeness: sum / REPORTING_FIELDS.length,
      per_field,
    };
  });

  result.sort((a, b) => b.overall_completeness - a.overall_completeness);
  return result;
}

import { getDb } from "../shared/init";
import { LLM_NORMALIZED_FIELDS } from "../shared/sql-fragments";
import type {
  BreakdownRow,
  CategoryDistributionRow,
  VendorShareRow,
  YoYRow,
} from "../../types";

/** Year-over-year growth per agency (for analytics bar chart). */
export function getYoYGrowthData(): YoYRow[] {
  const stmt = getDb().prepare<[], YoYRow>(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           m.year_over_year_growth,
           m.total_use_cases
      FROM agency_ai_maturity m
      JOIN agencies a ON a.id = m.agency_id
     WHERE m.year_over_year_growth IS NOT NULL
     ORDER BY m.year_over_year_growth DESC
  `);
  return stmt.all();
}

/** Vendor market share = products/use cases/agencies per vendor. Drops
 *  vendors with zero attributed entries. */
export function getVendorMarketShare(): VendorShareRow[] {
  const stmt = getDb().prepare<[], VendorShareRow>(`
    SELECT p.vendor AS vendor,
           COUNT(DISTINCT p.id) AS product_count,
           COUNT(sub.product_id) AS use_case_count,
           COUNT(DISTINCT sub.agency_id) AS agency_count
      FROM products p
      LEFT JOIN entry_product_edges sub ON sub.product_id = p.id
     WHERE p.vendor IS NOT NULL AND p.vendor <> ''
     GROUP BY p.vendor
    HAVING COUNT(sub.product_id) > 0
     ORDER BY use_case_count DESC, agency_count DESC
  `);
  return stmt.all();
}

/** Per-IFP-category rollup: product count + use-case reach + agency count. */
export function getCategoryDistribution(): CategoryDistributionRow[] {
  const stmt = getDb().prepare<[], CategoryDistributionRow>(`
    SELECT p.product_type AS category,
           COUNT(DISTINCT p.id) AS product_count,
           COUNT(DISTINCT ucp.use_case_id) AS use_case_count,
           COUNT(DISTINCT uc.agency_id) AS agency_count
      FROM products p
      LEFT JOIN use_case_products ucp ON ucp.product_id = p.id
      LEFT JOIN use_cases uc ON uc.id = ucp.use_case_id
     WHERE p.product_type IS NOT NULL
       AND TRIM(p.product_type) <> ''
       AND LOWER(TRIM(p.product_type)) <> 'unclassified'
     GROUP BY p.product_type
     ORDER BY use_case_count DESC, agency_count DESC, product_count DESC
  `);
  return stmt.all();
}

/** Agencies ranked by coding-tool use case count. */
export function getCodingToolAgencies(): Array<{
  agency_id: number;
  name: string;
  abbreviation: string;
  coding_tool_count: number;
}> {
  const stmt = getDb().prepare<
    [],
    { agency_id: number; name: string; abbreviation: string; coding_tool_count: number }
  >(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           COALESCE(m.coding_tool_count, 0) AS coding_tool_count
      FROM agencies a
      LEFT JOIN agency_ai_maturity m ON m.agency_id = a.id
     WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
     ORDER BY coding_tool_count DESC, a.name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

/** Homepage: maturity-tier summary with member abbreviation lists. */
export function getMaturityTierSummary(): Array<{
  tier: string;
  count: number;
  agencies: Array<{ id: number; name: string; abbreviation: string }>;
}> {
  const db = getDb();
  const rows = db
    .prepare<
      [],
      { tier: string; id: number; name: string; abbreviation: string }
    >(`
      SELECT COALESCE(m.maturity_tier, 'none') AS tier,
             a.id AS id,
             a.name AS name,
             a.abbreviation AS abbreviation
        FROM agency_ai_maturity m
        JOIN agencies a ON a.id = m.agency_id
       ORDER BY a.abbreviation COLLATE NOCASE ASC
    `)
    .all();
  const order = ["leading", "progressing", "early", "minimal", "none"];
  const byTier = new Map<
    string,
    Array<{ id: number; name: string; abbreviation: string }>
  >();
  for (const t of order) byTier.set(t, []);
  for (const r of rows) {
    const key = byTier.has(r.tier) ? r.tier : "none";
    byTier.get(key)!.push({ id: r.id, name: r.name, abbreviation: r.abbreviation });
  }
  return order.map((tier) => ({
    tier,
    count: byTier.get(tier)?.length ?? 0,
    agencies: byTier.get(tier) ?? [],
  }));
}

/** Homepage: agency_type x maturity_tier pivot for the stacked bar chart. */
export function getAgencyTypeByTier(): Array<{
  agency_type: string;
  leading: number;
  progressing: number;
  early: number;
  minimal: number;
  none: number;
}> {
  const db = getDb();
  const rows = db
    .prepare<
      [],
      { agency_type: string | null; tier: string | null }
    >(`
      SELECT COALESCE(a.agency_type, 'OTHER') AS agency_type,
             COALESCE(m.maturity_tier, 'none') AS tier
        FROM agencies a
        JOIN agency_ai_maturity m ON m.agency_id = a.id
    `)
    .all();

  const buckets = new Map<
    string,
    { agency_type: string; leading: number; progressing: number; early: number; minimal: number; none: number }
  >();
  for (const r of rows) {
    const type = r.agency_type ?? "OTHER";
    if (!buckets.has(type)) {
      buckets.set(type, {
        agency_type: type,
        leading: 0,
        progressing: 0,
        early: 0,
        minimal: 0,
        none: 0,
      });
    }
    const b = buckets.get(type)!;
    const tierKey = r.tier ?? "none";
    if (
      tierKey === "leading" ||
      tierKey === "progressing" ||
      tierKey === "early" ||
      tierKey === "minimal" ||
      tierKey === "none"
    ) {
      b[tierKey] += 1;
    } else {
      b.none += 1;
    }
  }
  return Array.from(buckets.values()).sort((a, b) =>
    a.agency_type.localeCompare(b.agency_type),
  );
}

/** Distribution of tag.architecture_type across all entries (individual + consolidated). */
export function getArchitectureDistribution(): BreakdownRow[] {
  const stmt = getDb().prepare<[], BreakdownRow>(`
    SELECT COALESCE(architecture_type, 'unknown') AS label,
           COUNT(*) AS count
      FROM use_case_tags
     GROUP BY architecture_type
     ORDER BY count DESC
  `);
  return stmt.all();
}

/**
 * For the entry-type-mix stacked bar. One row per agency (that has data),
 * columns are raw counts of each tag.entry_type. The client normalizes to %.
 */
export function getEntryTypeMixByAgency(): Array<{
  agency_id: number;
  name: string;
  abbreviation: string;
  total: number;
  custom_system: number;
  product_deployment: number;
  bespoke_application: number;
  generic_use_pattern: number;
  product_feature: number;
  unknown: number;
}> {
  const stmt = getDb().prepare<
    [],
    { agency_id: number; name: string; abbreviation: string; entry_type: string | null; count: number }
  >(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           COALESCE(tag.entry_type, 'unknown') AS entry_type,
           COUNT(*) AS count
      FROM (
        SELECT id AS entry_id, agency_id, 'use_case' AS kind FROM use_cases
        UNION ALL
        SELECT id AS entry_id, agency_id, 'consolidated' AS kind FROM consolidated_use_cases
      ) e
      JOIN agencies a ON a.id = e.agency_id
      LEFT JOIN use_case_tags tag
        ON (e.kind = 'use_case' AND tag.use_case_id = e.entry_id)
        OR (e.kind = 'consolidated' AND tag.consolidated_use_case_id = e.entry_id)
     WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
     GROUP BY a.id, entry_type
  `);
  const rows = stmt.all();

  const KNOWN = new Set([
    "custom_system",
    "product_deployment",
    "bespoke_application",
    "generic_use_pattern",
    "product_feature",
  ]);

  const byAgency = new Map<
    number,
    {
      agency_id: number;
      name: string;
      abbreviation: string;
      total: number;
      custom_system: number;
      product_deployment: number;
      bespoke_application: number;
      generic_use_pattern: number;
      product_feature: number;
      unknown: number;
    }
  >();
  for (const r of rows) {
    if (!byAgency.has(r.agency_id)) {
      byAgency.set(r.agency_id, {
        agency_id: r.agency_id,
        name: r.name,
        abbreviation: r.abbreviation,
        total: 0,
        custom_system: 0,
        product_deployment: 0,
        bespoke_application: 0,
        generic_use_pattern: 0,
        product_feature: 0,
        unknown: 0,
      });
    }
    const agg = byAgency.get(r.agency_id)!;
    agg.total += r.count;
    const key = r.entry_type ?? "unknown";
    if (KNOWN.has(key)) {
      (agg as unknown as Record<string, number>)[key] += r.count;
    } else {
      agg.unknown += r.count;
    }
  }

  return Array.from(byAgency.values())
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Data for the insight callout cards at the top of the Analytics page. */
export function getAnalyticsInsights(): {
  cfo_act_total: number;
  cfo_act_with_enterprise_llm: number;
  github_copilot_agencies: number;
  top_product_id: number | null;
  top_product_name: string | null;
  top_product_agencies: number;
  zero_coding_agencies: number;
  distinct_products_total: number;
  nasa_yoy_growth: number | null;
  /** General-LLM-access entries with no recoverable vendor — neither tag
   *  fields nor `use_cases.vendor_name` / `system_name` name a vendor.
   *  Editorially: "agency reports general LLM access without naming the
   *  tool." See `getLLMVendorShare` for the bucket that surfaces this. */
  general_llm_total: number;
  general_llm_unspecified: number;
} {
  const db = getDb();

  const cfo_act_total = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(*) AS c FROM agencies WHERE agency_type = 'CFO_ACT' AND status IN ('FOUND_2025','FOUND_2024_ONLY')`,
      )
      .get() ?? { c: 0 }
  ).c;

  const cfo_act_with_enterprise_llm = (
    db
      .prepare<[], { c: number }>(`
        SELECT COUNT(*) AS c
          FROM agencies a
          JOIN agency_ai_maturity m ON m.agency_id = a.id
         WHERE a.agency_type = 'CFO_ACT'
           AND a.status IN ('FOUND_2025','FOUND_2024_ONLY')
           AND m.has_enterprise_llm = 1
      `)
      .get() ?? { c: 0 }
  ).c;

  // UNION over both inventory tables — joining only `use_cases` undercounted.
  const github_copilot_agencies = (
    db
      .prepare<[], { c: number }>(`
        SELECT COUNT(DISTINCT agency_id) AS c
          FROM (
            SELECT uc.agency_id
              FROM use_cases uc
              JOIN use_case_tags tag ON tag.use_case_id = uc.id
             WHERE tag.is_github_copilot = 1
            UNION ALL
            SELECT cuc.agency_id
              FROM consolidated_use_cases cuc
              JOIN use_case_tags tag ON tag.consolidated_use_case_id = cuc.id
             WHERE tag.is_github_copilot = 1
          )
      `)
      .get() ?? { c: 0 }
  ).c;

  const topProductRow = db
    .prepare<
      [],
      { id: number; canonical_name: string; agency_count: number }
    >(`
      SELECT p.id,
             p.canonical_name,
             COUNT(DISTINCT epe.agency_id) AS agency_count
        FROM products p
        JOIN entry_product_edges epe ON epe.product_id = p.id
       GROUP BY p.id
       ORDER BY agency_count DESC
       LIMIT 1
    `)
    .get();

  const zero_coding_agencies = (
    db
      .prepare<[], { c: number }>(`
        SELECT COUNT(*) AS c
          FROM agencies a
          JOIN agency_ai_maturity m ON m.agency_id = a.id
         WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
           AND COALESCE(m.coding_tool_count, 0) = 0
      `)
      .get() ?? { c: 0 }
  ).c;

  const distinct_products_total = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT product_id) AS c FROM entry_product_edges`,
      )
      .get() ?? { c: 0 }
  ).c;

  const nasaRow = db
    .prepare<
      [],
      { year_over_year_growth: number | null }
    >(`
      SELECT m.year_over_year_growth
        FROM agencies a
        JOIN agency_ai_maturity m ON m.agency_id = a.id
       WHERE a.abbreviation = 'NASA'
       LIMIT 1
    `)
    .get();

  // Mirrors the bucketing in getLLMVendorShare so the insight card and
  // the donut tell the same story. "Vendor unspecified" = no tag-field
  // vendor AND no recoverable vendor_name/system_name on the use case.
  const llmRow = db
    .prepare<
      [],
      { total: number; unspecified: number }
    >(`
      WITH tagged AS (
        SELECT ${LLM_NORMALIZED_FIELDS}
          FROM use_case_tags t
          LEFT JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE t.ai_sophistication = 'general_llm'
      )
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN v_lower = '' AND p_lower = '' THEN 1 ELSE 0 END) AS unspecified
        FROM tagged
    `)
    .get() ?? { total: 0, unspecified: 0 };

  return {
    cfo_act_total,
    cfo_act_with_enterprise_llm,
    github_copilot_agencies,
    top_product_id: topProductRow?.id ?? null,
    top_product_name: topProductRow?.canonical_name ?? null,
    top_product_agencies: topProductRow?.agency_count ?? 0,
    zero_coding_agencies,
    distinct_products_total,
    nasa_yoy_growth: nasaRow?.year_over_year_growth ?? null,
    general_llm_total: llmRow.total,
    general_llm_unspecified: llmRow.unspecified,
  };
}

/** Agencies with maturity rows — for the scatter plot (YoY growth vs volume). */
export function getMaturityScatterData(): Array<{
  agency_id: number;
  name: string;
  abbreviation: string;
  year_over_year_growth: number | null;
  total_use_cases: number | null;
  maturity_tier: string | null;
}> {
  const stmt = getDb().prepare<
    [],
    {
      agency_id: number;
      name: string;
      abbreviation: string;
      year_over_year_growth: number | null;
      total_use_cases: number | null;
      maturity_tier: string | null;
    }
  >(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           m.year_over_year_growth,
           m.total_use_cases,
           m.maturity_tier
      FROM agencies a
      JOIN agency_ai_maturity m ON m.agency_id = a.id
     WHERE m.year_over_year_growth IS NOT NULL
       AND m.total_use_cases IS NOT NULL
  `);
  return stmt.all();
}

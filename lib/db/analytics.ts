/**
 * Analytics queries — chart/breakdown payloads for the home page, agency
 * detail page, /analytics, and /browse/category cross-cut pages.
 *
 * Two flavors:
 *   - Per-agency breakdowns (donut/stacked charts on agency pages)
 *   - Cross-cutting analytics (full-corpus rollups + heatmaps)
 *
 * Functions here mostly UNION across `use_cases` and `consolidated_use_cases`
 * because the consolidated side carries ~900 OMB rows that several charts
 * would otherwise underweight.
 */

import { getDb } from "./shared/init";
import type {
  BreakdownRow,
  BureauBreakdown,
  CategoryDistributionRow,
  HeatmapCell,
  VendorShareRow,
  YoYRow,
} from "../types";

export function getBureauBreakdown(agencyId: number): BureauBreakdown[] {
  const stmt = getDb().prepare<[number], BureauBreakdown>(`
    SELECT COALESCE(bureau_component, '(Unassigned)') AS label,
           bureau_component,
           COUNT(*) AS count
      FROM use_cases
     WHERE agency_id = ?
     GROUP BY bureau_component
     ORDER BY count DESC
  `);
  return stmt.all(agencyId);
}

/*
 * The per-agency breakdown helpers below union use_case_tags rows from BOTH
 * source tables (individual and consolidated) so the donuts on the agency
 * detail page reflect every entry the agency filed — not just the individual
 * ones. `use_case_tags` carries either `use_case_id` OR
 * `consolidated_use_case_id`, never both, so the CHECK constraint on the
 * table guarantees a clean union.
 */
export function getEntryTypeBreakdown(agencyId: number): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT COALESCE(entry_type, 'unknown') AS label, COUNT(*) AS count
      FROM (
        SELECT t.entry_type FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT t.entry_type FROM use_case_tags t
          JOIN consolidated_use_cases c ON c.id = t.consolidated_use_case_id
         WHERE c.agency_id = ?
      )
     GROUP BY entry_type
     ORDER BY count DESC
  `);
  return stmt.all(agencyId, agencyId);
}

export function getAISophisticationBreakdown(
  agencyId: number,
): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT COALESCE(ai_sophistication, 'unknown') AS label, COUNT(*) AS count
      FROM (
        SELECT t.ai_sophistication FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT t.ai_sophistication FROM use_case_tags t
          JOIN consolidated_use_cases c ON c.id = t.consolidated_use_case_id
         WHERE c.agency_id = ?
      )
     GROUP BY ai_sophistication
     ORDER BY count DESC
  `);
  return stmt.all(agencyId, agencyId);
}

export function getDeploymentScopeBreakdown(
  agencyId: number,
): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT COALESCE(deployment_scope, 'unknown') AS label, COUNT(*) AS count
      FROM (
        SELECT t.deployment_scope FROM use_case_tags t
          JOIN use_cases uc ON uc.id = t.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT t.deployment_scope FROM use_case_tags t
          JOIN consolidated_use_cases c ON c.id = t.consolidated_use_case_id
         WHERE c.agency_id = ?
      )
     GROUP BY deployment_scope
     ORDER BY count DESC
  `);
  return stmt.all(agencyId, agencyId);
}

/** Per-agency rollup of distinct entries by IFP product category. Excludes
 *  the 'unclassified' placeholder. */
export function getCategoryDistributionForAgency(
  agencyId: number,
): BreakdownRow[] {
  const stmt = getDb().prepare<[number, number], BreakdownRow>(`
    SELECT p.product_type AS label, COUNT(*) AS count
      FROM (
        SELECT ucp.use_case_id AS entry_id, ucp.product_id
          FROM use_case_products ucp
          JOIN use_cases uc ON uc.id = ucp.use_case_id
         WHERE uc.agency_id = ?
        UNION ALL
        SELECT cucp.consolidated_use_case_id AS entry_id, cucp.product_id
          FROM consolidated_use_case_products cucp
          JOIN consolidated_use_cases c ON c.id = cucp.consolidated_use_case_id
         WHERE c.agency_id = ?
      ) edges
      JOIN products p ON p.id = edges.product_id
     WHERE p.product_type IS NOT NULL
       AND TRIM(p.product_type) <> ''
       AND LOWER(TRIM(p.product_type)) <> 'unclassified'
     GROUP BY p.product_type
     ORDER BY count DESC, p.product_type COLLATE NOCASE ASC
  `);
  return stmt.all(agencyId, agencyId);
}

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
 * Vendor share restricted to general-LLM entries. Bucketed via
 * cots_vendor / tool_vendor strings on use_case_tags. Rows with no vendor at
 * all bucket to "Vendor unspecified" so the reader can see how much of the
 * LLM-access reporting is agency-wide-without-naming-the-tool.
 */
export function getLLMVendorShare(): BreakdownRow[] {
  const stmt = getDb().prepare<[], BreakdownRow>(`
    WITH tagged AS (
      -- Layered fallback chain: tag.cots_vendor -> tag.tool_vendor ->
      -- use_cases.vendor_name (the OMB-filed source column). auto_tag.py
      -- doesn't always propagate vendor info into the tag fields; falling
      -- back to use_cases.vendor_name recovers ~278 rows that previously
      -- bucketed as "Vendor unspecified" despite the agency naming a
      -- vendor in the OMB filing. Placeholder values ('N/A', 'Not
      -- available', 'None', 'TBD', 'Unknown') treated as blank for the
      -- vendor side; system_name fallback still applies (e.g. an "N/A"
      -- vendor with system_name="Azure OpenAI" still buckets as Microsoft).
      SELECT LOWER(TRIM(COALESCE(
               NULLIF(t.cots_vendor,''),
               NULLIF(t.tool_vendor,''),
               CASE
                 WHEN LOWER(TRIM(COALESCE(uc.vendor_name,'')))
                   IN ('n/a','not available','none','tbd','tbd.','unknown','')
                 THEN ''
                 ELSE uc.vendor_name
               END,
               ''
             ))) AS v_lower,
             LOWER(TRIM(COALESCE(
               NULLIF(t.cots_product_name,''),
               NULLIF(t.tool_product_name,''),
               uc.system_name,
               ''
             ))) AS p_lower
        FROM use_case_tags t
        LEFT JOIN use_cases uc ON uc.id = t.use_case_id
       WHERE t.ai_sophistication = 'general_llm'
    )
    SELECT CASE
             WHEN v_lower LIKE '%microsoft%' OR v_lower = 'azure'
               OR p_lower LIKE '%copilot%' OR p_lower LIKE '%azure openai%'
               OR p_lower LIKE '%microsoft teams%'
               THEN 'Microsoft'
             WHEN v_lower LIKE '%openai%' OR p_lower LIKE 'chatgpt%' OR p_lower = 'openai api'
               THEN 'OpenAI'
             WHEN v_lower LIKE '%anthropic%' OR p_lower LIKE 'claude%'
               THEN 'Anthropic'
             WHEN v_lower = 'google' OR v_lower LIKE 'google %' OR p_lower LIKE '%gemini%'
               THEN 'Google'
             WHEN v_lower LIKE '%amazon%' OR v_lower LIKE '%aws%' OR p_lower LIKE '%bedrock%'
               THEN 'Amazon'
             -- xAI / Grok showed up under "Other named" before being added.
             WHEN v_lower = 'xai' OR p_lower LIKE 'grok%' THEN 'xAI'
             -- Meta / Llama models — appears in CDC, NIH stacks.
             WHEN v_lower LIKE '%meta%' OR p_lower LIKE 'llama%' OR p_lower LIKE 'meta llama%'
               THEN 'Meta'
             WHEN v_lower LIKE '%perplexity%' THEN 'Perplexity'
             WHEN v_lower LIKE '%palantir%' THEN 'Palantir'
             WHEN v_lower LIKE '%servicenow%' THEN 'ServiceNow'
             WHEN v_lower LIKE '%databricks%' THEN 'Databricks'
             WHEN v_lower IN ('in-house','inhouse','agency','custom') THEN 'In-house'
             WHEN v_lower = '' AND p_lower = '' THEN 'Vendor unspecified'
             ELSE 'Other named'
           END AS label,
           COUNT(*) AS count
      FROM tagged
     GROUP BY label
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
        SELECT LOWER(TRIM(COALESCE(
                 NULLIF(t.cots_vendor,''),
                 NULLIF(t.tool_vendor,''),
                 CASE
                   WHEN LOWER(TRIM(COALESCE(uc.vendor_name,'')))
                     IN ('n/a','not available','none','tbd','tbd.','unknown','')
                   THEN ''
                   ELSE uc.vendor_name
                 END,
                 ''
               ))) AS v_lower,
               LOWER(TRIM(COALESCE(
                 NULLIF(t.cots_product_name,''),
                 NULLIF(t.tool_product_name,''),
                 uc.system_name,
                 ''
               ))) AS p_lower
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

/** Agencies that have enterprise-wide LLM access. */
export function getEnterpriseLLMAgencies(): Array<{
  agency_id: number;
  name: string;
  abbreviation: string;
  general_llm_count: number;
  has_enterprise_llm: number | null;
}> {
  const stmt = getDb().prepare<
    [],
    {
      agency_id: number;
      name: string;
      abbreviation: string;
      general_llm_count: number;
      has_enterprise_llm: number | null;
    }
  >(`
    SELECT a.id AS agency_id,
           a.name,
           a.abbreviation,
           COALESCE(m.general_llm_count, 0) AS general_llm_count,
           m.has_enterprise_llm AS has_enterprise_llm
      FROM agencies a
      LEFT JOIN agency_ai_maturity m ON m.agency_id = a.id
     WHERE a.status IN ('FOUND_2025','FOUND_2024_ONLY')
     ORDER BY has_enterprise_llm DESC, general_llm_count DESC, a.name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

// =============================================================================
// CROSS-CUT analytics — value × agency rollups for /browse/category etc.
// =============================================================================

/** Discriminator for the supported cross-cut dimensions. Mirrors
 *  CrossCutDimension in lib/urls.ts but extended with `vendor` for the
 *  product-side cross-cut. */
export type CrossCutKey =
  | "entry_type"
  | "sophistication"
  | "scope"
  | "use_type"
  | "high_impact"
  | "topic_area"
  | "vendor"
  | "product_type";

export interface CrossCutValueRow {
  value: string;
  count: number;
  top_agencies: Array<{ id: number; abbreviation: string; count: number }>;
  top_products: Array<{ id: number; canonical_name: string; count: number }>;
}

export interface CrossCutHeatmapCell {
  value: string;
  agency_id: number;
  agency_abbreviation: string;
  count: number;
}

/** Resolve a dimension to (table.column) for the COUNT/GROUP BY. Vendor and
 *  topic_area need different join paths than the use_case_tags dims. */
function _crossCutSql(dim: CrossCutKey): {
  fromJoin: string;
  groupCol: string;
  whereGroupNotEmpty: string;
} {
  if (dim === "topic_area") {
    return {
      fromJoin: "FROM use_cases uc JOIN agencies a ON a.id = uc.agency_id",
      groupCol: "uc.topic_area",
      whereGroupNotEmpty: "uc.topic_area IS NOT NULL AND uc.topic_area <> ''",
    };
  }
  if (dim === "vendor") {
    return {
      fromJoin: `
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
        JOIN entry_product_edges epe
          ON epe.entry_kind = 'use_case' AND epe.entry_id = uc.id
        JOIN products p ON p.id = epe.product_id`,
      groupCol: "p.vendor",
      whereGroupNotEmpty: "p.vendor IS NOT NULL AND p.vendor <> ''",
    };
  }
  if (dim === "product_type") {
    return {
      fromJoin: `
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
        JOIN entry_product_edges epe
          ON epe.entry_kind = 'use_case' AND epe.entry_id = uc.id
        JOIN products p ON p.id = epe.product_id`,
      groupCol: "p.product_type",
      whereGroupNotEmpty:
        "p.product_type IS NOT NULL AND TRIM(p.product_type) <> '' AND LOWER(TRIM(p.product_type)) <> 'unclassified'",
    };
  }
  const tagCol = {
    entry_type: "tag.entry_type",
    sophistication: "tag.ai_sophistication",
    scope: "tag.deployment_scope",
    use_type: "tag.use_type",
    high_impact: "tag.high_impact_designation",
  }[dim];
  return {
    fromJoin: `
      FROM use_cases uc
      JOIN agencies a ON a.id = uc.agency_id
      JOIN use_case_tags tag ON tag.use_case_id = uc.id`,
    groupCol: tagCol,
    whereGroupNotEmpty: `${tagCol} IS NOT NULL AND ${tagCol} <> ''`,
  };
}

/** Per-value rollup for one cross-cut dimension. For each distinct value:
 *  the use-case count, top 3 agencies by count, and top 3 products by
 *  count among those use cases. */
export function getCrossCutSummary(dim: CrossCutKey): CrossCutValueRow[] {
  const db = getDb();
  const { fromJoin, groupCol, whereGroupNotEmpty } = _crossCutSql(dim);

  const valueRows = db
    .prepare<[], { value: string; count: number }>(
      `SELECT ${groupCol} AS value, COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
        GROUP BY ${groupCol}
        ORDER BY count DESC, value COLLATE NOCASE ASC`,
    )
    .all();

  const agencyStmt = db.prepare<
    [string],
    { id: number; abbreviation: string; count: number }
  >(
    `SELECT a.id, a.abbreviation, COUNT(DISTINCT uc.id) AS count
       ${fromJoin}
      WHERE ${groupCol} = ?
      GROUP BY a.id, a.abbreviation
      ORDER BY count DESC
      LIMIT 3`,
  );

  const dimAlreadyHasProductsP = dim === "vendor" || dim === "product_type";
  const productSql = dimAlreadyHasProductsP
    ? `SELECT p.id, p.canonical_name, COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
        WHERE ${groupCol} = ?
        GROUP BY p.id, p.canonical_name
        ORDER BY count DESC
        LIMIT 3`
    : `SELECT gp.id, gp.canonical_name, COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
         JOIN entry_product_edges epe2
           ON epe2.entry_kind = 'use_case' AND epe2.entry_id = uc.id
         JOIN products gp ON gp.id = epe2.product_id
        WHERE ${groupCol} = ?
        GROUP BY gp.id, gp.canonical_name
        ORDER BY count DESC
        LIMIT 3`;
  const productStmt = db.prepare<
    [string],
    { id: number; canonical_name: string; count: number }
  >(productSql);

  return valueRows.map((row) => ({
    value: row.value,
    count: row.count,
    top_agencies: agencyStmt.all(row.value),
    top_products: productStmt.all(row.value),
  }));
}

/** value × agency cell counts for the heatmap view. */
export function getCrossCutHeatmap(
  dim: CrossCutKey,
  agencyLimit = 15,
): {
  agencies: Array<{ id: number; abbreviation: string; total: number }>;
  values: string[];
  cells: CrossCutHeatmapCell[];
  valueTotals: Record<string, number>;
} {
  const db = getDb();
  const { fromJoin, groupCol, whereGroupNotEmpty } = _crossCutSql(dim);

  const agencies = db
    .prepare<[number], { id: number; abbreviation: string; total: number }>(
      `SELECT a.id, a.abbreviation, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
        GROUP BY a.id, a.abbreviation
        ORDER BY total DESC
        LIMIT ?`,
    )
    .all(agencyLimit);

  if (agencies.length === 0) {
    return { agencies: [], values: [], cells: [], valueTotals: {} };
  }

  const valueRows = db
    .prepare<[], { value: string; total: number }>(
      `SELECT ${groupCol} AS value, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
        GROUP BY ${groupCol}
        ORDER BY total DESC, value COLLATE NOCASE ASC`,
    )
    .all();
  const values = valueRows.map((r) => r.value);
  const valueTotals: Record<string, number> = {};
  for (const r of valueRows) valueTotals[r.value] = r.total;

  const agencyIds = agencies.map((a) => a.id);
  const placeholders = agencyIds.map(() => "?").join(",");
  const cells = db
    .prepare<
      number[],
      { value: string; agency_id: number; agency_abbreviation: string; count: number }
    >(
      `SELECT ${groupCol} AS value,
              a.id AS agency_id,
              a.abbreviation AS agency_abbreviation,
              COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
          AND a.id IN (${placeholders})
        GROUP BY ${groupCol}, a.id, a.abbreviation`,
    )
    .all(...agencyIds);

  return { agencies, values, cells, valueTotals };
}

/* --------------------------------------------------------------------- */
/* Category × Topic cross-tab                                            */
/* --------------------------------------------------------------------- */
/* 2D rollup powering /browse/category-topic — IFP-curated product       */
/* categories on rows × OMB-filed topic areas on columns. Reuses the     */
/* same join path as the product_type cross-cut (use_cases →             */
/* entry_product_edges → products) so cell counts are directly           */
/* comparable to the product_type heatmap.                               */
/* --------------------------------------------------------------------- */

export interface CategoryTopicCrossTab {
  /** Top-N product categories (rows), ordered by total use-case count desc. */
  categories: Array<{ value: string; total: number }>;
  /** Top-N topic areas (columns), ordered by total use-case count desc. */
  topics: Array<{ value: string; total: number }>;
  /** Non-zero (category, topic, count) cells. */
  cells: Array<{ category: string; topic: string; count: number }>;
  /** TRUE per-category totals across ALL topics (incl. off-cap). */
  categoryTotals: Record<string, number>;
  /** TRUE per-topic totals across ALL categories (incl. off-cap). */
  topicTotals: Record<string, number>;
  /** Total distinct categories with at least one use case (incl. off-cap). */
  totalCategoryCount: number;
  /** Total distinct topics with at least one use case (incl. off-cap). */
  totalTopicCount: number;
  /** Distinct use-cases backing the visible cap × cap window. */
  visibleUseCaseCount: number;
  /** Distinct use-cases backing the full corpus (any category × any topic). */
  totalUseCaseCount: number;
}

/** Cross-tabulate IFP product categories × OMB topic areas. Row/column
 *  caps default to 15 each; off-cap activity is summarized by the page. */
export function getCategoryTopicCrossTab(
  rowLimit = 15,
  colLimit = 15,
): CategoryTopicCrossTab {
  const db = getDb();

  // Shared join + filters: use the same join path as the product_type
  // cross-cut, AND require a non-empty topic_area.
  const fromJoin = `
    FROM use_cases uc
    JOIN entry_product_edges epe
      ON epe.entry_kind = 'use_case' AND epe.entry_id = uc.id
    JOIN products p ON p.id = epe.product_id`;
  const where = `
    p.product_type IS NOT NULL
    AND TRIM(p.product_type) <> ''
    AND LOWER(TRIM(p.product_type)) <> 'unclassified'
    AND uc.topic_area IS NOT NULL
    AND uc.topic_area <> ''`;

  // Per-category totals (across all topics).
  const categoryRows = db
    .prepare<[], { value: string; total: number }>(
      `SELECT p.product_type AS value, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${where}
        GROUP BY p.product_type
        ORDER BY total DESC, value COLLATE NOCASE ASC`,
    )
    .all();

  // Per-topic totals (across all categories).
  const topicRows = db
    .prepare<[], { value: string; total: number }>(
      `SELECT uc.topic_area AS value, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${where}
        GROUP BY uc.topic_area
        ORDER BY total DESC, value COLLATE NOCASE ASC`,
    )
    .all();

  const categoryTotals: Record<string, number> = {};
  for (const r of categoryRows) categoryTotals[r.value] = r.total;
  const topicTotals: Record<string, number> = {};
  for (const r of topicRows) topicTotals[r.value] = r.total;

  const categories = categoryRows.slice(0, rowLimit);
  const topics = topicRows.slice(0, colLimit);

  // Cell counts restricted to the visible window — keeps the payload
  // small even on dimensions with many off-cap values.
  let cells: Array<{ category: string; topic: string; count: number }> = [];
  if (categories.length > 0 && topics.length > 0) {
    const catNames = categories.map((c) => c.value);
    const topicNames = topics.map((t) => t.value);
    const catPh = catNames.map(() => "?").join(",");
    const topicPh = topicNames.map(() => "?").join(",");
    cells = db
      .prepare<
        string[],
        { category: string; topic: string; count: number }
      >(
        `SELECT p.product_type AS category,
                uc.topic_area AS topic,
                COUNT(DISTINCT uc.id) AS count
           ${fromJoin}
          WHERE ${where}
            AND p.product_type IN (${catPh})
            AND uc.topic_area IN (${topicPh})
          GROUP BY p.product_type, uc.topic_area`,
      )
      .all(...catNames, ...topicNames);
  }

  // Distinct use-case totals — visible window vs. full corpus.
  let visibleUseCaseCount = 0;
  if (categories.length > 0 && topics.length > 0) {
    const catNames = categories.map((c) => c.value);
    const topicNames = topics.map((t) => t.value);
    const catPh = catNames.map(() => "?").join(",");
    const topicPh = topicNames.map(() => "?").join(",");
    const visibleRow = db
      .prepare<string[], { n: number }>(
        `SELECT COUNT(DISTINCT uc.id) AS n
           ${fromJoin}
          WHERE ${where}
            AND p.product_type IN (${catPh})
            AND uc.topic_area IN (${topicPh})`,
      )
      .get(...catNames, ...topicNames);
    visibleUseCaseCount = visibleRow?.n ?? 0;
  }

  const totalRow = db
    .prepare<[], { n: number }>(
      `SELECT COUNT(DISTINCT uc.id) AS n
         ${fromJoin}
        WHERE ${where}`,
    )
    .get();
  const totalUseCaseCount = totalRow?.n ?? 0;

  return {
    categories,
    topics,
    cells,
    categoryTotals,
    topicTotals,
    totalCategoryCount: categoryRows.length,
    totalTopicCount: topicRows.length,
    visibleUseCaseCount,
    totalUseCaseCount,
  };
}

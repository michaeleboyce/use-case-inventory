import { getDb } from "../shared/init";
import { LLM_BUCKET_CASE, LLM_NORMALIZED_FIELDS } from "../shared/sql-fragments";
import type { BreakdownRow } from "../../types";

/**
 * Vendor share restricted to general-LLM entries. Bucketed via
 * cots_vendor / tool_vendor strings on use_case_tags. Rows with no vendor at
 * all bucket to "Vendor unspecified" so the reader can see how much of the
 * LLM-access reporting is agency-wide-without-naming-the-tool.
 */
export function getLLMVendorShare(): BreakdownRow[] {
  const stmt = getDb().prepare<[], BreakdownRow>(`
    WITH tagged AS (
      SELECT ${LLM_NORMALIZED_FIELDS}
        FROM use_case_tags t
        LEFT JOIN use_cases uc ON uc.id = t.use_case_id
       WHERE t.ai_sophistication = 'general_llm'
    )
    SELECT ${LLM_BUCKET_CASE} AS label,
           COUNT(*) AS count
      FROM tagged
     GROUP BY label
     ORDER BY count DESC
  `);
  return stmt.all();
}

/**
 * Per-agency rollup of the LLM "Vendor unspecified" gap surfaced by
 * `getLLMVendorShare` / Insight Card G. Same fallback chain as
 * `getLLMVendorShare` (cots_vendor → tool_vendor → use_cases.vendor_name →
 * '' with placeholder filtering): an entry counts as "unspecified" when
 * neither the tag fields nor the OMB-filed vendor_name / system_name name
 * a vendor or product. Ranked by absolute unspecified count desc so the
 * worst contributors surface first; the analytics page renders the top 10
 * as a horizontal bar list under Fig. 07.
 */
export function getLLMVendorVisibilityByAgency(): Array<{
  agency_id: number;
  abbreviation: string;
  name: string;
  total: number;
  unspecified: number;
  share: number;
}> {
  const stmt = getDb().prepare<
    [],
    {
      agency_id: number;
      abbreviation: string;
      name: string;
      total: number;
      unspecified: number;
    }
  >(`
    WITH tagged AS (
      SELECT a.id AS agency_id,
             a.abbreviation,
             a.name,
             ${LLM_NORMALIZED_FIELDS}
        FROM use_case_tags t
        JOIN use_cases uc ON uc.id = t.use_case_id
        JOIN agencies a ON a.id = uc.agency_id
       WHERE t.ai_sophistication = 'general_llm'
    )
    SELECT agency_id,
           abbreviation,
           name,
           COUNT(*) AS total,
           SUM(CASE WHEN v_lower = '' AND p_lower = '' THEN 1 ELSE 0 END)
             AS unspecified
      FROM tagged
     GROUP BY agency_id, abbreviation, name
    HAVING unspecified > 0
     ORDER BY unspecified DESC, total DESC
  `);
  const rows = stmt.all();
  return rows.map((r) => ({
    ...r,
    share: r.total > 0 ? r.unspecified / r.total : 0,
  }));
}

/**
 * Vendor share by the CURATED per-row vendor flags (is_microsoft_copilot,
 * is_openai, ...) — the IFP-tagged companion to `getLLMVendorShare`'s
 * narrative-text bucketing. The two are rendered side by side with explicit
 * method labels: the heuristic buckets free-text vendor strings (catching
 * rows the flag pass never reviewed), while the flags come from the audited
 * tagging pipeline (catching rows whose narrative names a product the
 * string-bucketer misses, e.g. "M365" without "Microsoft"). A row can carry
 * multiple flags (Copilot on Azure OpenAI), so shares are of flagged rows,
 * not exclusive buckets.
 */
export function getCuratedVendorFlagShare(): BreakdownRow[] {
  const stmt = getDb().prepare<[], BreakdownRow>(`
    SELECT label, count FROM (
      SELECT 'Microsoft Copilot' AS label,
             SUM(is_microsoft_copilot) AS count FROM use_case_tags
      UNION ALL
      SELECT 'GitHub Copilot', SUM(is_github_copilot) FROM use_case_tags
      UNION ALL
      SELECT 'OpenAI', SUM(is_openai) FROM use_case_tags
      UNION ALL
      SELECT 'Google', SUM(is_google) FROM use_case_tags
      UNION ALL
      SELECT 'AWS AI', SUM(is_aws_ai) FROM use_case_tags
      UNION ALL
      SELECT 'Anthropic', SUM(is_anthropic) FROM use_case_tags
    )
    WHERE count > 0
    ORDER BY count DESC
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

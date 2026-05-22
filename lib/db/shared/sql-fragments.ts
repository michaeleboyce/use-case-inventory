/**
 * Shared SQL fragments referenced by multiple domain modules.
 *
 * Each fragment is a `string` (not a tagged template) so it can be
 * interpolated directly into a `prepare(...)` argument. They contain no
 * placeholders — pure SQL text only.
 */

/**
 * Normalize the 30+ free-text variants of `use_cases.stage_of_development`
 * into the 4 canonical OMB M-25-21 buckets:
 *   'pre_deployment' | 'pilot' | 'deployed' | 'retired' | 'unknown'.
 *
 * Usage:
 *   SELECT ${STAGE_BUCKET_SQL} AS stage_bucket FROM use_cases uc ...
 */
export const STAGE_BUCKET_SQL = `
  CASE
    WHEN uc.stage_of_development IS NULL OR TRIM(uc.stage_of_development) = ''
      THEN 'unknown'
    WHEN LOWER(uc.stage_of_development) LIKE '%retired%'
      THEN 'retired'
    WHEN LOWER(uc.stage_of_development) LIKE '%pilot%'
      THEN 'pilot'
    WHEN LOWER(uc.stage_of_development) LIKE '%deployed%'
      THEN 'deployed'
    WHEN LOWER(uc.stage_of_development) LIKE '%pre-deployment%'
      OR LOWER(uc.stage_of_development) LIKE '%pre deployment%'
      OR LOWER(uc.stage_of_development) LIKE '%development or acquisition%'
      THEN 'pre_deployment'
    ELSE 'unknown'
  END
`;

/**
 * Canonical SELECT for joined use-case rows: use_cases + agency + product +
 * template (left-joined). The shape matches the `JoinedUseCaseRow` type in
 * the use-cases domain module.
 */
export const USE_CASE_SELECT = `
  SELECT uc.*,
         a.name AS agency_name,
         a.abbreviation AS agency_abbreviation,
         p.canonical_name AS product_name,
         t.short_name AS template_short_name
    FROM use_cases uc
    JOIN agencies a ON a.id = uc.agency_id
    LEFT JOIN products p ON p.id = uc.product_id
    LEFT JOIN use_case_templates t ON t.id = uc.template_id
`;

/**
 * Canonical SELECT for external-evidence rows. Used by both
 * `getExternalEvidenceForUseCase` and `getExternalEvidenceForConsolidated`.
 */
export const EXTERNAL_EVIDENCE_SELECT = `
  SELECT id, use_case_id, consolidated_use_case_id, topic, status,
         source_url, source_quote, confidence, search_method,
         captured_at, captured_by, notes
    FROM use_case_external_evidence
`;

/**
 * Recursive-CTE fragment that resolves every `products.id` to its effective
 * set of FedRAMP links: direct links plus any links found by walking up
 * `parent_product_id` (capped at 5 hops to guard against accidental cycles).
 *
 * Emits one row per (inventory_product_id, fedramp_id) pair with
 * `inherited_from_parent_id` set to NULL when the link is direct, or the
 * ancestor product id when it came from the parent walk. Use as:
 *
 *   WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
 *   SELECT ... FROM effective_fedramp_links ...
 */
/**
 * LLM-vendor bucketing — shared SQL.
 *
 * Three analytics callers (`getLLMVendorShare`,
 * `getLLMVendorVisibilityByAgency`,
 * `getAnalyticsInsights.general_llm_unspecified`) all use the same
 * fallback chain and bucket definitions. Factored out as constants so
 * adding a new bucket (e.g. "Agency platform") only edits one place.
 *
 * Fallback for v_lower:
 *   tag.cots_vendor → tag.tool_vendor → use_cases.vendor_name → ''
 * with placeholder values ('n/a','not available','none','tbd','unknown',
 * etc.) treated as blank on the vendor side AND on the product side (so
 * a row with vendor='N/A' product='REDACTED' correctly buckets as
 * "Vendor unspecified" instead of leaking into "Other named").
 */
export const LLM_NORMALIZED_FIELDS = `
  LOWER(TRIM(COALESCE(
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
  CASE
    WHEN LOWER(TRIM(COALESCE(
           NULLIF(t.cots_product_name,''),
           NULLIF(t.tool_product_name,''),
           uc.system_name,
           ''
         )))
      IN ('n/a','not available','none','tbd','tbd.','unknown','',
          'redacted for cybersecurity purposes.','redacted',
          'r&d user','cs-ssp-123,cybersecurity system security plan for azure platform')
    THEN ''
    ELSE LOWER(TRIM(COALESCE(
      NULLIF(t.cots_product_name,''),
      NULLIF(t.tool_product_name,''),
      uc.system_name,
      ''
    )))
  END AS p_lower`;

/**
 * WHERE predicate: the entry names neither a vendor nor a product — the
 * "Vendor unspecified" bucket from `LLM_BUCKET_CASE` (`v_lower='' AND
 * p_lower=''`). Backs the `vendorUnspecified` filter on `/use-cases`.
 *
 * This is the predicate form of `LLM_NORMALIZED_FIELDS` re-aliased to the
 * use-cases query's table aliases (`tag` for use_case_tags, `uc` for
 * use_cases). The COALESCE chains and placeholder lists are kept byte-identical
 * to `LLM_NORMALIZED_FIELDS` above so this filter reproduces the same count the
 * analytics donut / Insight Card G report — edit both together.
 */
export const LLM_VENDOR_UNSPECIFIED_PREDICATE = `
  LOWER(TRIM(COALESCE(
    NULLIF(tag.cots_vendor,''),
    NULLIF(tag.tool_vendor,''),
    CASE
      WHEN LOWER(TRIM(COALESCE(uc.vendor_name,'')))
        IN ('n/a','not available','none','tbd','tbd.','unknown','')
      THEN ''
      ELSE uc.vendor_name
    END,
    ''
  ))) = ''
  AND
  CASE
    WHEN LOWER(TRIM(COALESCE(
           NULLIF(tag.cots_product_name,''),
           NULLIF(tag.tool_product_name,''),
           uc.system_name,
           ''
         )))
      IN ('n/a','not available','none','tbd','tbd.','unknown','',
          'redacted for cybersecurity purposes.','redacted',
          'r&d user','cs-ssp-123,cybersecurity system security plan for azure platform')
    THEN ''
    ELSE LOWER(TRIM(COALESCE(
      NULLIF(tag.cots_product_name,''),
      NULLIF(tag.tool_product_name,''),
      uc.system_name,
      ''
    )))
  END = ''`;

/**
 * Bucket the (v_lower, p_lower) pair emitted by `LLM_NORMALIZED_FIELDS`
 * into editorial vendor names. Ordered most-specific → most-general.
 * "Agency platform" is checked FIRST (before Microsoft) so an agency
 * wrapper around Azure OpenAI buckets as the agency platform, not as
 * Microsoft. Editorial intent: surface that federal agencies are
 * quietly building their own LLM frontends.
 */
export const LLM_BUCKET_CASE = `
  CASE
    -- Agency-built platforms wrapping commercial LLMs. Checked before the
    -- vendor buckets so e.g. EDAV (CDC's Azure OpenAI wrapper) reads as
    -- agency platform, not Microsoft.
    WHEN p_lower LIKE '%edav%' OR p_lower LIKE '%enterprise data%analytics%visualization%'
      OR p_lower LIKE '%va gpt%' OR p_lower LIKE '%billiegpt%'
      OR p_lower LIKE '%daisi%'
      OR p_lower LIKE '%librechat%'
      OR p_lower LIKE '%usai%' AND p_lower NOT LIKE '%usaid%'
      OR p_lower LIKE '%elsa (fda)%' OR p_lower LIKE '%elsa%fda%'
      OR p_lower LIKE '%internal chatbot rasa%' OR p_lower LIKE '%rasa%chatbot%'
      OR p_lower LIKE '%nigms%openai%' OR p_lower LIKE '%nih%sharepoint%openai%'
      THEN 'Agency platform'
    WHEN v_lower LIKE '%microsoft%' OR v_lower = 'azure' OR v_lower LIKE 'azure %'
      OR p_lower LIKE '%copilot%' OR p_lower LIKE '%azure openai%'
      OR p_lower LIKE '%azure gov%' OR p_lower LIKE '%microsoft teams%'
      THEN 'Microsoft'
    WHEN v_lower LIKE '%openai%' OR p_lower LIKE 'chatgpt%' OR p_lower = 'openai api'
      THEN 'OpenAI'
    WHEN v_lower LIKE '%anthropic%' OR p_lower LIKE 'claude%' THEN 'Anthropic'
    WHEN v_lower = 'google' OR v_lower LIKE 'google %' OR p_lower LIKE '%gemini%'
      THEN 'Google'
    WHEN v_lower LIKE '%amazon%' OR v_lower LIKE '%aws%' OR p_lower LIKE '%bedrock%'
      THEN 'Amazon'
    WHEN v_lower = 'xai' OR p_lower LIKE 'grok%' THEN 'xAI'
    WHEN v_lower LIKE '%meta%' OR p_lower LIKE 'llama%' OR p_lower LIKE 'meta llama%'
      THEN 'Meta'
    WHEN v_lower LIKE '%perplexity%' THEN 'Perplexity'
    WHEN v_lower LIKE '%palantir%' THEN 'Palantir'
    WHEN v_lower LIKE '%servicenow%' THEN 'ServiceNow'
    WHEN v_lower LIKE '%databricks%' THEN 'Databricks'
    WHEN v_lower IN ('in-house','inhouse','agency','custom') THEN 'In-house'
    WHEN v_lower = '' AND p_lower = '' THEN 'Vendor unspecified'
    ELSE 'Other named'
  END`;

export const EFFECTIVE_FEDRAMP_LINKS_CTE = `
  product_chain(inventory_product_id, ancestor_id, depth) AS (
    SELECT id, id, 0 FROM products
    UNION ALL
    SELECT pc.inventory_product_id, p.parent_product_id, pc.depth + 1
      FROM product_chain pc
      JOIN products p ON p.id = pc.ancestor_id
     WHERE p.parent_product_id IS NOT NULL
       AND pc.depth < 5
  ),
  effective_fedramp_links AS (
    SELECT pc.inventory_product_id,
           l.fedramp_id,
           CASE WHEN pc.depth = 0 THEN NULL ELSE pc.ancestor_id END
             AS inherited_from_parent_id,
           pc.depth AS inherited_depth,
           l.confidence,
           l.source,
           l.score,
           l.notes
      FROM product_chain pc
      JOIN fedramp_product_links l
        ON l.inventory_product_id = pc.ancestor_id
  )
`;

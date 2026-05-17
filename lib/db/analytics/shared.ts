// ---------------------------------------------------------------------------
// LLM-vendor bucketing — shared SQL
// ---------------------------------------------------------------------------
// Three helpers below (`getLLMVendorShare`, `getLLMVendorVisibilityByAgency`,
// `getAnalyticsInsights.general_llm_unspecified`) all share the same
// fallback chain and bucket definitions. Factored out as constants so adding
// a new bucket (e.g. "Agency platform") only edits one place.
//
// Fallback for v_lower:
//   tag.cots_vendor → tag.tool_vendor → use_cases.vendor_name → ''
// with placeholder values ('n/a','not available','none','tbd','unknown',etc.)
// treated as blank on the vendor side AND on the product side (so a row with
// vendor='N/A' product='REDACTED' correctly buckets as Vendor unspecified
// instead of leaking into "Other named").
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

// Buckets ordered most-specific → most-general. "Agency platform" is checked
// FIRST (before Microsoft) so an agency wrapper around Azure OpenAI buckets
// as the agency platform, not as Microsoft. Editorial intent: surface that
// federal agencies are quietly building their own LLM frontends.
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

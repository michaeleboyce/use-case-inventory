-- Minimal seed data for the dashboard test fixture DB.
--
-- Goal: enough rows across agencies / products / templates / use_cases /
-- use_case_tags / consolidated_use_cases to exercise the joins and filters
-- the `lib/db/*` modules expose. Loaded after `schema.sql` by tests/setup.ts.
--
-- Conventions:
--   * Agencies: 5 total. 3 with full data (VA, DHS, GSA), 1 found-only
--     (FOO), 1 not-found (BAR) — exercises status filters.
--   * Products: 6 named products spanning vendors (OpenAI, Microsoft,
--     Anthropic, GitHub) + product types (LLM, coding_assistant).
--   * Templates: 3 OMB templates.
--   * Use cases: 12 individual + 4 consolidated. Stages, AI classifications,
--     and high-impact designations spread for filter tests.
--   * Tags: 1:1 with each use case so tag-joined filters resolve.

-- --------------------------------------------------------------------
-- agencies
-- --------------------------------------------------------------------
INSERT INTO agencies (id, name, abbreviation, agency_type, status, inventory_year, date_accessed) VALUES
  (1, 'Department of Veterans Affairs', 'VA',  'CFO Act',     'FOUND_2025',        2025, '2025-10-01'),
  (2, 'Department of Homeland Security', 'DHS', 'CFO Act',    'FOUND_2025',        2025, '2025-10-02'),
  (3, 'General Services Administration', 'GSA', 'CFO Act',    'FOUND_2025',        2025, '2025-10-03'),
  (4, 'Foo Agency',                       'FOO', 'Independent', 'FOUND_2024_ONLY', 2024, '2024-09-15'),
  (5, 'Bar Agency',                       'BAR', 'Independent', 'NOT_FOUND',       NULL, NULL);

-- --------------------------------------------------------------------
-- products
-- --------------------------------------------------------------------
INSERT INTO products (id, canonical_name, vendor, product_type, is_generative_ai, is_frontier_llm, product_origin) VALUES
  (1, 'ChatGPT',           'OpenAI',    'LLM',              1, 1, 'commercial'),
  (2, 'Microsoft Copilot', 'Microsoft', 'LLM',              1, 1, 'commercial'),
  (3, 'Claude',            'Anthropic', 'LLM',              1, 1, 'commercial'),
  (4, 'GitHub Copilot',    'GitHub',    'coding_assistant', 1, 0, 'commercial'),
  (5, 'VA GPT',            'Department of Veterans Affairs', 'LLM', 1, 0, 'agency_internal_platform'),
  (6, 'Cursor',            'Anysphere', 'coding_assistant', 1, 0, 'commercial');

-- --------------------------------------------------------------------
-- use_case_templates
-- --------------------------------------------------------------------
INSERT INTO use_case_templates (id, template_text, short_name, capability_category, is_omb_standard) VALUES
  (1, 'Use of commercial generative AI tools for general productivity', 'GenAI productivity', 'writing', 1),
  (2, 'Use of coding-assistant tools by IT staff',                       'Coding assistants',  'coding',  1),
  (3, 'Document summarization and search',                                'Doc search',         'search',  1);

-- --------------------------------------------------------------------
-- use_cases — VA (1..5), DHS (6..9), GSA (10..12)
-- --------------------------------------------------------------------
INSERT INTO use_cases (id, agency_id, source_file, slug, use_case_id, use_case_name, bureau_component, stage_of_development, is_high_impact, topic_area, ai_classification, vendor_name, product_id, template_id) VALUES
  ( 1, 1, 'va-2025.csv', 'va-clinical-summary',         'VA-001', 'Clinical Note Summarization',     'Veterans Health Admin', 'Deployed',       'No',  'Health',       'Generative AI', 'OpenAI',    1, 1),
  ( 2, 1, 'va-2025.csv', 'va-claims-triage',            'VA-002', 'Claims Triage Assistant',          'Veterans Benefits',     'Pilot',          'Yes', 'Benefits',     'Classical ML',  NULL,        NULL, NULL),
  ( 3, 1, 'va-2025.csv', 'va-coding-assistants',        'VA-003', 'GitHub Copilot for VA Engineers',  'OIT',                   'Deployed',       'No',  'IT',           'Generative AI', 'GitHub',    4, 2),
  ( 4, 1, 'va-2025.csv', 'va-gpt-chatbot',              'VA-004', 'VA GPT Internal Chatbot',          'OIT',                   'Pre-Deployment', 'No',  'IT',           'Generative AI', 'VA',        5, NULL),
  ( 5, 1, 'va-2025.csv', 'va-retired-tool',             'VA-005', 'Retired Imaging Tool',             'Veterans Health Admin', 'Retired',        'No',  'Health',       'Classical ML',  NULL,        NULL, NULL),
  ( 6, 2, 'dhs-2025.csv','dhs-border-vision',           'DHS-001','Border Camera Image Analysis',    'CBP',                    'Deployed',       'Yes', 'Security',     'Computer Vision', NULL,      NULL, NULL),
  ( 7, 2, 'dhs-2025.csv','dhs-copilot-pilot',           'DHS-002','Microsoft Copilot Pilot',         'HQ',                     'Pilot',          'No',  'IT',           'Generative AI', 'Microsoft', 2, 1),
  ( 8, 2, 'dhs-2025.csv','dhs-claude-research',         'DHS-003','Claude for Policy Research',      'Policy',                 'Deployed',       'No',  'Policy',       'Generative AI', 'Anthropic', 3, 3),
  ( 9, 2, 'dhs-2025.csv','dhs-pre-deployment-fraud',    'DHS-004','Fraud Detection (in development)','HQ',                     'Development or Acquisition', 'No', 'Security', 'Classical ML', NULL, NULL, NULL),
  (10, 3, 'gsa-2025.csv','gsa-chatgpt',                 'GSA-001','ChatGPT Enterprise',              'GSA IT',                 'Deployed',       'No',  'IT',           'Generative AI', 'OpenAI',    1, 1),
  (11, 3, 'gsa-2025.csv','gsa-cursor',                  'GSA-002','Cursor IDE for Engineers',        'GSA IT',                 'Deployed',       'No',  'IT',           'Generative AI', 'Anysphere', 6, 2),
  (12, 3, 'gsa-2025.csv','gsa-doc-search',              'GSA-003','Document Search Pilot',           'GSA IT',                 'Pilot',          'No',  'IT',           'Generative AI', 'OpenAI',    1, 3);

-- --------------------------------------------------------------------
-- use_case_tags — one per use_case, varied so filter tests find data
-- --------------------------------------------------------------------
INSERT INTO use_case_tags (use_case_id, entry_type, is_general_llm_access, is_coding_tool, is_generative_ai, deployment_scope, ai_sophistication, architecture_type, use_type, high_impact_designation) VALUES
  ( 1, 'product_deployment',  0, 0, 1, 'enterprise',      'frontier_llm',  'cloud_hosted', 'production', 'not_high_impact'),
  ( 2, 'custom_system',       0, 0, 0, 'bureau',          'classical_ml',  'on_premises',  'production', 'high_impact'),
  ( 3, 'product_deployment',  0, 1, 1, 'team',            'frontier_llm',  'cloud_hosted', 'production', 'not_high_impact'),
  ( 4, 'product_deployment',  1, 0, 1, 'enterprise',      'frontier_llm',  'cloud_hosted', 'production', 'not_high_impact'),
  ( 5, 'custom_system',       0, 0, 0, 'bureau',          'classical_ml',  'on_premises',  'retired',    'not_high_impact'),
  ( 6, 'custom_system',       0, 0, 0, 'bureau',          'classical_ml',  'on_premises',  'production', 'high_impact'),
  ( 7, 'product_deployment',  1, 0, 1, 'pilot',           'frontier_llm',  'cloud_hosted', 'pilot',      'not_high_impact'),
  ( 8, 'product_deployment',  1, 0, 1, 'team',            'frontier_llm',  'cloud_hosted', 'production', 'not_high_impact'),
  ( 9, 'custom_system',       0, 0, 0, 'pilot',           'classical_ml',  'on_premises',  'pre_deployment', 'not_high_impact'),
  (10, 'product_deployment',  1, 0, 1, 'enterprise',      'frontier_llm',  'cloud_hosted', 'production', 'not_high_impact'),
  (11, 'product_deployment',  0, 1, 1, 'team',            'frontier_llm',  'cloud_hosted', 'production', 'not_high_impact'),
  (12, 'product_deployment',  0, 0, 1, 'pilot',           'frontier_llm',  'cloud_hosted', 'pilot',      'not_high_impact');

-- --------------------------------------------------------------------
-- consolidated_use_cases — 4 OMB rollups (VA x2, DHS x1, GSA x1)
-- --------------------------------------------------------------------
INSERT INTO consolidated_use_cases (id, agency_id, source_file, slug, ai_use_case, commercial_product, agency_uses, product_id, template_id) VALUES
  (1, 1, 'omb-consolidated-2025.csv', 'va-genai-productivity-consolidated', 'GenAI productivity tools', 'Microsoft Copilot', 'Various VA staff use Microsoft Copilot for drafting', 2, 1),
  (2, 1, 'omb-consolidated-2025.csv', 'va-coding-consolidated',             'Coding assistants',         'GitHub Copilot',     'Engineering teams use GitHub Copilot',                4, 2),
  (3, 2, 'omb-consolidated-2025.csv', 'dhs-genai-consolidated',             'GenAI productivity tools', 'Microsoft Copilot', 'DHS staff use Copilot for drafting',                   2, 1),
  (4, 3, 'omb-consolidated-2025.csv', 'gsa-genai-consolidated',             'GenAI productivity tools', 'ChatGPT',           'GSA staff use ChatGPT Enterprise',                     1, 1);

-- Tags for consolidated rows (use_case_id is null; consolidated_use_case_id set)
INSERT INTO use_case_tags (consolidated_use_case_id, entry_type, is_general_llm_access, is_coding_tool, is_generative_ai, deployment_scope, ai_sophistication) VALUES
  (1, 'generic_use_pattern', 1, 0, 1, 'enterprise', 'frontier_llm'),
  (2, 'generic_use_pattern', 0, 1, 1, 'team',       'frontier_llm'),
  (3, 'generic_use_pattern', 1, 0, 1, 'enterprise', 'frontier_llm'),
  (4, 'generic_use_pattern', 1, 0, 1, 'enterprise', 'frontier_llm');

-- --------------------------------------------------------------------
-- agency_ai_maturity — 3 of 5 agencies have rollups
-- --------------------------------------------------------------------
INSERT INTO agency_ai_maturity (
  agency_id, total_use_cases, total_consolidated_entries, distinct_products_deployed,
  generative_ai_count, coding_tool_count, general_llm_count, classical_ml_count,
  agentic_ai_count, custom_system_count,
  has_enterprise_llm, has_coding_assistants, has_agentic_ai, has_custom_ai,
  pct_deployed, pct_high_impact, pct_with_risk_docs, year_over_year_growth,
  maturity_tier
) VALUES
  (1, 5, 2, 4, 4, 1, 1, 2, 0, 2, 1, 1, 0, 1, 0.60, 0.20, 0.40, 0.25, 'building'),
  (2, 4, 1, 2, 3, 0, 2, 1, 0, 2, 1, 0, 0, 1, 0.50, 0.25, 0.50, 0.10, 'exploring'),
  (3, 3, 1, 3, 3, 1, 2, 0, 0, 0, 1, 1, 0, 0, 0.67, 0.00, 0.33, 0.50, 'advanced');

-- --------------------------------------------------------------------
-- use_case_products — bridge rows used by getUseCaseFacets's product join
-- --------------------------------------------------------------------
INSERT INTO use_case_products (use_case_id, product_id) VALUES
  (1, 1), (3, 4), (4, 5), (7, 2), (8, 3), (10, 1), (11, 6), (12, 1);

-- --------------------------------------------------------------------
-- Federal AI policy tracker — minimal seed for /policy query tests.
-- Three agency rows (Cabinet x2, Independent x1) + the two governing-document
-- groups (EOP, OMB). Years span 2024–2026 to exercise filtering.
-- --------------------------------------------------------------------
INSERT INTO agency_ai_policy_compliance
  (agency_abbr, agency_name, agency_type, searched, date_searched,
   ai_landing_page_url, ai_strategy_year, compliance_plan_year,
   genai_policy_year, caio_status, other_policy_count, total_documents,
   gaps, notes)
VALUES
  ('DHS','Department of Homeland Security','Cabinet',1,'2026-05-21',
    'https://www.dhs.gov/ai',2025,2025,NULL,'Designated',2,4,NULL,NULL),
  ('DOJ','Department of Justice','Cabinet',1,'2026-05-21',
    'https://www.justice.gov/ai',NULL,2024,NULL,'Designated',1,2,
    'No public M-25-21 strategy',NULL),
  ('NSF','National Science Foundation','Independent',1,'2026-05-21',
    'https://www.nsf.gov/policies/ai',2025,2025,NULL,'Named: Thu Williams',0,2,NULL,NULL);

INSERT INTO agency_ai_policy_documents
  (agency_abbr, agency_name, agency_type, issuing_office, document_type,
   document_title, publication_year, publication_date, pages, issuing_memo,
   superseded, is_public, url, local_path, access_status, date_accessed, notes)
VALUES
  ('DHS','Department of Homeland Security','Cabinet','DHS OCIO',
    'M-25-21 AI Strategy','DHS AI Strategy',2025,'2025-09-26',10,'M-25-21',
    0,1,'https://example.gov/dhs-strategy.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('DHS','Department of Homeland Security','Cabinet','DHS OCIO',
    'M-25-21 Compliance Plan','DHS Compliance Plan',2025,'2025-09-26',12,'M-25-21',
    0,1,'https://example.gov/dhs-plan.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('DOJ','Department of Justice','Cabinet','DOJ',
    'M-24-10 Compliance Plan','DOJ M-24-10 Compliance Plan',2024,'2024-10-01',11,'M-24-10',
    1,1,'https://justice.gov/plan.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('NSF','National Science Foundation','Independent','NSF',
    'M-25-21 AI Strategy','NSF AI Strategy',2025,'2025-09-30',22,'M-25-21',
    0,1,'https://nsf.gov/strategy.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('NSF','National Science Foundation','Independent','NSF',
    'M-25-21 Compliance Plan','NSF Compliance Plan',2025,'2025-09-30',7,'M-25-21',
    0,1,'https://nsf.gov/plan.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('EOP','Executive Office of the President','White House / OMB','The White House',
    'Executive Order','EO 14179: Removing Barriers to American Leadership in AI',
    2025,'2025-01-23',2,NULL,0,1,'https://www.govinfo.gov/eo14179.pdf',NULL,
    'Downloaded','2026-05-21',NULL),
  ('OMB','Office of Management and Budget','White House / OMB','OMB',
    'OMB Memorandum','OMB M-25-21: Accelerating Federal Use of AI',
    2025,'2025-04-03',25,NULL,0,1,'https://www.whitehouse.gov/M-25-21.pdf',NULL,
    'Downloaded','2026-05-21',NULL);

-- Mirror of the ETL repo's scripts/normalize_use_case_fields.py (m016):
-- the app reads stage_normalized via STAGE_BUCKET_SQL, so the fixture must
-- populate it the same way the pipeline does.
UPDATE use_cases SET stage_normalized = CASE
    WHEN stage_of_development IS NULL OR TRIM(stage_of_development) = '' THEN 'unknown'
    WHEN LOWER(stage_of_development) LIKE '%retired%' THEN 'retired'
    WHEN LOWER(stage_of_development) LIKE '%pilot%' THEN 'pilot'
    WHEN LOWER(stage_of_development) LIKE '%deployed%' THEN 'deployed'
    WHEN LOWER(stage_of_development) LIKE '%production%' THEN 'deployed'
    WHEN LOWER(stage_of_development) LIKE '%pre-deployment%'
      OR LOWER(stage_of_development) LIKE '%pre deployment%'
      OR LOWER(stage_of_development) LIKE '%development or acquisition%'
      THEN 'pre_deployment'
    ELSE 'unknown'
END;

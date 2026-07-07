CREATE TABLE agencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL UNIQUE,
    agency_type TEXT,
    inventory_page_url TEXT,
    csv_download_url TEXT,
    inventory_year INTEGER,
    status TEXT,
    schema_compliance REAL,
    notes TEXT,
    last_modified TEXT,
    date_accessed TEXT
);
CREATE TABLE sqlite_sequence(name,seq);
CREATE INDEX idx_agencies_abbr ON agencies(abbreviation);
CREATE INDEX idx_agencies_status ON agencies(status);
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_name TEXT NOT NULL UNIQUE,
    vendor TEXT,
    product_type TEXT,  -- LLM, coding_assistant, security_tool, productivity, legal_research, etc.
    is_generative_ai INTEGER DEFAULT 0,
    is_frontier_llm INTEGER DEFAULT 0,
    parent_product_id INTEGER REFERENCES products(id),
    description TEXT,
    notes TEXT
, product_origin TEXT NOT NULL DEFAULT 'commercial');
CREATE INDEX idx_products_vendor ON products(vendor);
CREATE INDEX idx_products_type ON products(product_type);
CREATE TABLE product_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    alias_text TEXT NOT NULL,
    UNIQUE(alias_text)
);
CREATE INDEX idx_aliases_text ON product_aliases(alias_text);
CREATE INDEX idx_aliases_product ON product_aliases(product_id);
CREATE TABLE use_case_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_text TEXT NOT NULL UNIQUE,
    short_name TEXT UNIQUE,
    capability_category TEXT,  -- writing, coding, search, meetings, email, data_viz, travel, etc.
    is_omb_standard INTEGER DEFAULT 1,
    notes TEXT
);
CREATE INDEX idx_templates_category ON use_case_templates(capability_category);
CREATE TABLE use_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    source_file TEXT NOT NULL,
    slug TEXT UNIQUE,

    -- Section 1: Use Case Identifiers
    use_case_id TEXT,
    use_case_name TEXT NOT NULL,
    bureau_component TEXT,
    email_address TEXT,
    is_withheld TEXT,
    stage_of_development TEXT,
    is_high_impact TEXT,
    justification TEXT,

    -- Section 2: Use Case Summary
    topic_area TEXT,
    ai_classification TEXT,
    problem_statement TEXT,
    expected_benefits TEXT,
    system_outputs TEXT,
    operational_date TEXT,

    -- Section 3: Documentation
    development_type TEXT,
    vendor_name TEXT,
    has_ato TEXT,
    system_name TEXT,
    training_data_description TEXT,

    -- Section 4: Data & Code
    link_to_data TEXT,
    has_pii TEXT,
    pia_url TEXT,
    demographic_features TEXT,
    has_custom_code TEXT,
    code_url TEXT,

    -- Section 5: Risk Management
    hi_testing_conducted TEXT,
    hi_assessment_completed TEXT,
    hi_potential_impacts TEXT,
    hi_independent_review TEXT,
    hi_ongoing_monitoring TEXT,
    hi_training_established TEXT,
    hi_failsafe_presence TEXT,
    hi_appeal_process TEXT,
    hi_public_consultation TEXT,

    -- Product/template linking

    -- Lossless preservation
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
, id_provenance TEXT, organization_id INTEGER REFERENCES federal_organizations(id), bureau_organization_id INTEGER REFERENCES federal_organizations(id), omb_consolidated_id TEXT, omb_consolidated_source TEXT, omb_consolidated_first_seen TEXT, omb_consolidated_last_seen TEXT, stage_normalized TEXT, ai_classification_normalized TEXT, high_impact_normalized TEXT);
CREATE INDEX idx_use_cases_agency ON use_cases(agency_id);
CREATE INDEX idx_use_cases_stage ON use_cases(stage_of_development);
CREATE INDEX idx_use_cases_high_impact ON use_cases(is_high_impact);
CREATE INDEX idx_use_cases_ai_class ON use_cases(ai_classification);
CREATE TABLE consolidated_use_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    source_file TEXT NOT NULL,
    slug TEXT UNIQUE,

    ai_use_case TEXT NOT NULL,  -- the capability description
    commercial_product TEXT,  -- product name as written
    commercial_examples TEXT,  -- if listed
    agency_uses TEXT,  -- Y/N
    estimated_licenses_users TEXT,  -- "1-100", "101-1000", etc.

    -- Product/template linking
    template_id INTEGER REFERENCES use_case_templates(id),

    -- Lossless preservation
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
, organization_id INTEGER REFERENCES federal_organizations(id), bureau_organization_id INTEGER REFERENCES federal_organizations(id), source_format TEXT);
CREATE INDEX idx_consolidated_agency ON consolidated_use_cases(agency_id);
CREATE INDEX idx_consolidated_template ON consolidated_use_cases(template_id);
CREATE TABLE use_case_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    use_case_id INTEGER REFERENCES use_cases(id),
    consolidated_use_case_id INTEGER REFERENCES consolidated_use_cases(id),

    -- What the entry represents
    entry_type TEXT,  -- generic_use_pattern, product_deployment, product_feature, custom_system, bespoke_application
    is_product_capability_entry INTEGER DEFAULT 0,
    product_capability TEXT,  -- drafting, coding, search, meetings, email, etc.

    -- Tool categorization
    is_general_llm_access INTEGER,
    is_coding_tool INTEGER,
    is_cots_commercial INTEGER,
    tool_product_name TEXT,
    tool_vendor TEXT,

    -- Sophistication
    ai_sophistication TEXT,  -- general_llm, coding_assistant, agentic, classical_ml, computer_vision, nlp_specific, predictive_analytics
    is_generative_ai INTEGER,
    is_frontier_model INTEGER,

    -- Deployment scope
    deployment_scope TEXT,  -- enterprise_wide, department, bureau, office, team, pilot
    scope_detail TEXT,
    is_enterprise_wide INTEGER,
    estimated_user_count TEXT,

    -- Architecture
    architecture_type TEXT,  -- inference_only, rag_pipeline, fine_tuned, custom_trained, agentic_workflow, unknown
    has_model_training INTEGER,

    -- Product detail
    cots_product_name TEXT,
    cots_vendor TEXT,
    is_microsoft_copilot INTEGER,
    is_openai INTEGER,
    is_anthropic INTEGER,
    is_google INTEGER,
    is_github_copilot INTEGER,
    is_aws_ai INTEGER,

    -- Mission characterization
    use_type TEXT,  -- mission_critical, administrative, it_operations, cybersecurity, research
    is_public_facing INTEGER,

    -- Governance
    has_meaningful_risk_docs INTEGER,
    high_impact_designation TEXT,
    deployment_environment TEXT,  -- azure_gov, aws_govcloud, gcp, on_prem, saas, unknown
    has_ato_or_fedramp INTEGER,

    created_at TEXT DEFAULT (datetime('now')),

    -- IFP-adjudicated 2026-07 labeling rounds (appended via ALTER TABLE in the
    -- ETL). integration_depth: standalone_chat | workflow_embedded |
    -- system_integrated | agentic_workflow | unclear (NULL = not assessed).
    -- coding_tool_type: chat_assistant | ide_autocomplete | coding_agent |
    -- code_analysis_tool | not_coding | unclear (NULL = not a coding row).
    integration_depth TEXT,
    coding_tool_type TEXT,

    -- Must reference either use_cases or consolidated_use_cases, not both
    CHECK ((use_case_id IS NOT NULL AND consolidated_use_case_id IS NULL) OR
           (use_case_id IS NULL AND consolidated_use_case_id IS NOT NULL))
);
CREATE INDEX idx_tags_use_case ON use_case_tags(use_case_id);
CREATE INDEX idx_tags_consolidated ON use_case_tags(consolidated_use_case_id);
CREATE INDEX idx_tags_entry_type ON use_case_tags(entry_type);
CREATE INDEX idx_tags_llm ON use_case_tags(is_general_llm_access);
CREATE INDEX idx_tags_coding ON use_case_tags(is_coding_tool);
CREATE INDEX idx_tags_scope ON use_case_tags(deployment_scope);
CREATE TABLE agency_ai_maturity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_id INTEGER NOT NULL UNIQUE REFERENCES agencies(id),

    total_use_cases INTEGER,
    total_consolidated_entries INTEGER,
    distinct_products_deployed INTEGER,  -- after dedup

    generative_ai_count INTEGER,
    coding_tool_count INTEGER,
    general_llm_count INTEGER,
    classical_ml_count INTEGER,
    agentic_ai_count INTEGER,
    custom_system_count INTEGER,

    has_enterprise_llm INTEGER,
    has_coding_assistants INTEGER,
    has_agentic_ai INTEGER,
    has_custom_ai INTEGER,

    pct_deployed REAL,
    pct_high_impact REAL,
    pct_with_risk_docs REAL,

    year_over_year_growth REAL,

    maturity_tier TEXT,  -- leading, progressing, early, minimal, none
    notes TEXT,

    updated_at TEXT DEFAULT (datetime('now'))
, organization_id INTEGER REFERENCES federal_organizations(id));
CREATE INDEX idx_maturity_tier ON agency_ai_maturity(maturity_tier);
CREATE TABLE column_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_abbreviation TEXT NOT NULL,
    source_column_name TEXT NOT NULL,
    canonical_column_name TEXT,
    notes TEXT
);
CREATE INDEX idx_column_mappings_agency ON column_mappings(agency_abbreviation);
CREATE INDEX idx_use_cases_id_provenance ON use_cases(id_provenance);
CREATE TABLE review_queue_entry_type (
  use_case_id INTEGER PRIMARY KEY REFERENCES use_cases(id),
  heuristic_label TEXT NOT NULL,
  llm_label TEXT,
  llm_confidence TEXT,
  llm_reasoning TEXT,
  applied INTEGER DEFAULT 0
);
CREATE TABLE review_queue_llm (
    use_case_id INTEGER PRIMARY KEY REFERENCES use_cases(id),
    heuristic_label INTEGER NOT NULL,
    confidence_source TEXT NOT NULL DEFAULT 'heuristic',
    llm_label INTEGER,
    llm_confidence TEXT,
    llm_reasoning TEXT,
    applied INTEGER DEFAULT 0,
    applied_at TEXT
);
CREATE TABLE review_queue_scope (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_type TEXT NOT NULL,  -- 'scope' or 'architecture'
    use_case_id INTEGER REFERENCES use_cases(id),
    consolidated_use_case_id INTEGER REFERENCES consolidated_use_cases(id),
    current_tag TEXT,
    heuristic_proposed_tag TEXT,
    raw_source TEXT,
    llm_proposed_tag TEXT,
    llm_confidence TEXT,  -- 'high' | 'medium' | 'low'
    llm_reasoning TEXT,
    resolved_at TEXT,
    UNIQUE (question_type, use_case_id, consolidated_use_case_id)
);
CREATE INDEX idx_rqs_question ON review_queue_scope(question_type);
CREATE INDEX idx_rqs_confidence ON review_queue_scope(llm_confidence);
CREATE TABLE review_queue_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                use_case_id INTEGER REFERENCES use_cases(id),
                consolidated_use_case_id INTEGER REFERENCES consolidated_use_cases(id),
                source_text TEXT,
                heuristic_product_ids TEXT,  -- JSON array of product IDs resolved heuristically
                reason TEXT,                  -- 'compound_string' | 'unmatched_vendor_text'
                llm_reviewed INTEGER DEFAULT 0,
                llm_proposed_product_ids TEXT,
                llm_confidence TEXT,
                llm_reasoning TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
CREATE INDEX idx_rqp_use_case ON review_queue_products(use_case_id);
CREATE TABLE use_case_external_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    use_case_id INTEGER REFERENCES use_cases(id),
    consolidated_use_case_id INTEGER REFERENCES consolidated_use_cases(id),
    topic TEXT NOT NULL,
    status TEXT NOT NULL,
    source_url TEXT,
    source_quote TEXT,
    confidence TEXT,
    search_method TEXT,
    captured_at TEXT NOT NULL,
    captured_by TEXT NOT NULL,
    notes TEXT,
    CHECK ((use_case_id IS NOT NULL) <> (consolidated_use_case_id IS NOT NULL)),
    CHECK (status IN ('corroborated','searched_no_source','inventory_only')),
    CHECK (status != 'corroborated' OR source_url IS NOT NULL OR source_quote IS NOT NULL)
);
CREATE INDEX idx_evidence_use_case ON use_case_external_evidence(use_case_id);
CREATE INDEX idx_evidence_consolidated ON use_case_external_evidence(consolidated_use_case_id);
CREATE INDEX idx_evidence_topic ON use_case_external_evidence(topic);
CREATE INDEX idx_evidence_status ON use_case_external_evidence(status);
CREATE TABLE fedramp_products (
    fedramp_id TEXT PRIMARY KEY,
    csp TEXT NOT NULL,
    csp_slug TEXT NOT NULL,
    cso TEXT NOT NULL,
    status TEXT NOT NULL,
    authorization_count INTEGER,
    reuse_count INTEGER,
    ready_date TEXT, ready_status TEXT,
    ip_jab_date TEXT, ip_jab_status TEXT,
    ip_prog_date TEXT, ip_prog_status TEXT,
    ip_prog_date2 TEXT,
    ip_agency_date TEXT, ip_agency_status TEXT,
    ip_pmo_date TEXT, ip_pmo_status TEXT,
    auth_date TEXT, auth_type TEXT,
    partnering_agency TEXT,
    annual_assessment_date TEXT,
    independent_assessor TEXT,
    assessor_id INTEGER,
    deployment_model TEXT,
    impact_level TEXT,
    impact_level_number INTEGER,
    service_desc TEXT,
    fedramp_msg TEXT,
    sales_email TEXT, security_email TEXT,
    website TEXT, uei TEXT,
    small_business INTEGER,
    logo TEXT,
    filter_classes TEXT, auth_category TEXT
);
CREATE INDEX idx_fp_csp ON fedramp_products(csp_slug);
CREATE INDEX idx_fp_status ON fedramp_products(status);
CREATE INDEX idx_fp_impact ON fedramp_products(impact_level);
CREATE INDEX idx_fp_assessor ON fedramp_products(assessor_id);
CREATE TABLE fedramp_authorizations (
    id INTEGER PRIMARY KEY,
    fedramp_id TEXT NOT NULL,
    agency_id INTEGER,
    sub_agency TEXT,
    ato_type TEXT,
    ato_issuance_date TEXT,
    fedramp_authorization_date TEXT,
    ato_expiration_date TEXT,
    annual_assessment_date TEXT
);
CREATE INDEX idx_fa_product ON fedramp_authorizations(fedramp_id);
CREATE INDEX idx_fa_agency  ON fedramp_authorizations(agency_id);
CREATE INDEX idx_fa_date    ON fedramp_authorizations(ato_issuance_date);
CREATE TABLE fedramp_agencies (
    id INTEGER PRIMARY KEY,
    parent_agency TEXT NOT NULL UNIQUE,
    parent_slug TEXT NOT NULL UNIQUE
);
CREATE INDEX idx_fag_slug ON fedramp_agencies(parent_slug);
CREATE TABLE fedramp_assessors (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
);
CREATE INDEX idx_fas_slug ON fedramp_assessors(slug);
CREATE TABLE fedramp_snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    snapshot_date TEXT,
    product_count INTEGER,
    ato_event_count INTEGER,
    agency_count INTEGER,
    csp_count INTEGER,
    assessor_count INTEGER,
    built_at TEXT
);
CREATE TABLE fedramp_product_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_product_id INTEGER NOT NULL REFERENCES products(id),
    fedramp_id TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('strong', 'weak', 'manual')),
    source TEXT NOT NULL,  -- 'alias_match' | 'manual_csv' | 'llm'
    score REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(inventory_product_id, fedramp_id, source)
);
CREATE INDEX idx_fpl_inv ON fedramp_product_links(inventory_product_id);
CREATE INDEX idx_fpl_fr  ON fedramp_product_links(fedramp_id);
CREATE TABLE fedramp_agency_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_agency_id INTEGER NOT NULL REFERENCES agencies(id),
    fedramp_agency_id INTEGER NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('strong', 'weak', 'manual')),
    source TEXT NOT NULL,
    score REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(inventory_agency_id, fedramp_agency_id, source)
);
CREATE INDEX idx_fal_inv ON fedramp_agency_links(inventory_agency_id);
CREATE INDEX idx_fal_fr  ON fedramp_agency_links(fedramp_agency_id);
CREATE TABLE fedramp_link_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_kind TEXT NOT NULL CHECK (link_kind IN ('product', 'agency')),
    inventory_id INTEGER NOT NULL,
    source_text TEXT,
    candidate_fedramp_ids TEXT,   -- JSON array of fedramp ids/scores
    reason TEXT NOT NULL,         -- 'multi_candidate' | 'no_alias' | 'ambiguous'
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'resolved' | 'rejected'
    decision_notes TEXT,
    llm_proposed_fedramp_ids TEXT,
    llm_reasoning TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
);
CREATE INDEX idx_flq_status ON fedramp_link_queue(status);
CREATE INDEX idx_flq_kind   ON fedramp_link_queue(link_kind);
CREATE INDEX idx_flq_inv    ON fedramp_link_queue(inventory_id);
CREATE TABLE federal_organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    short_name TEXT,
    abbreviation TEXT,
    slug TEXT NOT NULL UNIQUE,
    parent_id INTEGER REFERENCES federal_organizations(id),
    level TEXT NOT NULL
        CHECK (level IN ('department','independent','sub_agency','office','component')),
    hierarchy_path TEXT,
    depth INTEGER NOT NULL DEFAULT 0,
    sam_org_id TEXT,
    cgac_code TEXT,
    agency_code TEXT,
    is_cfo_act_agency INTEGER NOT NULL DEFAULT 0,
    is_cabinet_department INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    description TEXT,
    website TEXT,
    legacy_agency_id INTEGER REFERENCES agencies(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_fed_org_parent ON federal_organizations(parent_id);
CREATE INDEX idx_fed_org_level ON federal_organizations(level);
CREATE INDEX idx_fed_org_abbreviation ON federal_organizations(abbreviation);
CREATE INDEX idx_fed_org_hierarchy_path ON federal_organizations(hierarchy_path);
CREATE INDEX idx_fed_org_cfo_act ON federal_organizations(is_cfo_act_agency);
CREATE INDEX idx_fed_org_legacy ON federal_organizations(legacy_agency_id);
CREATE INDEX idx_use_cases_org ON use_cases(organization_id);
CREATE INDEX idx_use_cases_bureau_org ON use_cases(bureau_organization_id);
CREATE INDEX idx_consolidated_org ON consolidated_use_cases(organization_id);
CREATE INDEX idx_consolidated_bureau_org ON consolidated_use_cases(bureau_organization_id);
CREATE INDEX idx_maturity_org ON agency_ai_maturity(organization_id);
CREATE TABLE org_ai_maturity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL UNIQUE REFERENCES federal_organizations(id),
    total_use_cases INTEGER,
    distinct_products_deployed INTEGER,
    generative_ai_count INTEGER,
    coding_tool_count INTEGER,
    general_llm_count INTEGER,
    classical_ml_count INTEGER,
    agentic_ai_count INTEGER,
    custom_system_count INTEGER,
    has_enterprise_llm INTEGER,
    has_coding_assistants INTEGER,
    has_agentic_ai INTEGER,
    has_custom_ai INTEGER,
    pct_deployed REAL,
    pct_high_impact REAL,
    pct_with_risk_docs REAL,
    maturity_tier TEXT,
    notes TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_org_maturity_tier ON org_ai_maturity(maturity_tier);
CREATE INDEX idx_rqp_consolidated ON review_queue_products(consolidated_use_case_id);
CREATE TABLE schema_migrations (
            migration_id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
CREATE VIEW inventory_entries AS
SELECT
    'use_case' AS entry_kind,
    id AS entry_id,
    agency_id,
    organization_id,
    bureau_organization_id,
    NULL AS template_id,
    slug,
    use_case_name AS title,
    source_file,
    0 AS is_consolidated
FROM use_cases
UNION ALL
SELECT
    'consolidated' AS entry_kind,
    id AS entry_id,
    agency_id,
    organization_id,
    bureau_organization_id,
    template_id,
    slug,
    ai_use_case AS title,
    source_file,
    1 AS is_consolidated
FROM consolidated_use_cases
/* inventory_entries(entry_kind,entry_id,agency_id,organization_id,bureau_organization_id,template_id,slug,title,source_file,is_consolidated) */;
CREATE TABLE fedramp_link_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL REFERENCES fedramp_product_links(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,         -- 'vendor_announcement' | 'platform_doc' | 'press_release' | 'gov_announcement' | 'compliance_page' | 'analyst_note'
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    publisher TEXT,                    -- e.g., 'Anthropic', 'Microsoft Tech Community', 'AWS Public Sector Blog', 'GSA'
    publication_date TEXT,             -- ISO date string when known
    excerpt TEXT,                      -- short quote justifying the link (<=400 chars)
    accessed_at TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_fle_link ON fedramp_link_evidence(link_id);
CREATE INDEX idx_fle_source_type ON fedramp_link_evidence(source_type);
CREATE INDEX idx_cuc_source_format ON consolidated_use_cases(source_format);
CREATE TABLE fedramp_leveraged_systems (
    fedramp_id  TEXT NOT NULL,
    system_name TEXT NOT NULL
);
CREATE INDEX idx_fls_fedramp_id ON fedramp_leveraged_systems(fedramp_id);
CREATE INDEX idx_fls_system_name ON fedramp_leveraged_systems(system_name);
CREATE TABLE omb_consolidated_rows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ingest_source_file TEXT NOT NULL,
                ingest_run_at TEXT NOT NULL,
                row_hash TEXT NOT NULL,
                row_index_in_file INTEGER NOT NULL,
                agency_abbreviation TEXT,
                agency_name TEXT,
                use_case_id_omb TEXT,
                use_case_name TEXT,
                bureau_component TEXT,
                email_address TEXT,
                is_withheld TEXT,
                stage_of_development TEXT,
                is_high_impact TEXT,
                hi_justification TEXT,
                topic_area TEXT,
                ai_classification TEXT,
                problem_statement TEXT,
                expected_benefits TEXT,
                system_outputs TEXT,
                operational_date TEXT,
                contracting_usage TEXT,
                vendor_name TEXT,
                have_ato TEXT,
                system_name_ato TEXT,
                training_data_description TEXT,
                link_to_data TEXT,
                has_pii TEXT,
                pia_url TEXT,
                demographic_features TEXT,
                has_custom_code TEXT,
                code_url TEXT,
                hi_testing_conducted TEXT,
                hi_assessment_completed TEXT,
                hi_potential_impacts TEXT,
                hi_independent_review TEXT,
                hi_ongoing_monitoring TEXT,
                hi_training_established TEXT,
                hi_failsafe_presence TEXT,
                hi_appeal_process TEXT,
                hi_public_consultation TEXT,
                raw_json TEXT NOT NULL
            );
CREATE UNIQUE INDEX uq_omb_rows_file_idx ON omb_consolidated_rows(ingest_source_file, row_index_in_file);
CREATE INDEX idx_omb_rows_agency ON omb_consolidated_rows(agency_abbreviation);
CREATE INDEX idx_omb_rows_name ON omb_consolidated_rows(use_case_name);
CREATE TABLE omb_match_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ingest_run_at TEXT NOT NULL,
                omb_row_id INTEGER REFERENCES omb_consolidated_rows(id),
                use_case_id_db INTEGER REFERENCES use_cases(id),
                agency_abbreviation TEXT,
                use_case_name TEXT,
                match_method TEXT,
                match_score REAL,
                match_status TEXT NOT NULL,
                drift_fields_json TEXT,
                first_seen TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                resolved_at TEXT,
                resolution_note TEXT
            , consolidated_into_omb_id INTEGER);
CREATE INDEX idx_omb_audit_status ON omb_match_audit(match_status);
CREATE INDEX idx_omb_audit_agency ON omb_match_audit(agency_abbreviation);
CREATE INDEX idx_omb_audit_db ON omb_match_audit(use_case_id_db);
CREATE INDEX idx_omb_audit_omb ON omb_match_audit(omb_row_id);
CREATE TABLE fedramp_business_functions (
    fedramp_id TEXT NOT NULL,
    function   TEXT NOT NULL
);
CREATE INDEX idx_fbf_fedramp_id ON fedramp_business_functions(fedramp_id);
CREATE INDEX idx_fbf_function   ON fedramp_business_functions(function);
CREATE TABLE fedramp_service_models (
    fedramp_id TEXT NOT NULL,
    model      TEXT NOT NULL
);
CREATE INDEX idx_fsm_fedramp_id ON fedramp_service_models(fedramp_id);
CREATE INDEX idx_fsm_model      ON fedramp_service_models(model);
CREATE INDEX idx_omb_match_audit_consolidated ON omb_match_audit(consolidated_into_omb_id);
CREATE TABLE agency_readiness (
            agency_id INTEGER PRIMARY KEY REFERENCES agencies(id),
            internal_capacity REAL,
            frontier_capability REAL,
            procurement_hygiene REAL,
            risk_relevant_governance REAL,
            adoption_breadth REAL,
            composite_score REAL,
            tier TEXT,
            tier_label TEXT,
            rank INTEGER,
            headline_inputs_json TEXT,
            computed_at TEXT NOT NULL
        );
CREATE INDEX idx_agency_readiness_rank ON agency_readiness(rank);
CREATE TABLE agency_ai_access_evidence (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agency_id INTEGER REFERENCES agencies(id),
                agency_abbreviation TEXT NOT NULL,
                tool_name TEXT,
                finding TEXT NOT NULL,
                estimated_users TEXT,
                coverage_assessment TEXT,   -- all | most | partial | pilot | unknown | none
                exact_quote TEXT,           -- verbatim; NULL when no source
                source_url TEXT,            -- NULL when no source
                source_title TEXT,
                source_date TEXT,
                source_type TEXT,           -- official | press | inventory_field | none
                confidence TEXT,            -- high | medium | low
                status TEXT NOT NULL,       -- corroborated | searched_no_source
                notes TEXT,
                captured_at TEXT NOT NULL,
                captured_by TEXT
            , estimated_share_of_eligible REAL, share_rationale TEXT, matrix_product_key TEXT);
CREATE INDEX idx_ai_access_evidence_agency ON agency_ai_access_evidence(agency_abbreviation);
CREATE TABLE use_cases_2024 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agency_id INTEGER NOT NULL REFERENCES agencies(id),
                source_file TEXT NOT NULL,
                slug TEXT UNIQUE,
                use_case_name TEXT,
                agency TEXT,
                agency_abbreviation TEXT,
                bureau TEXT,
                topic_area TEXT,
                topic_area_other TEXT,
                commercial_ai TEXT,
                purpose_benefits TEXT,
                outputs TEXT,
                dev_stage TEXT,
                impact_type TEXT,
                date_initiated TEXT,
                date_acq_dev_began TEXT,
                date_implemented TEXT,
                date_retired TEXT,
                dev_method TEXT,
                contract_piids TEXT,
                hisp_support TEXT,
                hisp_name TEXT,
                public_service TEXT,
                public_info TEXT,
                iqa_compliance TEXT,
                contains_pii TEXT,
                saop_review TEXT,
                data_catalog TEXT,
                data_catalog_other TEXT,
                agency_data TEXT,
                data_docs TEXT,
                demo_features TEXT,
                demo_features_other TEXT,
                custom_code TEXT,
                code_access TEXT,
                code_link TEXT,
                has_ato TEXT,
                system_name TEXT,
                dev_tools_wait TEXT,
                infra_provisioned TEXT,
                infra_provisioned_other TEXT,
                compute_request TEXT,
                compute_request_other TEXT,
                timely_resources TEXT,
                timely_resources_other TEXT,
                existing_reuse TEXT,
                internal_review TEXT,
                extension_request TEXT,
                impact_assessment TEXT,
                real_world_testing TEXT,
                key_risks TEXT,
                independent_eval TEXT,
                monitor_postdeploy TEXT,
                autonomous_impact TEXT,
                autonomous_impact_other TEXT,
                ai_notice TEXT,
                ai_notice_other TEXT,
                adverse_impact TEXT,
                disparity_mitigation TEXT,
                stakeholder_consult TEXT,
                stakeholder_consult_other TEXT,
                appeal_process TEXT,
                no_appeal_reason TEXT,
                opt_out TEXT,
                opt_out_other TEXT,
                raw_json TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
CREATE INDEX idx_use_cases_2024_agency ON use_cases_2024(agency_id);
CREATE TABLE year_comparison (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                dimension     TEXT NOT NULL,
                bucket        TEXT,
                agency_id     INTEGER REFERENCES agencies(id),
                count_2024    INTEGER NOT NULL DEFAULT 0,
                count_2025    INTEGER NOT NULL DEFAULT 0,
                delta         INTEGER NOT NULL DEFAULT 0,
                pct_change    REAL,
                comparability TEXT NOT NULL,
                notes         TEXT,
                computed_at   TEXT DEFAULT (datetime('now'))
            );
CREATE INDEX idx_year_comparison_dimension ON year_comparison(dimension);
CREATE TABLE use_case_year_links (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                run_at              TEXT NOT NULL,
                uc_2024_id          INTEGER REFERENCES use_cases_2024(id),
                uc_2025_id          INTEGER REFERENCES use_cases(id),
                agency_id           INTEGER REFERENCES agencies(id),
                agency_abbreviation TEXT,
                match_method        TEXT,
                match_score         REAL,
                lineage_status      TEXT NOT NULL,
                drift_fields_json   TEXT,
                llm_reasoning       TEXT,
                first_seen          TEXT NOT NULL,
                last_seen           TEXT NOT NULL,
                resolved_at         TEXT,
                resolution_note     TEXT
            );
CREATE INDEX idx_ucyl_2024 ON use_case_year_links(uc_2024_id);
CREATE INDEX idx_ucyl_2025 ON use_case_year_links(uc_2025_id);
CREATE INDEX idx_ucyl_agency ON use_case_year_links(agency_id);
CREATE INDEX idx_ucyl_status ON use_case_year_links(lineage_status);
CREATE TABLE agency_ai_policy_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agency_abbr TEXT NOT NULL,
                agency_name TEXT NOT NULL,
                agency_type TEXT NOT NULL,
                issuing_office TEXT,
                document_type TEXT NOT NULL,
                document_title TEXT NOT NULL,
                publication_year INTEGER NOT NULL,
                publication_date TEXT,
                pages INTEGER,
                issuing_memo TEXT,
                superseded INTEGER NOT NULL DEFAULT 0,
                is_public INTEGER NOT NULL DEFAULT 1,
                url TEXT NOT NULL,
                local_path TEXT,
                access_status TEXT NOT NULL,
                date_accessed TEXT NOT NULL,
                notes TEXT
            );
CREATE INDEX idx_agency_ai_policy_documents_agency_abbr ON agency_ai_policy_documents (agency_abbr);
CREATE INDEX idx_agency_ai_policy_documents_agency_type ON agency_ai_policy_documents (agency_type);
CREATE INDEX idx_agency_ai_policy_documents_document_type ON agency_ai_policy_documents (document_type);
CREATE INDEX idx_agency_ai_policy_documents_publication_year ON agency_ai_policy_documents (publication_year);
CREATE TABLE agency_ai_policy_compliance (
                agency_abbr TEXT PRIMARY KEY,
                agency_name TEXT NOT NULL,
                agency_type TEXT NOT NULL,
                searched INTEGER NOT NULL DEFAULT 1,
                date_searched TEXT NOT NULL,
                ai_landing_page_url TEXT,
                ai_strategy_year INTEGER,
                compliance_plan_year INTEGER,
                genai_policy_year INTEGER,
                caio_status TEXT,
                other_policy_count INTEGER NOT NULL DEFAULT 0,
                total_documents INTEGER NOT NULL DEFAULT 0,
                gaps TEXT,
                notes TEXT
            );
CREATE TABLE agency_workforce_profile (
                organization_id        INTEGER PRIMARY KEY
                                       REFERENCES federal_organizations(id),
                agency_id              INTEGER REFERENCES agencies(id),
                level                  TEXT NOT NULL,
                total_headcount        INTEGER,
                headcount_as_of        TEXT,
                headcount_source_url   TEXT,
                headcount_source_title TEXT,
                headcount_quote        TEXT,
                ai_eligible_share      REAL,
                ai_eligible_rationale  TEXT,
                ai_eligible_source_url TEXT,
                confidence             TEXT,
                wave                   TEXT,
                tagged_by_agent        TEXT,
                notes                  TEXT,
                captured_at            TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at             TEXT
            , contractor_headcount INTEGER, denominator_basis TEXT);
CREATE INDEX idx_awp_agency ON agency_workforce_profile(agency_id);
CREATE INDEX idx_awp_level ON agency_workforce_profile(level);
CREATE TABLE use_case_tags_2024 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                use_case_id_2024 INTEGER NOT NULL REFERENCES use_cases_2024(id),

                -- What the entry represents
                entry_type TEXT,
                is_product_capability_entry INTEGER DEFAULT 0,
                product_capability TEXT,

                -- Tool categorization
                is_general_llm_access INTEGER,
                is_coding_tool INTEGER,
                is_cots_commercial INTEGER,
                tool_product_name TEXT,
                tool_vendor TEXT,

                -- Sophistication
                ai_sophistication TEXT,
                is_generative_ai INTEGER,
                is_frontier_model INTEGER,

                -- Deployment scope
                deployment_scope TEXT,
                scope_detail TEXT,
                is_enterprise_wide INTEGER,
                estimated_user_count TEXT,

                -- Architecture
                architecture_type TEXT,
                has_model_training INTEGER,

                -- Product detail
                cots_product_name TEXT,
                cots_vendor TEXT,
                is_microsoft_copilot INTEGER,
                is_openai INTEGER,
                is_anthropic INTEGER,
                is_google INTEGER,
                is_github_copilot INTEGER,
                is_aws_ai INTEGER,

                -- Mission characterization
                use_type TEXT,
                is_public_facing INTEGER,

                -- Governance
                has_meaningful_risk_docs INTEGER,
                high_impact_designation TEXT,
                deployment_environment TEXT,
                has_ato_or_fedramp INTEGER,

                -- Provenance (new for the 2024 multi-wave backfill)
                wave TEXT NOT NULL,
                tagged_by_agent TEXT,
                reasoning TEXT,
                quality_flags_json TEXT,
                confidence TEXT,

                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT,

                UNIQUE (use_case_id_2024, wave, tagged_by_agent)
            );
CREATE INDEX idx_uct2024_use_case ON use_case_tags_2024(use_case_id_2024);
CREATE INDEX idx_uct2024_wave ON use_case_tags_2024(wave);
CREATE INDEX idx_uct2024_is_gen_ai ON use_case_tags_2024(is_generative_ai);
CREATE INDEX idx_uct2024_scope ON use_case_tags_2024(deployment_scope);
CREATE INDEX idx_uct2024_entry_type ON use_case_tags_2024(entry_type);
CREATE INDEX idx_uct2024_uc_wave ON use_case_tags_2024(use_case_id_2024, wave);
CREATE VIEW use_case_tags_2024_canonical AS
        WITH ranked AS (
            SELECT
                t.*,
                CASE wave
                    WHEN '3'  THEN 3
                    WHEN '2a' THEN 2
                    WHEN '2b' THEN 2
                    WHEN '1'  THEN 1
                    ELSE 0
                END AS wave_rank
            FROM use_case_tags_2024 t
            WHERE wave IN ('1', '2a', '2b', '3')
        ),
        best AS (
            SELECT use_case_id_2024, MAX(wave_rank) AS max_rank
            FROM ranked
            GROUP BY use_case_id_2024
        )
        SELECT r.*
        FROM ranked r
        JOIN best b
          ON b.use_case_id_2024 = r.use_case_id_2024
         AND b.max_rank = r.wave_rank
/* use_case_tags_2024_canonical(id,use_case_id_2024,entry_type,is_product_capability_entry,product_capability,is_general_llm_access,is_coding_tool,is_cots_commercial,tool_product_name,tool_vendor,ai_sophistication,is_generative_ai,is_frontier_model,deployment_scope,scope_detail,is_enterprise_wide,estimated_user_count,architecture_type,has_model_training,cots_product_name,cots_vendor,is_microsoft_copilot,is_openai,is_anthropic,is_google,is_github_copilot,is_aws_ai,use_type,is_public_facing,has_meaningful_risk_docs,high_impact_designation,deployment_environment,has_ato_or_fedramp,wave,tagged_by_agent,reasoning,quality_flags_json,confidence,created_at,updated_at,wave_rank) */;
CREATE TABLE IF NOT EXISTS "use_case_products" (
    use_case_id INTEGER NOT NULL
        REFERENCES use_cases(id) ON DELETE CASCADE ON UPDATE CASCADE,
    product_id INTEGER NOT NULL
        REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    evidence_text TEXT,
    confidence TEXT CHECK(confidence IN ('strong', 'inferred')),
    PRIMARY KEY (use_case_id, product_id)
);
CREATE INDEX idx_ucp_use_case ON use_case_products(use_case_id);
CREATE INDEX idx_ucp_product ON use_case_products(product_id);
CREATE TABLE IF NOT EXISTS "consolidated_use_case_products" (
    consolidated_use_case_id INTEGER NOT NULL
        REFERENCES consolidated_use_cases(id) ON DELETE CASCADE ON UPDATE CASCADE,
    product_id INTEGER NOT NULL
        REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    evidence_text TEXT,
    confidence TEXT CHECK(confidence IN ('strong', 'inferred')),
    PRIMARY KEY (consolidated_use_case_id, product_id)
);
CREATE INDEX idx_cucp_cuc ON consolidated_use_case_products(consolidated_use_case_id);
CREATE INDEX idx_cucp_product ON consolidated_use_case_products(product_id);
CREATE VIEW entry_product_edges AS
SELECT
    'use_case' AS entry_kind,
    ucp.use_case_id AS entry_id,
    uc.agency_id,
    uc.organization_id,
    uc.bureau_organization_id,
    ucp.product_id,
    ucp.evidence_text,
    ucp.confidence
FROM use_case_products ucp
JOIN use_cases uc ON uc.id = ucp.use_case_id
UNION ALL
SELECT
    'consolidated' AS entry_kind,
    cucp.consolidated_use_case_id AS entry_id,
    c.agency_id,
    c.organization_id,
    c.bureau_organization_id,
    cucp.product_id,
    cucp.evidence_text,
    cucp.confidence
FROM consolidated_use_case_products cucp
JOIN consolidated_use_cases c ON c.id = cucp.consolidated_use_case_id
/* entry_product_edges(entry_kind,entry_id,agency_id,organization_id,bureau_organization_id,product_id,evidence_text,confidence) */;
CREATE VIEW agency_rollups AS
SELECT
    a.id AS agency_id,
    COUNT(DISTINCT CASE WHEN ie.entry_kind = 'use_case' THEN ie.entry_id END) AS total_use_cases,
    COUNT(DISTINCT CASE WHEN ie.entry_kind = 'consolidated' THEN ie.entry_id END) AS total_consolidated_entries,
    COUNT(DISTINCT epe.product_id) AS distinct_products_deployed,
    COUNT(epe.product_id) AS product_edge_count
FROM agencies a
LEFT JOIN inventory_entries ie ON ie.agency_id = a.id
LEFT JOIN entry_product_edges epe
  ON epe.agency_id = a.id
 AND epe.entry_kind = ie.entry_kind
 AND epe.entry_id = ie.entry_id
GROUP BY a.id
/* agency_rollups(agency_id,total_use_cases,total_consolidated_entries,distinct_products_deployed,product_edge_count) */;
CREATE INDEX idx_use_cases_stage_norm ON use_cases(stage_normalized);
CREATE INDEX idx_use_cases_ai_class_norm ON use_cases(ai_classification_normalized);
CREATE TABLE enterprise_genai_tier_rollup (
                   year INTEGER NOT NULL,
                   tier TEXT NOT NULL CHECK (tier IN
                       ('permission','embedded_cots','tenanted','operated_build')),
                   n INTEGER NOT NULL,
                   PRIMARY KEY (year, tier)
               );
CREATE TABLE fedramp_ai_classification (
    fedramp_id    TEXT PRIMARY KEY,
    category      TEXT NOT NULL CHECK (category IN ('core_ai','ai_featured','not_ai')),
    confidence    TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
    reasoning     TEXT NOT NULL,
    signals       TEXT,
    model         TEXT NOT NULL,
    input_hash    TEXT NOT NULL,
    classified_at TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'llm'
                  CHECK (source IN ('llm','manual_override'))
);
CREATE INDEX idx_fac_category
    ON fedramp_ai_classification(category);
CREATE TABLE fedramp_authorized_services (
    fedramp_id TEXT NOT NULL,
    service    TEXT NOT NULL,
    recency    TEXT NOT NULL
);
CREATE INDEX idx_fauthsvc_fedramp_id ON fedramp_authorized_services(fedramp_id);
CREATE INDEX idx_fauthsvc_service    ON fedramp_authorized_services(service);
CREATE TABLE fedramp_ai_service_classification (
    service       TEXT PRIMARY KEY,
    category      TEXT NOT NULL CHECK (category IN ('core_ai','ai_featured','not_ai')),
    confidence    TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
    reasoning     TEXT NOT NULL,
    signals       TEXT,
    model         TEXT NOT NULL,
    input_hash    TEXT NOT NULL,
    classified_at TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'llm'
                  CHECK (source IN ('llm','qc_confirmed','qc_corrected',
                                    'adjudicated','manual_override'))
);
CREATE INDEX idx_fasc_category
    ON fedramp_ai_service_classification(category);
CREATE TABLE consolidated_band_labels (
                consolidated_use_case_id INTEGER PRIMARY KEY
                    REFERENCES consolidated_use_cases(id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                slug          TEXT NOT NULL UNIQUE,
                unit_counted  TEXT NOT NULL CHECK(unit_counted IN
                    ('employees','employees_and_contractors',
                     'devices_endpoints','public_users',
                     'applicants_cases','unknown')),
                population    TEXT NOT NULL,
                org_scope     TEXT NOT NULL CHECK(org_scope IN
                    ('enterprise','component','unknown')),
                stratum       TEXT NOT NULL CHECK(stratum IN
                    ('general','technical','legal','investigative',
                     'comms','clinical','excluded_not_seats')),
                confidence    TEXT NOT NULL CHECK(confidence IN
                    ('high','medium','low')),
                reasoning     TEXT,
                labeler       TEXT NOT NULL,
                audited       INTEGER NOT NULL DEFAULT 0,
                audit_verdict TEXT CHECK(audit_verdict IN
                    ('agree','override','escalated')
                    OR audit_verdict IS NULL),
                audit_reasoning TEXT,
                captured_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );
CREATE INDEX idx_cbl_stratum ON consolidated_band_labels(stratum);
CREATE INDEX idx_cbl_unit ON consolidated_band_labels(unit_counted);
CREATE TABLE agency_occupation_counts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agency_id         INTEGER REFERENCES agencies(id),
                organization_slug TEXT NOT NULL,
                occ_series        TEXT NOT NULL,
                occ_label         TEXT NOT NULL,
                stratum           TEXT NOT NULL CHECK(stratum IN
                    ('general','technical','legal','investigative',
                     'comms','clinical')),
                headcount         INTEGER NOT NULL,
                as_of             TEXT NOT NULL,
                source_url        TEXT NOT NULL,
                source_title      TEXT,
                notes             TEXT,
                captured_at       TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(organization_slug, occ_series, as_of)
            );
CREATE INDEX idx_aoc_agency ON agency_occupation_counts(agency_id);
CREATE TABLE readiness_headline (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    rubric_version TEXT NOT NULL,
    internal_build_pct REAL NOT NULL,
    purchased_pct REAL NOT NULL,
    unreported_pct REAL NOT NULL,
    production_rate_pct REAL NOT NULL,
    production_rate_all_pct REAL NOT NULL,
    fedramp_linked_pct REAL NOT NULL,
    fedramp_floor_pct REAL NOT NULL,
    frontier_ready_agency_count INTEGER NOT NULL,
    total_agencies_scored INTEGER NOT NULL,
    total_units INTEGER NOT NULL,
    total_use_cases INTEGER NOT NULL,
    hi_no_risk_docs_pct REAL NOT NULL,
    hi_no_risk_docs_high_impact_pct REAL NOT NULL,
    fedramp_link_row_count INTEGER NOT NULL DEFAULT 0,
    computed_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_use_case_tags_uc_unique ON use_case_tags(use_case_id) WHERE use_case_id IS NOT NULL;

-- m020: primary-product view (cache-order equivalent: strong before
-- inferred, then lowest product_id, one row per entry).
CREATE VIEW entry_primary_products AS
SELECT entry_kind, entry_id, product_id, product_name FROM (
    SELECT 'use_case' AS entry_kind, ucp.use_case_id AS entry_id,
           ucp.product_id, p.canonical_name AS product_name,
           ROW_NUMBER() OVER (PARTITION BY ucp.use_case_id
             ORDER BY CASE ucp.confidence WHEN 'strong' THEN 0 ELSE 1 END,
                      ucp.product_id) AS rn
    FROM use_case_products ucp JOIN products p ON p.id = ucp.product_id
) WHERE rn = 1
UNION ALL
SELECT entry_kind, entry_id, product_id, product_name FROM (
    SELECT 'consolidated' AS entry_kind, cucp.consolidated_use_case_id AS entry_id,
           cucp.product_id, p.canonical_name AS product_name,
           ROW_NUMBER() OVER (PARTITION BY cucp.consolidated_use_case_id
             ORDER BY CASE cucp.confidence WHEN 'strong' THEN 0 ELSE 1 END,
                      cucp.product_id) AS rn
    FROM consolidated_use_case_products cucp JOIN products p ON p.id = cucp.product_id
) WHERE rn = 1;

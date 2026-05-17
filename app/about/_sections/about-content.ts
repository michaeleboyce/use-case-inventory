/**
 * Static explanatory content for the About/Colophon route.
 */

export type SchemaField = {
  key: string;
  label: string;
  description: string;
  values?: string[];
};

export const TAG_SCHEMA: Array<{
  section: string;
  fields: SchemaField[];
}> = [
  {
    section: "Entry shape",
    fields: [
      {
        key: "entry_type",
        label: "entry_type",
        description:
          "Structural shape of the inventory entry. Distinguishes custom-built systems from deployments of vendor products from generic use patterns.",
        values: [
          "custom_system",
          "product_deployment",
          "bespoke_application",
          "generic_use_pattern",
          "product_feature",
        ],
      },
      {
        key: "is_product_capability_entry",
        label: "is_product_capability_entry",
        description:
          "Flag: this entry describes a capability of a commercial product (e.g. 'Copilot for Word') rather than a distinct agency system.",
      },
      {
        key: "product_capability",
        label: "product_capability",
        description:
          "Named capability inside a product when the entry is a product-capability entry.",
      },
    ],
  },
  {
    section: "AI sophistication",
    fields: [
      {
        key: "ai_sophistication",
        label: "ai_sophistication",
        description:
          "High-level classification of what kind of AI is involved. Informs the Analytics donuts and comparison grids.",
        values: [
          "general_llm",
          "coding_assistant",
          "agentic",
          "classical_ml",
          "computer_vision",
          "nlp",
          "predictive_analytics",
        ],
      },
      {
        key: "is_generative_ai",
        label: "is_generative_ai",
        description: "Flag: the system is a generative-AI system.",
      },
      {
        key: "is_frontier_model",
        label: "is_frontier_model",
        description:
          "Flag: uses a frontier LLM (GPT-4, Claude 3+, Gemini 1.5+, etc.).",
      },
    ],
  },
  {
    section: "Deployment scope",
    fields: [
      {
        key: "deployment_scope",
        label: "deployment_scope",
        description: "Scope at which the system is deployed.",
        values: [
          "enterprise_wide",
          "department",
          "bureau",
          "office",
          "team",
          "pilot",
        ],
      },
      {
        key: "is_enterprise_wide",
        label: "is_enterprise_wide",
        description: "Derived flag: true when the system is available agency-wide.",
      },
      {
        key: "estimated_user_count",
        label: "estimated_user_count",
        description: "Free-text headcount when reported.",
      },
    ],
  },
  {
    section: "Implementation",
    fields: [
      {
        key: "architecture_type",
        label: "architecture_type",
        description: "Implementation pattern.",
        values: [
          "inference_only",
          "rag_pipeline",
          "fine_tuned",
          "custom_trained",
          "agentic_workflow",
        ],
      },
      {
        key: "has_model_training",
        label: "has_model_training",
        description:
          "Flag: the agency trains or fine-tunes a model in-house (as opposed to pure inference on a vendor-hosted model).",
      },
    ],
  },
  {
    section: "Vendor / tool identification",
    fields: [
      {
        key: "tool_product_name",
        label: "tool_product_name / tool_vendor",
        description:
          "Parsed product + vendor names extracted from free-text narrative fields.",
      },
      {
        key: "vendor_family_flags",
        label: "is_microsoft_copilot / is_openai / …",
        description:
          "Vendor family flags. Used by the Analytics vendor-share and LLM-provider charts.",
      },
    ],
  },
  {
    section: "Use context",
    fields: [
      {
        key: "use_type",
        label: "use_type",
        description: "Functional area of the use case.",
        values: [
          "mission",
          "administrative",
          "it_operations",
          "cybersecurity",
          "research",
        ],
      },
      {
        key: "is_public_facing",
        label: "is_public_facing",
        description: "Flag: the system interacts with the public, not only employees.",
      },
    ],
  },
  {
    section: "Risk & documentation",
    fields: [
      {
        key: "has_meaningful_risk_docs",
        label: "has_meaningful_risk_docs",
        description:
          "Flag: the M-25-21 risk-management fields contain substantive content, not boilerplate.",
      },
      {
        key: "high_impact_designation",
        label: "high_impact_designation",
        description: "M-25-21 high-impact classification (if designated).",
      },
      {
        key: "deployment_environment",
        label: "deployment_environment",
        description: "Cloud / on-premises / hybrid if parseable from source text.",
      },
      {
        key: "has_ato_or_fedramp",
        label: "has_ato_or_fedramp",
        description: "Flag: has an Authority to Operate or a FedRAMP authorization.",
      },
    ],
  },
];

export const DATA_QUALITY_ISSUES: Array<{
  title: string;
  body: string;
}> = [
  {
    title: "EAC spreadsheet — 16,364 phantom columns",
    body:
      "The U.S. Election Assistance Commission's XLSX file has an Excel-generated column range extending out to XFD, introducing thousands of empty columns. The parser strips trailing empty columns before importing.",
  },
  {
    title: "DOJ narrative cells — non-breaking spaces",
    body:
      "Department of Justice inventory cells use U+00A0 (non-breaking space) in place of regular spaces, which broke string matching for vendor names. The importer normalizes whitespace before tagging.",
  },
  {
    title: "HHS / CDC — ChatGPT not reflected in 2025 inventory",
    body:
      "CDC publicly announced an enterprise ChatGPT deployment but that program does not appear in the 2025 HHS inventory file. The use case is therefore missing from this database; treat the HHS general_llm_count as a lower bound.",
  },
  {
    title: "Inventory vs. reality gap",
    body:
      "Agencies self-report against OMB M-25-21. Where an agency has not filed or has filed partially, counts here undercount the real footprint. agencies.status = 'FOUND_2025' means we have 2025 data; 'FOUND_2024_ONLY' means we fell back to 2024.",
  },
  {
    title: "Consolidated entries are secondary",
    body:
      "Some agencies (VA, DHS, others) submit a 'consolidated use cases' tab alongside their main inventory. These appear in consolidated_use_cases and are counted separately from use_cases in every metric. Templates stitch both together on /templates/[id].",
  },
];

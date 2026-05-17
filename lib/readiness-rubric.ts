// CONSTANTS MUST STAY IN SYNC WITH scripts/compute_agency_readiness.py
// (in the ETL repo at 2025-aia-use-case-inventory/).
// If you change a weight or tier threshold here, change it there too.

import type { ReadinessTier } from "./types/inventory";

export const RUBRIC_VERSION = "1.1";

export interface RubricDimension {
  key:
    | "internal_capacity"
    | "frontier_capability"
    | "procurement_hygiene"
    | "risk_relevant_governance"
    | "adoption_breadth";
  label: string;
  weight: number; // 0..1
  definition: string; // 1–2 sentences
  source: string; // human-readable data source
  caveats: string[]; // known limitations
}

export const RUBRIC_DIMENSIONS: RubricDimension[] = [
  {
    key: "internal_capacity",
    label: "Internal Capacity",
    weight: 0.3,
    definition:
      "Share of use cases that are built in-house (custom code, in-house development type, or on an agency-internal AI platform) combined with the share at deployed stage. Measures direct technical capability — does the agency build and ship AI, or only buy commercial wrappers?",
    source:
      "use_cases.has_custom_code, use_cases.development_type, use_cases.stage_of_development, products.product_origin='agency_internal_platform'.",
    caveats: [
      "All four sub-shares carry equal weight inside the dimension.",
      "Encoding variants ('Developed in-house' / 'Developed in house' / 'b) Developed in-house' / 'c) Developed with both contracting and in-house resources') all count as in-house.",
    ],
  },
  {
    key: "frontier_capability",
    label: "Frontier Capability",
    weight: 0.25,
    definition:
      "Share of use cases tagged as frontier models, agentic AI, or custom-coded systems. Signal for being at the technical frontier rather than running off-the-shelf chat tools.",
    source:
      "use_case_tags.is_frontier_model, ai_sophistication='agentic' (with is_agentic_ai fallback), use_cases.has_custom_code.",
    caveats: [
      "is_agentic_ai column is absent in current production data; falls back to ai_sophistication='agentic'.",
      "Sub-shares can compound (a single use case may be both frontier and agentic), so the dimension is capped at 100.",
    ],
  },
  {
    key: "procurement_hygiene",
    label: "Procurement Hygiene",
    weight: 0.2,
    definition:
      "Average of (share of use cases on systems with an ATO) and (share of vendor products covered by FedRAMP authorization). Measures the agency's procurement-of-AI muscle.",
    source:
      "use_cases.has_ato, fedramp_product_links (curated joins between inventory products and FedRAMP marketplace).",
    caveats: [
      "FedRAMP join uses curated product links, not name-match. Coverage of inventoried products is modest (~80 link rows as of v1.1 publication).",
    ],
  },
  {
    key: "risk_relevant_governance",
    label: "Risk-Relevant Governance",
    weight: 0.15,
    definition:
      "Of *risky* use cases (those flagged as containing PII or designated high-impact), share that carry at least one oversight signal: a PIA URL, an ATO, or two or more high-impact Section-5 fields filled. The denominator is risky cases only — agencies with no risky deployments cannot earn this dimension.",
    source:
      "use_cases.has_pii, use_cases.is_high_impact, use_cases.pia_url, use_cases.has_ato, use_cases.hi_* fields.",
    caveats: [
      "Agencies with zero risky use cases score 0 here by design — we don't reward the absence of risk exposure as a capability signal. Weight is intentionally only 15% because risk exposure is unevenly distributed.",
      "Narrows the question from 'did the agency fill out the form?' to 'when the deployment actually matters, is there oversight?'",
    ],
  },
  {
    key: "adoption_breadth",
    label: "Adoption Breadth",
    weight: 0.1,
    definition:
      "Normalized count of distinct AI use cases per agency × share of bureaus participating. Measures whether AI is reaching beyond headquarters.",
    source: "use_cases, consolidated_use_cases, federal_organizations.",
    caveats: [
      "Template sub-signal is auto-suppressed when use_cases.template_id is unpopulated (current data state).",
    ],
  },
];

export interface TierBand {
  tier: ReadinessTier;
  min: number;
  max: number;
  label: string;
  description: string;
  color: string; // tailwind class fragment
}

export const TIER_BANDS: TierBand[] = [
  {
    tier: "A",
    min: 70,
    max: 100,
    label: "Frontier-Ready",
    description:
      "Agencies that build their own AI, deploy it to production, and govern the risky parts — with procurement on authorized infrastructure. No agency reaches this band in the v1.1 snapshot, which is itself a state-capacity finding.",
    color: "emerald-700",
  },
  {
    tier: "B",
    min: 55,
    max: 69,
    label: "Operational",
    description:
      "Agencies that ship and govern deployed AI systems but score below the leading bar on either internal-build share or frontier capability.",
    color: "blue-700",
  },
  {
    tier: "C",
    min: 35,
    max: 54,
    label: "Building",
    description:
      "Agencies with meaningful AI activity and partial capacity across most dimensions — material gaps remain in at least one area.",
    color: "amber-700",
  },
  {
    tier: "D",
    min: 15,
    max: 34,
    label: "Preliminary",
    description:
      "Early-stage adoption — limited use cases, mostly purchased commercial tools, weak deployment evidence.",
    color: "orange-700",
  },
  {
    tier: "F",
    min: 0,
    max: 14,
    label: "Insufficient Capacity",
    description:
      "Agencies that have not filed enough or whose filings show no observable internal capacity, deployment, or governance signal.",
    color: "rose-700",
  },
];

export function tierFromScore(score: number): TierBand {
  for (const band of TIER_BANDS) {
    if (score >= band.min) return band; // ordered desc, first match wins
  }
  return TIER_BANDS[TIER_BANDS.length - 1];
}

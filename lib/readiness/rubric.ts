// CONSTANTS MUST STAY IN SYNC WITH scripts/compute_agency_readiness.py
// (in the ETL repo at 2025-aia-use-case-inventory/).
// If you change a weight or tier threshold here, change it there too.

import type { ReadinessTier } from "../types/inventory";

export const RUBRIC_VERSION = "1.2";

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
      "Share of effective use-case units that are built in-house (custom code, an in-house development claim, or an agency-internal AI platform) combined with the share at deployed stage. Measures direct technical capability — does the agency build and ship AI, or only buy commercial wrappers?",
    source:
      "use_cases.has_custom_code, use_cases.development_type, use_cases.stage_normalized, products.product_origin='agency_internal_platform'.",
    caveats: [
      "All shares are computed over effective units: rows within an agency that share an identical (≥25-char) problem statement, vendor, and development type score once, so a single filing repeated across many rows does not inflate the numerator.",
      "A pure 'Developed in-house' claim paired with a commercial vendor and no custom code earns no in-house credit — it reads as a mislabeled commercial buy. Hybrid claims ('both contracting and in-house resources') keep credit.",
      "Deployed uses the canonical stage_normalized bucket; retired units are excluded from stage-share denominators.",
    ],
  },
  {
    key: "frontier_capability",
    label: "Frontier Capability",
    weight: 0.25,
    definition:
      "Share of effective units tagged as frontier models, agentic AI, or custom-coded systems. Signal for being at the technical frontier rather than running off-the-shelf chat tools.",
    source:
      "use_case_tags.is_frontier_model, ai_sophistication='agentic' (with is_agentic_ai fallback), use_cases.has_custom_code.",
    caveats: [
      "is_agentic_ai column is absent in current production data; falls back to ai_sophistication='agentic'.",
      "Sub-shares can compound (a single unit may be both frontier and agentic), so the dimension is capped at 100.",
      "Computed over effective units, not raw filed rows.",
    ],
  },
  {
    key: "procurement_hygiene",
    label: "Procurement Hygiene",
    weight: 0.2,
    definition:
      "Average of (share of effective units on systems with an ATO) and (share of vendor products covered by FedRAMP authorization). Measures the agency's procurement-of-AI muscle.",
    source:
      "use_cases.has_ato, fedramp_product_links (curated joins between inventory products and FedRAMP marketplace).",
    caveats: [
      "FedRAMP join uses curated product links, not name-match — a floor, not a ceiling, on real coverage.",
      "ATO share is computed over effective units; retired units are excluded from stage-share denominators but still count toward procurement shares.",
    ],
  },
  {
    key: "risk_relevant_governance",
    label: "Risk-Relevant Governance",
    weight: 0.15,
    definition:
      "Of *risky* effective units (those flagged as containing PII or designated high-impact), the share carrying at least one oversight signal: a real PIA URL, an ATO, or two or more meaningfully-filled high-impact Section-5 fields. The raw share is shrunk toward the pooled federal oversight rate so small samples do not swing to extremes.",
    source:
      "use_cases.has_pii, use_cases.is_high_impact, use_cases.pia_url, use_cases.has_ato, use_cases.hi_* fields.",
    caveats: [
      "Empirical-Bayes shrinkage toward the pooled federal oversight rate p0: score = (x + K·p0) / (n + K) with K=5. A one-for-one agency no longer scores 100; large samples keep their own rate.",
      "Oversight requires a real http PIA URL (placeholder text like 'N/A' does not count), an ATO, or ≥2 meaningfully-filled hi_* fields under a case-insensitive placeholder filter.",
      "Agencies with zero risky units still score 0 by design — we don't reward the absence of risk exposure as a capability signal. Weight is intentionally only 15% because risk exposure is unevenly distributed.",
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
      "Agencies that build their own AI, deploy it to production, and govern the risky parts — with procurement on authorized infrastructure.",
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

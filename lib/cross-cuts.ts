/**
 * Provenance metadata for every cross-cut dimension surfaced in the UI.
 *
 * The single source of truth so that wherever a tag value renders — chips,
 * /browse pages, table column headers, breakdown labels — it carries a
 * consistent OMB / IFP marker and the same explanatory text.
 *
 *   omb       Filed verbatim by the agency in its M-25-21 inventory.
 *   derived   Computed by IFP from OMB-filed text (auto_tag.py heuristics).
 *
 * If you add a new dimension to CrossCutDimension in lib/urls.ts, add its
 * provenance here. TagChip will auto-pick it up.
 */
import type { CrossCutDimension } from "./urls";

export type DimensionProvenance = {
  source: "omb" | "derived";
  /** One-sentence summary suitable for a chip tooltip. */
  short: string;
  /** Multi-sentence explanation suitable for a /browse page header. */
  long: string;
};

// `vendor` is a CrossCutKey but not a CrossCutDimension (it routes via the
// single-value `vendor` filter, not a tag URL helper). Keep it here for
// completeness so /browse/vendor can use the same map.
export type ProvenanceKey = CrossCutDimension | "vendor";

export const DIMENSION_PROVENANCE: Record<ProvenanceKey, DimensionProvenance> = {
  entry_type: {
    source: "derived",
    short: "IFP-derived classification (auto_tag.py).",
    long: "Entry type is an IFP-derived classification — every reported entry is bucketed (custom_system / product_deployment / bespoke_application / generic_use_pattern / product_feature) by auto_tag.py based on the OMB-filed system_name, vendor, and problem statement.",
  },
  sophistication: {
    source: "derived",
    short:
      "IFP-derived tier (auto_tag.py). Agentic = multi-step orchestration; Coding = explicit coding intent.",
    long: 'AI sophistication is an IFP-derived tier — auto_tag.py inspects each entry\'s OMB-filed text (problem statement, system outputs, ai_classification) and the linked product\'s vendor/category to assign one of: classical_ml · general_llm · coding_assistant · agentic · computer_vision · nlp_specific · predictive_analytics. "Agentic" requires evidence of multi-step orchestration; "coding_assistant" requires explicit coding intent (so a generic Copilot rollout is NOT counted, but a coding-specific Copilot deployment IS).',
  },
  scope: {
    source: "derived",
    short: "IFP-derived classification (auto_tag.py).",
    long: "Deployment scope is an IFP-derived classification — auto_tag.py reads the OMB-filed deployment narrative to bucket each entry as enterprise_wide / department / bureau / office / team / pilot.",
  },
  use_type: {
    source: "derived",
    short: "IFP-derived classification (auto_tag.py).",
    long: "Use type is an IFP-derived classification — auto_tag.py categorizes each entry's intent as administrative / mission_critical / it_operations / cybersecurity / research from the OMB-filed problem statement.",
  },
  high_impact: {
    source: "omb",
    short: "OMB-filed (M-25-21 §I.7).",
    long: "High-impact designation is OMB-filed (M-25-21 §I.7) — agencies self-classify each entry as High impact, Presumed-not-high-impact, or Not high impact based on whether the use case affects rights or safety.",
  },
  topic_area: {
    source: "omb",
    short: "OMB-filed verbatim (M-25-21 §II.1).",
    long: 'Topic area is OMB-filed verbatim (M-25-21 §II.1) — agencies pick from a controlled vocabulary plus free-text fallbacks. Some values are agency-specific (e.g., "Loan Program Operations" appears only at SBA).',
  },
  vendor: {
    source: "omb",
    short: "OMB-filed via product attribution.",
    long: 'Vendor is OMB-filed via each entry\'s linked product. IFP normalizes vendor strings across spelling variants (e.g., "OpenAI", "OpenAI Inc.", "openai" all map to one canonical vendor).',
  },
};

/** Convenience: just the source ("omb" | "derived") for a dimension. */
export function provenanceSource(key: ProvenanceKey): "omb" | "derived" {
  return DIMENSION_PROVENANCE[key].source;
}

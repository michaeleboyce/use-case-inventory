/**
 * Per-term definitions for inline reveal (TermChip popovers).
 *
 * Consolidates the existing definition sources so a chip anywhere on the
 * site can explain itself in place:
 *
 *   - dimension-level text comes from DIMENSION_PROVENANCE (lib/cross-cuts)
 *   - readiness tiers come from TIER_BANDS (lib/readiness/rubric)
 *   - per-value one-liners for the tag enums live here (they previously
 *     existed only as combined prose in the provenance `long` strings)
 *   - maturity-tier thresholds mirror compute_maturity.py in the ETL repo
 *   - lineage statuses mirror lib/types/year-comparison.ts doc comments
 *
 * Pure module — safe to import from client components.
 */

import { DIMENSION_PROVENANCE } from "@/lib/cross-cuts";
import { TIER_BANDS } from "@/lib/readiness/rubric";
import type { CrossCutDimension } from "@/lib/urls";

export type TermSource = "omb" | "derived";

export interface TermDefinition {
  /** Definition text, 1–3 sentences. */
  definition: string;
  /** Whether the value is OMB-filed or IFP-derived. */
  source: TermSource;
}

/* ----------------------------------------------------------------------- */
/* Per-value definitions for tag dimensions                                 */
/* ----------------------------------------------------------------------- */

const SOPHISTICATION_DEFS: Record<string, string> = {
  general_llm:
    "General-purpose LLM access — ChatGPT-style chat, summarization, and drafting without a task-specific build.",
  coding_assistant:
    "AI-assisted code generation or completion with explicit coding intent (GitHub Copilot for developers, Cursor, etc.). A generic Copilot rollout does not count; a coding-specific deployment does.",
  agentic:
    "Multi-step orchestration — the system plans, calls tools, or chains actions rather than answering a single prompt. Requires evidence of orchestration in the filing.",
  classical_ml:
    "Traditional machine learning (regression, classification, clustering) without a generative model.",
  computer_vision:
    "Image, video, or document-vision models — OCR, object detection, biometrics.",
  nlp_specific:
    "Task-specific natural-language processing that is not generative — entity extraction, sentiment, search relevance.",
  predictive_analytics:
    "Forecasting and risk-scoring models over structured data.",
};

const ENTRY_TYPE_DEFS: Record<string, string> = {
  custom_system:
    "A system the agency built or commissioned — distinct codebase, not an off-the-shelf product.",
  product_deployment:
    "A rollout of a commercial product (Copilot, ChatGPT, Claude, etc.) rather than a distinct system.",
  bespoke_application:
    "A custom application built on top of a commercial platform or model API.",
  generic_use_pattern:
    "A described pattern of use ('staff use AI for drafting') with no specific system behind it.",
  product_feature:
    "An AI capability embedded inside a product the agency already runs (e.g. a CRM's built-in assistant).",
};

const SCOPE_DEFS: Record<string, string> = {
  enterprise_wide: "Available across the whole agency, all components.",
  department: "Available department-wide at a cabinet department.",
  bureau: "Scoped to one bureau or component.",
  office: "Scoped to a single office.",
  team: "Scoped to a single team.",
  pilot: "A limited pilot population, not a standing deployment.",
  unknown: "The filing does not say how widely the system is available.",
};

const VALUE_DEFS: Partial<Record<CrossCutDimension, Record<string, string>>> = {
  sophistication: SOPHISTICATION_DEFS,
  entry_type: ENTRY_TYPE_DEFS,
  scope: SCOPE_DEFS,
};

/** Definition for one (dimension, value) pair. Falls back to the
 *  dimension-level provenance text when no per-value entry exists. */
export function termDefinition(
  dimension: CrossCutDimension,
  value: string,
): TermDefinition {
  const provenance = DIMENSION_PROVENANCE[dimension];
  return {
    definition: VALUE_DEFS[dimension]?.[value] ?? provenance.long,
    source: provenance.source,
  };
}

/** Dimension-level definition (for column headers, browse pages). */
export function dimensionDefinition(
  dimension: CrossCutDimension | "vendor",
): TermDefinition {
  const provenance = DIMENSION_PROVENANCE[dimension];
  return { definition: provenance.long, source: provenance.source };
}

/* ----------------------------------------------------------------------- */
/* Maturity tiers (heuristic ledger on /agencies, agency detail)            */
/* Thresholds mirror compute_maturity.py in the ETL repo.                   */
/* ----------------------------------------------------------------------- */

export const MATURITY_TIER_DEFS: Record<string, TermDefinition> = {
  leading: {
    definition:
      "Enterprise-wide LLM access, coding tools, and agentic AI all present, with more than 50 inventoried use cases. IFP heuristic tier.",
    source: "derived",
  },
  progressing: {
    definition:
      "Enterprise-wide LLM access with more than 20 inventoried use cases, but missing coding tools or agentic AI at scale. IFP heuristic tier.",
    source: "derived",
  },
  early: {
    definition:
      "At least one generative-AI use case and more than 5 filings, but no enterprise-wide LLM access. IFP heuristic tier.",
    source: "derived",
  },
  minimal: {
    definition:
      "Five or fewer filings, or no generative AI reported at all. IFP heuristic tier.",
    source: "derived",
  },
  none: {
    definition: "No qualifying inventory filings. IFP heuristic tier.",
    source: "derived",
  },
};

/* ----------------------------------------------------------------------- */
/* Readiness tiers (published rubric — A–F bands on /readiness)             */
/* ----------------------------------------------------------------------- */

export const READINESS_TIER_DEFS: Record<string, TermDefinition> =
  Object.fromEntries(
    TIER_BANDS.map((band) => [
      band.tier,
      {
        definition: `${band.label} (composite ${band.min}–${band.max}). ${band.description}`,
        source: "derived" as const,
      },
    ]),
  );

/* ----------------------------------------------------------------------- */
/* Cross-year lineage statuses (use_case_year_links.lineage_status)         */
/* ----------------------------------------------------------------------- */

export const LINEAGE_STATUS_DEFS: Record<string, TermDefinition> = {
  continued: {
    definition:
      "The 2024 use case reappears in the 2025 inventory under the same (or near-identical) name.",
    source: "derived",
  },
  renamed: {
    definition:
      "The 2024 use case continues in 2025 under a different name — matched by IFP via narrative and metadata similarity.",
    source: "derived",
  },
  split: {
    definition:
      "One 2024 filing maps to multiple 2025 entries — the agency broke a combined filing apart.",
    source: "derived",
  },
  retired_2024: {
    definition:
      "Present in the 2024 inventory but absent from 2025 with no Retired marker — it simply stopped being reported.",
    source: "derived",
  },
  new_2025: {
    definition: "First reported in the 2025 inventory; no 2024 antecedent found.",
    source: "derived",
  },
};

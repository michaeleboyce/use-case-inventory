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
  /** Anchor slug on /glossary — when present, popovers link
   *  "Full definition →" to `/glossary#<slug>`. */
  glossarySlug?: string;
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
  const hasEntry = Boolean(VALUE_DEFS[dimension]?.[value]);
  return {
    definition: VALUE_DEFS[dimension]?.[value] ?? provenance.long,
    source: provenance.source,
    glossarySlug: hasEntry ? value : undefined,
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
    glossarySlug: "maturity-leading",
    definition:
      "Enterprise-wide LLM access, coding tools, and agentic AI all present, with more than 50 inventoried use cases. IFP heuristic tier.",
    source: "derived",
  },
  progressing: {
    glossarySlug: "maturity-progressing",
    definition:
      "Enterprise-wide LLM access with more than 20 inventoried use cases, but missing coding tools or agentic AI at scale. IFP heuristic tier.",
    source: "derived",
  },
  early: {
    glossarySlug: "maturity-early",
    definition:
      "At least one generative-AI use case and more than 5 filings, but no enterprise-wide LLM access. IFP heuristic tier.",
    source: "derived",
  },
  minimal: {
    glossarySlug: "maturity-minimal",
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
        glossarySlug: `readiness-${band.tier}`,
      },
    ]),
  );

/* ----------------------------------------------------------------------- */
/* Cross-year lineage statuses (use_case_year_links.lineage_status)         */
/* ----------------------------------------------------------------------- */

export const LINEAGE_STATUS_DEFS: Record<string, TermDefinition> = {
  continued: {
    glossarySlug: "lineage-continued",
    definition:
      "The 2024 use case reappears in the 2025 inventory under the same (or near-identical) name.",
    source: "derived",
  },
  renamed: {
    glossarySlug: "lineage-renamed",
    definition:
      "The 2024 use case continues in 2025 under a different name — matched by IFP via narrative and metadata similarity.",
    source: "derived",
  },
  split: {
    glossarySlug: "lineage-split",
    definition:
      "One 2024 filing maps to multiple 2025 entries — the agency broke a combined filing apart.",
    source: "derived",
  },
  retired_2024: {
    glossarySlug: "lineage-retired-2024",
    definition:
      "Present in the 2024 inventory but absent from 2025 with no Retired marker — it simply stopped being reported.",
    source: "derived",
  },
  new_2025: {
    glossarySlug: "lineage-new-2025",
    definition: "First reported in the 2025 inventory; no 2024 antecedent found.",
    source: "derived",
  },
};

/* ----------------------------------------------------------------------- */
/* Site glossary (/glossary)                                                */
/* ----------------------------------------------------------------------- */

export interface GlossaryEntry {
  /** Anchor id — /glossary#<slug>. Matches TermDefinition.glossarySlug. */
  slug: string;
  term: string;
  definition: string;
  source: TermSource;
  /** Optional "see it in action" link (a browse dimension or hub page). */
  seeAlso?: { href: string; label: string };
}

export interface GlossaryGroup {
  id: string;
  title: string;
  entries: GlossaryEntry[];
}

const TERM_LABELS: Record<string, string> = {
  general_llm: "General LLM",
  coding_assistant: "Coding assistant",
  agentic: "Agentic",
  classical_ml: "Classical ML",
  computer_vision: "Computer vision",
  nlp_specific: "NLP (non-generative)",
  predictive_analytics: "Predictive analytics",
  custom_system: "Custom system",
  product_deployment: "Product deployment",
  bespoke_application: "Bespoke application",
  generic_use_pattern: "Generic use pattern",
  product_feature: "Product feature",
  enterprise_wide: "Enterprise-wide",
};

function label(value: string): string {
  return (
    TERM_LABELS[value] ??
    value
      .split(/[_\s]+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ")
  );
}

function fromDefs(
  defs: Record<string, string>,
  source: TermSource,
  seeAlso: { href: string; label: string },
): GlossaryEntry[] {
  return Object.entries(defs).map(([slug, definition]) => ({
    slug,
    term: label(slug),
    definition,
    source,
    seeAlso,
  }));
}

export const GLOSSARY: GlossaryGroup[] = [
  {
    id: "reading",
    title: "Reading the inventory",
    entries: [
      {
        slug: "individual-use-case",
        term: "Individual use case",
        definition:
          "One row in an agency's M-25-21 filing describing a single AI system or use. The unit every IFP tag is applied to.",
        source: "omb",
        seeAlso: { href: "/use-cases", label: "All use cases" },
      },
      {
        slug: "consolidated",
        term: "Consolidated use case",
        definition:
          "A single filed row standing in for many small deployments the agency chose not to itemize (e.g. one row covering all office chatbot pilots). Counted separately from individual entries and NOT covered by IFP tags — which is why percentages on this site divide by the individual count.",
        source: "omb",
        seeAlso: { href: "/about", label: "Methods & Sources" },
      },
      {
        slug: "omb-filed",
        term: "OMB-filed",
        definition:
          "A field taken verbatim from the agency's M-25-21 inventory filing. Marked with a muted OMB chip.",
        source: "omb",
      },
      {
        slug: "ifp-derived",
        term: "IFP-derived",
        definition:
          "A field computed or added by IFP's analytical layer — tags, product links, templates, maturity tiers, readiness scores. Marked with a vermilion IFP chip. \"OMB → IFP\" marks IFP computations over OMB-filed inputs (counts, rollups).",
        source: "derived",
        seeAlso: { href: "/about", label: "Methods & Sources" },
      },
      {
        slug: "high-impact",
        term: "High-impact designation",
        definition:
          "The agency's own M-25-21 determination that a use case can meaningfully affect rights or safety, triggering extra risk-management requirements.",
        source: "omb",
        seeAlso: { href: "/browse/high-impact", label: "Browse high-impact" },
      },
      {
        slug: "template",
        term: "Template",
        definition:
          "A verbatim phrasing that recurs across many filings (often vendor- or OMB-supplied boilerplate). IFP groups identical phrasings so you can see who adopted the same language.",
        source: "derived",
        seeAlso: { href: "/templates", label: "The compendium" },
      },
    ],
  },
  {
    id: "entry-types",
    title: "Entry types (what a filing describes)",
    entries: fromDefs(ENTRY_TYPE_DEFS, "derived", {
      href: "/use-cases",
      label: "Filter by entry type",
    }),
  },
  {
    id: "sophistication",
    title: "AI sophistication",
    entries: fromDefs(SOPHISTICATION_DEFS, "derived", {
      href: "/browse/sophistication",
      label: "Browse by sophistication",
    }),
  },
  {
    id: "scope",
    title: "Deployment scope",
    entries: fromDefs(SCOPE_DEFS, "derived", {
      href: "/use-cases",
      label: "Filter by scope",
    }),
  },
  {
    id: "agency-scores",
    title: "Agency scores (two systems, on purpose)",
    entries: [
      ...Object.entries(MATURITY_TIER_DEFS)
        .filter(([tier]) => tier !== "none")
        .map(([tier, def]) => ({
          slug: def.glossarySlug ?? `maturity-${tier}`,
          term: `Maturity · ${label(tier)}`,
          definition: def.definition,
          source: def.source,
          seeAlso: { href: "/agencies", label: "The ledger" },
        })),
      ...Object.entries(READINESS_TIER_DEFS).map(([tier, def]) => ({
        slug: def.glossarySlug ?? `readiness-${tier}`,
        term: `Readiness · Grade ${tier}`,
        definition: def.definition,
        source: def.source,
        seeAlso: { href: "/readiness", label: "The league table" },
      })),
    ],
  },
  {
    id: "cross-year",
    title: "Cross-year lineage (2024 ↔ 2025)",
    entries: [
      ...Object.entries(LINEAGE_STATUS_DEFS).map(([status, def]) => ({
        slug: def.glossarySlug ?? `lineage-${status.replace(/_/g, "-")}`,
        term: label(status),
        definition: def.definition,
        source: def.source,
        seeAlso: { href: "/compare-years", label: "Year over year" },
      })),
      {
        slug: "silently-dropped",
        term: "Silently dropped",
        definition:
          "A use case that was active in the 2024 inventory and disappeared from 2025 without a Retired marker — no record of whether it was cancelled, absorbed, or simply unreported.",
        source: "derived",
        seeAlso: {
          href: "/compare-years/silently-dropped",
          label: "The deep dive",
        },
      },
    ],
  },
  {
    id: "fedramp",
    title: "FedRAMP",
    entries: [
      {
        slug: "ato",
        term: "Authorization (ATO)",
        definition:
          "An agency's Authority to Operate for a cloud service — the security sign-off that lets the agency use it. FedRAMP records these as authorization events per agency per product.",
        source: "omb",
        seeAlso: { href: "/fedramp/marketplace", label: "The marketplace" },
      },
      {
        slug: "ai-by-linkage",
        term: "AI by linkage",
        definition:
          "A FedRAMP product counted as AI because it links to a curated product in the inventory's AI catalog. Precise, but blind to AI tools no agency named.",
        source: "derived",
        seeAlso: { href: "/fedramp/coverage", label: "Coverage definitions" },
      },
      {
        slug: "ai-by-classification",
        term: "AI by classification",
        definition:
          "A FedRAMP listing judged Core AI or AI-featured on its own merits by an independent review, regardless of whether any inventory mentions it. This is how \"authorized but absent\" products are found.",
        source: "derived",
        seeAlso: {
          href: "/fedramp/coverage/unlinked-ai",
          label: "Unlinked AI products",
        },
      },
      {
        slug: "sleeping-authorization",
        term: "Sleeping authorization",
        definition:
          "A product one agency authorized and uses while other agencies hold authorizations for it without any reported use — capability on the shelf.",
        source: "derived",
        seeAlso: {
          href: "/fedramp/coverage/sleeping",
          label: "Sleeping authorizations",
        },
      },
      {
        slug: "unused-authorization",
        term: "Unused authorization",
        definition:
          "A FedRAMP authorization an agency holds for a product that appears nowhere in its AI use case inventory — mapped but unused.",
        source: "derived",
        seeAlso: {
          href: "/fedramp/coverage/products",
          label: "Unused authorizations",
        },
      },
      {
        slug: "services-in-scope",
        term: "Services in scope",
        definition:
          "The individual cloud services covered by one FedRAMP package. A non-AI package can carry core-AI services inside its scope (Bedrock inside AWS GovCloud) — the shelf inside the shelf.",
        source: "derived",
        seeAlso: {
          href: "/fedramp/coverage/spread#services",
          label: "The shelf inside the shelf",
        },
      },
    ],
  },
];

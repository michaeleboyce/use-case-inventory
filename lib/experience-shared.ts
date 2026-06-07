/**
 * Client-safe shared types and constants for the /experience page.
 *
 * lib/db/experience.ts pulls in better-sqlite3, which can't be bundled into a
 * client component. The chart components only need the type / constant
 * surface, so we keep that in this module and re-export from db/experience.ts
 * for the server side.
 */

export type GenAiDefinition =
  | "omb"
  | "ifp_genai"
  | "ifp_llm_access"
  | "ifp_enterprise";

export const GENAI_DEFINITIONS: GenAiDefinition[] = [
  "omb",
  "ifp_genai",
  "ifp_llm_access",
  "ifp_enterprise",
];

export const GENAI_DEFINITION_LABELS: Record<GenAiDefinition, string> = {
  omb: "OMB classified as Generative AI",
  ifp_genai: "IFP-tagged Generative AI",
  ifp_llm_access: "IFP-tagged general LLM access",
  ifp_enterprise: "IFP-tagged enterprise-wide LLM",
};

export const GENAI_DEFINITION_SHORT: Record<GenAiDefinition, string> = {
  omb: "OMB",
  ifp_genai: "IFP GenAI",
  ifp_llm_access: "LLM access",
  ifp_enterprise: "Enterprise LLM",
};

export const GENAI_DEFINITION_SOURCE: Record<
  GenAiDefinition,
  "omb" | "derived"
> = {
  omb: "omb",
  ifp_genai: "derived",
  ifp_llm_access: "derived",
  ifp_enterprise: "derived",
};

export const MATRIX_PRODUCT_BUCKETS = [
  { key: "ms_copilot", label: "MS Copilot (M365)" },
  { key: "github_copilot", label: "GitHub Copilot" },
  { key: "chatgpt", label: "ChatGPT / OpenAI" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
  { key: "amazon_q", label: "Amazon Q / Bedrock" },
  { key: "agency_built", label: "Agency-built LLM" },
] as const;

export type MatrixProductKey = (typeof MATRIX_PRODUCT_BUCKETS)[number]["key"];

export interface GenAiHeadline {
  definition: GenAiDefinition;
  total: number;
  deployed: number;
  pilot: number;
  pre_deployment: number;
  retired: number;
}

export interface OmbIfpCrosstab {
  omb_genai_ifp_genai: number;
  omb_genai_ifp_not: number;
  omb_not_ifp_genai: number;
  omb_not_ifp_not: number;
}

export interface GenAiTimelinePoint {
  year: string;
  counts: Record<GenAiDefinition, number>;
}

export interface AgencyGenAiRow {
  agency_id: number;
  abbreviation: string;
  name: string;
  counts: Record<GenAiDefinition, number>;
}

export interface SeatExtrapolationRow {
  agency_id: number;
  abbreviation: string;
  name: string;
  rows_with_band: number;
  lower_bound: number;
  midpoint: number;
  upper_bound: number;
}

export interface MatrixCellEntry {
  /**
   * Which OMB form produced this entry. `consolidated` rows come from the
   * consolidated Appendix B inventory (license bands available);
   * `use_case` rows come from each agency's individual M-25-21 filing.
   */
  source: "consolidated" | "use_case";
  /**
   * `use_case` rows are marked subsumed when the same (agency, product)
   * already has a consolidated entry in this cell — the consolidated row
   * is the authoritative artifact in that case; the use_case row is shown
   * for completeness, ranked below.
   */
  subsumed: boolean;
  /** id of the underlying row in either consolidated_use_cases or use_cases */
  row_id: number;
  slug: string | null;
  /** ai_use_case (consolidated) or use_case_name (individual filing) */
  title: string;
  /** commercial_product (consolidated) or vendor/tool_product_name (use_case) */
  commercial_product: string;
  /**
   * License band label for consolidated rows. NULL for use_case rows since
   * individual filings don't carry a band; the UI renders a sentinel.
   */
  band_label: string | null;
}

export interface MatrixCell {
  highest_band_upper: number;
  highest_band_label: string;
  rows: number;
  /**
   * Underlying entries (consolidated + use_case mixed) that contributed
   * to this cell, ordered largest band first (consolidated first within
   * a band tier), then unsubsumed use_case rows, then subsumed use_case
   * rows last. Up to 8 to keep the hover panel scannable.
   */
  entries: MatrixCellEntry[];
}

export interface AgencyToolMatrixRow {
  agency_id: number;
  abbreviation: string;
  name: string;
  cells: Partial<Record<MatrixProductKey, MatrixCell>>;
  /**
   * Estimate A — "Filed bands". Sum of license-band midpoints across cells
   * with at least one consolidated_use_cases entry. The estimate that has
   * shipped since the page launched; never replaced.
   */
  estimated_seats_filed: number;
  /**
   * Estimate B — "Headcount-derived". For each cell, multiplies the
   * agency's AI-eligible workforce by the share-of-eligible for that tool
   * (from agency_ai_access_evidence + the coverage-tier priors). Null when
   * agency_workforce_profile has no row for this agency yet.
   */
  estimated_seats_headcount: number | null;
  /**
   * One-line provenance summary for the headcount estimate's inputs.
   * E.g., "470,000 staff × 0.30 eligible × Σ tool shares".
   */
  headcount_breakdown: string | null;
}

/** Empirical priors from Wave 0 keyed by coverage_assessment tier. */
export interface CoveragePriors {
  /** Median observed share-of-eligible per tier; null when no observations. */
  defaults: Partial<Record<string, number>>;
  /** Total number of (agency, tool) extractions Wave-0 made. */
  extraction_count: number;
}

export interface YearCompareGenAi {
  /**
   * IFP-tagged GenAI count for 2024, from `use_case_tags_2024_canonical`
   * (is_generative_ai = 1). Directly comparable to the 2025 `ifp_genai`
   * definition — both are IFP narrative re-tags, not OMB self-classification.
   */
  count_2024_tagged: number;
  total_2024: number;
  total_2025: number;
  counts_2025_by_definition: Record<GenAiDefinition, number>;
}

/** One agency's 2024-vs-2025 IFP-tagged GenAI counts and the net change. */
export interface AgencyYearCompareGenAiRow {
  agency_id: number;
  abbreviation: string;
  name: string;
  genai_2024: number;
  genai_2025: number;
  delta: number;
}

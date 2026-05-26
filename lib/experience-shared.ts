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

export interface MatrixCell {
  highest_band_upper: number;
  highest_band_label: string;
  rows: number;
}

export interface AgencyToolMatrixRow {
  agency_id: number;
  abbreviation: string;
  name: string;
  cells: Partial<Record<MatrixProductKey, MatrixCell>>;
  estimated_seats: number;
}

export interface YearCompareGenAi {
  count_2024_heuristic: number;
  total_2024: number;
  total_2025: number;
  counts_2025_by_definition: Record<GenAiDefinition, number>;
}

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

/* ------------------------------------------------------------------ */
/* Enterprise-GenAI delivery tiers                                     */
/* ------------------------------------------------------------------ */

/** How an enterprise-wide GenAI capability is delivered. Classified per row
 *  by the ETL repo's `scripts/classify_enterprise_genai_tiers.py` (rule
 *  tables + hand overrides; per-row provenance in
 *  `audit/retag/enterprise-scope-2026-06/tier_classification_*.csv`). */
export const ENTERPRISE_TIERS = [
  "permission",
  "embedded_cots",
  "tenanted",
  "operated_build",
] as const;

export type EnterpriseTier = (typeof ENTERPRISE_TIERS)[number];

export const ENTERPRISE_TIER_LABELS: Record<EnterpriseTier, string> = {
  permission: "Permission to use commercial AI",
  embedded_cots: "AI features in existing licenses",
  tenanted: "Tenanted commercial assistant",
  operated_build: "Operated internal service",
};

export const ENTERPRISE_TIER_BLURBS: Record<EnterpriseTier, string> = {
  permission:
    "A policy allowing employees to use public commercial GenAI — no agency-run service, public data only.",
  embedded_cots:
    "AI features arriving inside software the agency already licenses (Westlaw AI, ServiceNow Now Assist, Adobe Firefly).",
  tenanted:
    "A procured enterprise instance of a commercial assistant switched on for the workforce (M365 Copilot, ChatGPT Enterprise, Claude, Gemini).",
  operated_build:
    "A purpose-built, agency-branded service inside the agency boundary, typically approved for internal data (StateChat, DHSChat, GSAi, SSA's ASC).",
};

export interface EnterpriseTierRollupRow {
  year: number;
  tier: EnterpriseTier;
  n: number;
}

/* ------------------------------------------------------------------ */
/* Stratified-overlap seat model (band_labels_2026-07 pass)            */
/* ------------------------------------------------------------------ */

/**
 * Agencies absent from the inventory by policy. Single source of truth for
 * query WHERE clauses, the scope banner, and methodology copy.
 */
export const EXCLUDED_AGENCY_ABBRS = ["DoD", "USPS"] as const;

/** Population strata that count toward person-seats. */
export const STRATA = [
  "general",
  "technical",
  "legal",
  "investigative",
  "comms",
  "clinical",
] as const;

export type Stratum = (typeof STRATA)[number];

/** What consolidated_band_labels.stratum can hold (superset of STRATA). */
export type BandLabelStratum = Stratum | "excluded_not_seats";

export const STRATUM_LABELS: Record<Stratum, string> = {
  general: "General office AI (chat, drafting, M365/Gemini)",
  technical: "Developers & data (coding assistants, ML platforms)",
  legal: "Legal (research, eDiscovery)",
  investigative: "Investigative (case data, forensics)",
  comms: "Communications (media analysis, social listening)",
  clinical: "Clinical (ambient scribes, decision support)",
};

export const UNIT_COUNTED_VALUES = [
  "employees",
  "employees_and_contractors",
  "devices_endpoints",
  "public_users",
  "applicants_cases",
  "unknown",
] as const;

export type UnitCounted = (typeof UNIT_COUNTED_VALUES)[number];

export const UNIT_COUNTED_LABELS: Record<UnitCounted, string> = {
  employees: "Employee seats",
  employees_and_contractors: "Employees + contractors",
  devices_endpoints: "Devices / endpoints",
  public_users: "Members of the public",
  applicants_cases: "Applications / cases",
  unknown: "Unclear",
};

export type LabelConfidence = "high" | "medium" | "low";

/** One banded row's contribution to an agency's stratum, post-labeling. */
export interface StratumReachInput {
  slug: string;
  stratum: Stratum;
  /** Canonical family (top-level parent product), or a per-row fallback. */
  family: string;
  band_label: string;
  band_lower: number;
  band_mid: number;
  band_upper: number;
  unit_counted: UnitCounted;
  confidence: LabelConfidence;
  audited: boolean;
  title: string;
}

/** Per-agency model inputs assembled by lib/db/experience/strata.ts. */
export interface AgencySeatModelInput {
  agency_id: number;
  abbreviation: string;
  name: string;
  /** headcount × ai_eligible_share; null when no workforce denominator. */
  eligible: number | null;
  total_headcount: number | null;
  contractor_headcount: number | null;
  denominator_basis: string | null;
  headcount_as_of: string | null;
  headcount_source_url: string | null;
  /** FedScope occupational caps per role stratum (agency_occupation_counts). */
  stratum_caps: Partial<Record<Stratum, number>>;
  reaches: StratumReachInput[];
}

export interface SeatModelScenario {
  /** Which end of each band feeds the central estimate. */
  band: "lower" | "mid" | "upper";
  /** Drop rows the labelers marked low-confidence? */
  dropLowConfidence: boolean;
  /** Count the clinical stratum toward the union? */
  includeClinical: boolean;
}

export const DEFAULT_SCENARIO: SeatModelScenario = {
  band: "mid",
  dropLowConfidence: false,
  includeClinical: true,
};

export interface StratumResult {
  stratum: Stratum;
  /** MAX across the stratum's rows at the scenario band (same population). */
  reach: number;
  /** min(eligible, occupation cap) — the stratum's population ceiling. */
  cap: number;
  /** min(reach, cap) / eligible — this stratum's coverage share. */
  share: number;
  /** Filed band meets/exceeds the population ceiling. */
  saturated: boolean;
  /** Family and row that set the stratum's reach (for drill-down links). */
  winning_family: string;
  winning_slug: string;
  winning_band_label: string;
  rows: number;
}

export interface AgencySeatModel {
  agency_id: number;
  abbreviation: string;
  name: string;
  eligible: number | null;
  total_headcount: number | null;
  contractor_headcount: number | null;
  denominator_basis: string | null;
  headcount_as_of: string | null;
  headcount_source_url: string | null;
  /** False when no workforce denominator — bands shown, union not modeled. */
  modeled: boolean;
  strata: StratumResult[];
  /** Largest single stratum at band-lower (perfect-nesting assumption). */
  floor: number | null;
  /** Independence union at the scenario band. */
  central: number | null;
  /** min(Σ capped stratum uppers, eligible) (fully-disjoint assumption). */
  ceiling: number | null;
  /** central / eligible. */
  coverage_share: number | null;
  /** Raw band range for unmodeled agencies (max lower .. Σ upper). */
  raw_band_lower: number;
  raw_band_upper: number;
}

export interface SeatModelTotals {
  agencies_total: number;
  agencies_modeled: number;
  eligible_total: number;
  floor: number;
  central: number;
  ceiling: number;
}

export type WaterfallStepKind = "start" | "deduction" | "result";

export interface WaterfallStep {
  key: string;
  label: string;
  /** Running total AFTER this step. */
  value: number;
  /** Change applied by this step (negative for deductions). */
  delta: number;
  kind: WaterfallStepKind;
  note: string;
}

export interface ProvenanceSlice {
  key: string;
  label: string;
  /** Band-midpoint seat mass in this slice. */
  seats_mass: number;
  rows: number;
}

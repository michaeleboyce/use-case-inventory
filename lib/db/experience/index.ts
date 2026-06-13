/**
 * Queries for the /experience page — "What LLM access does an average civil
 * servant have, before and after the AI Action Plan?"
 *
 * Two ideas anchor every query here:
 *
 *   1. There is no single "is this GenAI?" answer. The OMB-filed
 *      `ai_classification` column disagrees with the IFP-tagged
 *      `use_case_tags.is_generative_ai` flag for ~890 of 3,549 use cases.
 *      Every count below is parametric on a `definition` so the page can
 *      render the same chart under four lenses and let the reader compare:
 *
 *        - "omb"            : ai_classification LIKE '%Generative%'
 *        - "ifp_genai"      : use_case_tags.is_generative_ai = 1
 *        - "ifp_llm_access" : use_case_tags.is_general_llm_access = 1
 *        - "ifp_enterprise" : is_enterprise_wide = 1 AND is_general_llm_access = 1
 *
 *   2. Use-case rows don't measure workforce-scale access. The license-band
 *      column on `consolidated_use_cases.estimated_licenses_users` does — but
 *      it's a band ("1001-5000"), not an exact number. We extrapolate seats
 *      via band midpoints, knowing the resulting total is the same employee
 *      counted once per tool they have. Reported as "estimated seats" not
 *      "estimated users".
 *
 * Split by domain: headlines, timeline, seats (band extrapolation),
 * tool-matrix (agency × tool grid + seat estimates), year-compare,
 * capability (ladder + delivery tiers). Shared helpers in shared.ts/bands.ts.
 */

export { getGenAiHeadlines, getOmbIfpCrosstab } from "./headlines";
export { getGenAiTimeline, getAgencyGenAiCounts } from "./timeline";
export { getSeatExtrapolationByAgency } from "./seats";
export { getAgencyToolMatrix } from "./tool-matrix";
export {
  getYearCompareGenAi,
  getYearCompareGenAiByAgency,
} from "./year-compare";
export {
  getCapabilityLadder,
  getEnterpriseTierRollup,
  type CapabilityLadderData,
} from "./capability";

// Re-export the shared definitions/types for callers importing from
// @/lib/db or @/lib/db/experience.
export {
  GENAI_DEFINITIONS,
  GENAI_DEFINITION_LABELS,
  GENAI_DEFINITION_SHORT,
  GENAI_DEFINITION_SOURCE,
  MATRIX_PRODUCT_BUCKETS,
  type GenAiDefinition,
  type GenAiHeadline,
  type OmbIfpCrosstab,
  type GenAiTimelinePoint,
  type AgencyGenAiRow,
  type SeatExtrapolationRow,
  type AgencyToolMatrixRow,
  type MatrixCell,
  type MatrixProductKey,
  type YearCompareGenAi,
  type AgencyYearCompareGenAiRow,
  type EnterpriseTierRollupRow,
} from "../../experience-shared";

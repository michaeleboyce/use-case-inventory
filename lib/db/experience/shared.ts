/**
 * Shared helpers for the /experience query modules.
 */

import type { GenAiDefinition } from "../../experience-shared";

/**
 * SQL predicate selecting use cases that match a given GenAI definition.
 * Always references `uc` (use_cases) and `t` (use_case_tags) — callers must
 * provide a LEFT JOIN to `use_case_tags AS t ON t.use_case_id = uc.id`.
 */
export function genaiPredicate(def: GenAiDefinition): string {
  switch (def) {
    case "omb":
      return "uc.ai_classification LIKE '%Generative%'";
    case "ifp_genai":
      return "t.is_generative_ai = 1";
    case "ifp_llm_access":
      return "t.is_general_llm_access = 1";
    case "ifp_enterprise":
      return "t.is_enterprise_wide = 1 AND t.is_general_llm_access = 1";
  }
}

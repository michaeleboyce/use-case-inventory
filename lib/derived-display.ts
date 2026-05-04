/**
 * Helpers for rendering derived (IFP-tagged) fields whose data quality is
 * uneven. The rule: don't surface a binary "yes / no" when the underlying tag
 * isn't reliable enough to assert either. Show "— not asserted —" instead, so
 * users don't read silence as an authoritative "no."
 *
 * Coverage gaps verified against `data/federal_ai_inventory_2025.db`:
 *   - `tags.deployment_environment`            : 100% 'unknown' (4,449 rows).
 *                                                Don't display; not exposed by
 *                                                any helper here.
 *   - `tags.high_impact_designation`           :  29% blank (1,282 / 4,449).
 *   - `tags.is_generative_ai` ↔ sophistication : 501 rows with sophistication ∈
 *                                                {general_llm, agentic,
 *                                                coding_assistant} but
 *                                                is_generative_ai = 0. The
 *                                                upstream tagger has not yet
 *                                                back-filled GenAI=1 for these.
 */

import type { UseCaseTag } from "./types";

/** Sentinel string used wherever a derived field is too uneven to display
 *  as a hard fact. Centralized so all surfaces phrase it identically. */
export const NOT_ASSERTED = "— not asserted —";

/** Three-way state for the GenAI badge on a row. Returns "not_asserted" when
 *  the tag says is_generative_ai = 0 but the sophistication implies the entry
 *  is plainly LLM-driven (general LLM access, agentic, coding assistant) — the
 *  tagger hasn't yet caught up to the sophistication value, so suppressing the
 *  "no" badge is more honest than displaying it. */
export function genaiDisplayState(
  tag: UseCaseTag | null | undefined,
): "yes" | "no" | "not_asserted" {
  if (!tag || tag.is_generative_ai == null) return "not_asserted";
  if (tag.is_generative_ai === 1) return "yes";
  // is_generative_ai === 0
  const soph = tag.ai_sophistication ?? "";
  if (soph === "general_llm" || soph === "agentic" || soph === "coding_assistant") {
    return "not_asserted";
  }
  return "no";
}

/** Display text for the GenAI field on a use-case detail page. */
export function genaiDisplayText(
  tag: UseCaseTag | null | undefined,
): string | null {
  switch (genaiDisplayState(tag)) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "not_asserted":
      return NOT_ASSERTED;
  }
}

/** Display text for the tag-derived high-impact designation. Blank tag value
 *  means "we have not classified this entry one way or the other" — render
 *  the not-asserted sentinel rather than an empty cell that reads as "no." */
export function highImpactDesignationDisplayText(
  tag: UseCaseTag | null | undefined,
): string | null {
  const v = tag?.high_impact_designation;
  if (!v || v.trim() === "") return NOT_ASSERTED;
  // Pretty-print enum values like "high_impact" → "High impact". The detail
  // page already runs its own labelFor, so callers may want the raw value;
  // this helper returns the raw value untouched and lets the caller format.
  return v;
}

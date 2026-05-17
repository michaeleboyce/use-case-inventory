/**
 * Per-agency Federal AI Readiness scorecard card.
 *
 * Renders the 5-dimension rubric composite + subscore breakdown for a
 * single agency. Used both on `/agencies/[slug]` (inside an editorial
 * Section) and the print-friendly `/agencies/[slug]/scorecard` route.
 *
 * The parchment fill (`#f6efdf`) marks this view as the "published
 * rubric" — visually distinct from the heuristic `agency_ai_maturity`
 * card elsewhere on the page.
 */
import Link from "next/link";
import type { AgencyReadinessWithName } from "@/lib/types/inventory";
import { ReadinessSubscoreBar } from "./readiness-subscore-bar";

// v1.1 capacity-first weights. MUST match scripts/compute_agency_readiness.py
// and lib/readiness-rubric.ts.
const WEIGHTS = {
  internal_capacity: 0.3,
  frontier_capability: 0.25,
  procurement_hygiene: 0.2,
  risk_relevant_governance: 0.15,
  adoption_breadth: 0.1,
} as const;

/** Read a numeric value out of a headline_inputs sub-object, defensively. */
function num(
  bucket: Record<string, number | boolean> | undefined,
  key: string,
): number | null {
  if (!bucket) return null;
  const v = bucket[key];
  return typeof v === "number" ? v : null;
}

/** Build a human-readable "X of Y" tooltip from a numerator/denominator pair
 * in headline_inputs, falling back to a generic message when the inputs
 * aren't structured the way we expect. */
function tooltipFor(
  inputs: AgencyReadinessWithName["headline_inputs"],
  dimKey: string,
  fallback: string,
): string {
  const bucket = inputs?.[dimKey];
  if (!bucket) return fallback;
  const num_ = num(bucket, "numerator");
  const den_ = num(bucket, "denominator");
  const note = bucket["note"];
  if (num_ != null && den_ != null) {
    const base = `${Math.round(num_).toLocaleString()} of ${Math.round(
      den_,
    ).toLocaleString()}`;
    return typeof note === "string" ? `${base} — ${note}` : base;
  }
  return typeof note === "string" ? note : fallback;
}

export function AgencyScorecardCard({
  readiness,
}: {
  readiness: AgencyReadinessWithName;
}) {
  const inputs = readiness.headline_inputs ?? {};
  const totalScoredRaw = inputs["meta"]?.["total_agencies_scored"];
  const totalScored =
    typeof totalScoredRaw === "number" ? totalScoredRaw : null;

  return (
    <div className="bg-[#f6efdf] border border-stone-300 p-6 md:p-8">
      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        {/* Left column — composite + tier hero */}
        <div className="md:w-1/3 md:border-r md:border-stone-300 md:pr-8">
          <div className="font-display italic text-7xl text-stone-900 tabular-nums leading-none">
            {Math.round(readiness.composite_score)}
          </div>
          <div className="mt-3 font-display italic text-3xl text-stone-700 leading-tight">
            Tier {readiness.tier} — {readiness.tier_label}
          </div>
          <div className="mt-3 font-mono text-sm text-stone-500">
            {totalScored != null
              ? `Rank ${readiness.rank} of ${totalScored}`
              : `Rank ${readiness.rank}`}
          </div>
        </div>

        {/* Right column — 5 subscore bars, ordered by v1.1 weight desc */}
        <div className="flex-1 flex flex-col gap-4">
          <ReadinessSubscoreBar
            label="Internal Capacity"
            value={readiness.internal_capacity}
            weight={WEIGHTS.internal_capacity}
            rawInfo={tooltipFor(
              inputs,
              "internal_capacity",
              "Share custom-coded + in-house developed + at deployed stage + on agency-internal platforms.",
            )}
          />
          <ReadinessSubscoreBar
            label="Frontier Capability"
            value={readiness.frontier_capability}
            weight={WEIGHTS.frontier_capability}
            rawInfo={tooltipFor(
              inputs,
              "frontier_capability",
              "Share of use cases tagged frontier model, agentic AI, or custom-built systems.",
            )}
          />
          <ReadinessSubscoreBar
            label="Procurement Hygiene"
            value={readiness.procurement_hygiene}
            weight={WEIGHTS.procurement_hygiene}
            rawInfo={tooltipFor(
              inputs,
              "procurement_hygiene",
              "Share of use cases on ATO'd systems and share of vendor products with FedRAMP authorization.",
            )}
          />
          <ReadinessSubscoreBar
            label="Risk-Relevant Governance"
            value={readiness.risk_relevant_governance}
            weight={WEIGHTS.risk_relevant_governance}
            rawInfo={tooltipFor(
              inputs,
              "risk_relevant_governance",
              "Of risky use cases (PII or high-impact), share with any oversight signal (PIA URL, ATO, or hi_* fields filled).",
            )}
          />
          <ReadinessSubscoreBar
            label="Adoption Breadth"
            value={readiness.adoption_breadth}
            weight={WEIGHTS.adoption_breadth}
            rawInfo={tooltipFor(
              inputs,
              "adoption_breadth",
              "Normalized count of use cases × share of bureaus participating × distinct capability templates.",
            )}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-stone-200 font-mono text-xs text-stone-500 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span>Computed {readiness.computed_at}</span>
        <span aria-hidden>·</span>
        <Link
          href="/readiness/methodology"
          className="underline-offset-2 hover:underline hover:text-stone-700"
        >
          methodology →
        </Link>
        <span aria-hidden>·</span>
        <Link
          href={`/agencies/${readiness.agency_slug}/scorecard`}
          className="underline-offset-2 hover:underline hover:text-stone-700"
        >
          Save as PDF →
        </Link>
      </div>
    </div>
  );
}

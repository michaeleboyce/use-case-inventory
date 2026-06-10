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
import { readinessInputSummary } from "@/components/readiness/readiness-derivation";
import { ReadinessSubscoreBar } from "@/components/readiness/readiness-subscore-bar";
import { RUBRIC_DIMENSIONS } from "@/lib/readiness/rubric";

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
          {RUBRIC_DIMENSIONS.map((dim) => (
            <ReadinessSubscoreBar
              key={dim.key}
              label={dim.label}
              value={readiness[dim.key]}
              weight={dim.weight}
              rawInfo={readinessInputSummary(inputs, dim.key, dim.definition)}
            />
          ))}
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

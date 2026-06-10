/**
 * Inline derivation panel for one agency's readiness score.
 *
 * Shows, for each of the 5 rubric dimensions: the subscore bar, the
 * human-readable "X of Y — note" inputs that produced the score (from
 * `headline_inputs`), and the weight × score = contribution arithmetic
 * toward the composite. Rendered inside the expanded row of the
 * /readiness rank table; safe to import from client components (pure,
 * no server-only deps).
 *
 * The input-summary helper here is the single source for "X of Y" text —
 * `agency-scorecard-card.tsx` imports it for its hover tooltips.
 */
import Link from "next/link";
import { RUBRIC_DIMENSIONS } from "@/lib/readiness/rubric";
import type { AgencyReadinessWithName } from "@/lib/types/inventory";
import { ReadinessSubscoreBar } from "./readiness-subscore-bar";

/** Read a numeric value out of a headline_inputs sub-object, defensively. */
function num(
  bucket: Record<string, number | boolean> | undefined,
  key: string,
): number | null {
  if (!bucket) return null;
  const v = bucket[key];
  return typeof v === "number" ? v : null;
}

/** Build a human-readable "X of Y — note" summary from a
 * numerator/denominator pair in headline_inputs, falling back to the
 * given text when the inputs aren't structured the way we expect. */
export function readinessInputSummary(
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

export function ReadinessDerivation({
  readiness,
}: {
  readiness: AgencyReadinessWithName;
}) {
  const inputs = readiness.headline_inputs ?? {};

  return (
    <div className="space-y-4">
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {RUBRIC_DIMENSIONS.map((dim) => {
          const score = readiness[dim.key];
          const contribution = score * dim.weight;
          return (
            <div key={dim.key} className="flex flex-col gap-1.5">
              <ReadinessSubscoreBar
                label={dim.label}
                value={score}
                weight={dim.weight}
              />
              <p className="text-[0.8rem] leading-snug text-stone-600">
                {readinessInputSummary(inputs, dim.key, dim.definition)}
              </p>
              <p className="font-mono text-[10px] tabular-nums text-stone-400">
                {Math.round(dim.weight * 100)}% × {score.toFixed(1)} ={" "}
                {contribution.toFixed(1)} pts of composite ·{" "}
                <Link
                  href={`/readiness/methodology#${dim.key}`}
                  className="underline-offset-2 hover:text-stone-700 hover:underline"
                >
                  methodology →
                </Link>
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 border-t border-stone-200 pt-2 font-mono text-[11px] text-stone-500">
        <span className="tabular-nums">
          Composite {readiness.composite_score.toFixed(1)} · Tier{" "}
          {readiness.tier} ({readiness.tier_label})
        </span>
        <Link
          href={`/agencies/${readiness.agency_slug}#scorecard`}
          className="uppercase tracking-[0.12em] underline-offset-2 hover:text-[var(--stamp)] hover:underline"
        >
          Full scorecard →
        </Link>
      </div>
    </div>
  );
}

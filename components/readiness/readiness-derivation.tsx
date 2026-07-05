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

function humanizeKey(key: string): string {
  const k = key.replace(/_/g, " ");
  return k.length > 0 ? k[0].toUpperCase() + k.slice(1) : k;
}

/** Keys that denote the bucket's denominator rather than an input signal.
 * `total_units` is the v1.2 effective-unit denominator; `total_use_cases`
 * is the v1.1 fallback; `active_units` is the (smaller) denominator the
 * deployed sub-share of Internal Capacity is measured over. */
const DENOMINATOR_KEYS = new Set([
  "denominator",
  "total_units",
  "active_units",
  "total_use_cases",
  "total",
  "risky_total",
  "ato_total",
  "products_total",
]);

/**
 * v1.2 Risk-Relevant Governance renders as shrinkage arithmetic, not a
 * bare X-of-Y. Returns a one-line summary when the Empirical-Bayes fields
 * are present, or null so callers fall back to the pre-1.2 rendering.
 * See /readiness/methodology#shrinkage.
 */
export function governanceShrinkageSummary(
  bucket: Record<string, number | boolean> | undefined,
): string | null {
  const n = num(bucket, "risky_total");
  const x = num(bucket, "risky_with_oversight");
  const shrunk = num(bucket, "shrunk_score");
  const prior = num(bucket, "prior_rate");
  const k = num(bucket, "shrinkage_k");
  if (n == null || x == null || shrunk == null || prior == null || k == null) {
    return null;
  }
  if (n === 0) {
    return "No risky use cases — scores 0 on this dimension by design.";
  }
  const raw = (x / n) * 100;
  const priorPct = prior <= 1 ? prior * 100 : prior;
  return `${Math.round(x)}/${Math.round(n)} risky use cases overseen (raw ${raw.toFixed(
    1,
  )}) → shrunk toward federal rate ${priorPct.toFixed(
    1,
  )}% with K=${Math.round(k)} → ${shrunk.toFixed(1)}`;
}

/** The raw input signals for one dimension, as label/value pairs, with the
 * bucket's denominator (when one is recognizable) split out. Returns null
 * when headline_inputs has no bucket for the dimension. */
export function readinessInputBreakdown(
  inputs: AgencyReadinessWithName["headline_inputs"],
  dimKey: string,
): { signals: Array<{ label: string; value: number }>; denominators: Array<{ label: string; value: number }> } | null {
  const bucket = inputs?.[dimKey];
  if (!bucket) return null;
  const signals: Array<{ label: string; value: number }> = [];
  const denominators: Array<{ label: string; value: number }> = [];
  for (const [key, v] of Object.entries(bucket)) {
    if (typeof v !== "number") continue;
    (DENOMINATOR_KEYS.has(key) ? denominators : signals).push({
      label: humanizeKey(key === "numerator" ? "qualifying" : key),
      value: v,
    });
  }
  if (signals.length === 0 && denominators.length === 0) return null;
  return { signals, denominators };
}

/** Build a human-readable one-line summary of a dimension's inputs,
 * falling back to the given text when headline_inputs has no bucket. */
export function readinessInputSummary(
  inputs: AgencyReadinessWithName["headline_inputs"],
  dimKey: string,
  fallback: string,
): string {
  const bucket = inputs?.[dimKey];
  if (!bucket) return fallback;
  if (dimKey === "risk_relevant_governance") {
    const shrink = governanceShrinkageSummary(bucket);
    if (shrink) return shrink;
  }
  const num_ = num(bucket, "numerator");
  const den_ = num(bucket, "denominator");
  const note = bucket["note"];
  if (num_ != null && den_ != null) {
    const base = `${Math.round(num_).toLocaleString()} of ${Math.round(
      den_,
    ).toLocaleString()}`;
    return typeof note === "string" ? `${base} — ${note}` : base;
  }
  const breakdown = readinessInputBreakdown(inputs, dimKey);
  if (breakdown && breakdown.signals.length > 0) {
    const parts = breakdown.signals.map((s) => `${s.label} ${s.value}`);
    const den = breakdown.denominators[0];
    return (
      parts.join(" · ") + (den ? ` — of ${den.value} ${den.label.toLowerCase()}` : "")
    );
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
          const bucket = inputs[dim.key];
          const breakdown = readinessInputBreakdown(inputs, dim.key);
          // v1.2 Risk-Relevant Governance renders as shrinkage arithmetic,
          // linking to the #shrinkage anchor. Null for pre-1.2 rows.
          const shrink =
            dim.key === "risk_relevant_governance"
              ? governanceShrinkageSummary(bucket)
              : null;
          // Internal Capacity's deployed sub-share is measured over active
          // units, not the total — note it when the field is present.
          const activeUnits =
            dim.key === "internal_capacity" ? num(bucket, "active_units") : null;
          return (
            <div key={dim.key} className="flex flex-col gap-1.5">
              <ReadinessSubscoreBar
                label={dim.label}
                value={score}
                weight={dim.weight}
              />
              {shrink ? (
                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {shrink}{" "}
                  <Link
                    href="/readiness/methodology#shrinkage"
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    shrinkage →
                  </Link>
                </p>
              ) : breakdown && breakdown.signals.length > 0 ? (
                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {breakdown.signals.map((s, i) => (
                    <span key={s.label} className="whitespace-nowrap">
                      {i > 0 ? " · " : ""}
                      {s.label}{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {s.value.toLocaleString()}
                      </span>
                    </span>
                  ))}
                  {breakdown.denominators[0] ? (
                    <span className="text-muted-foreground/60">
                      {" "}
                      / {breakdown.denominators[0].value.toLocaleString()}{" "}
                      {breakdown.denominators[0].label.toLowerCase()}
                    </span>
                  ) : null}
                  {activeUnits != null ? (
                    <span className="text-muted-foreground/60">
                      {" "}
                      (deployed over {activeUnits.toLocaleString()} active)
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="text-[0.8rem] leading-snug text-muted-foreground">
                  {readinessInputSummary(inputs, dim.key, dim.definition)}
                </p>
              )}
              <p className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                {Math.round(dim.weight * 100)}% × {score.toFixed(1)} ={" "}
                {contribution.toFixed(1)} pts of composite ·{" "}
                <Link
                  href={`/readiness/methodology#${dim.key}`}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  methodology →
                </Link>
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 border-t border-border pt-2 font-mono text-[11px] text-muted-foreground">
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

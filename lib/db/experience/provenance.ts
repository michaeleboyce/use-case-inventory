/**
 * Provenance + correction-waterfall rollups for the seat model.
 *
 * The waterfall is THE methodology chart: it starts from the naive
 * band-midpoint sum (what the page used to publish) and applies each
 * correction as an explicit, labeled step down to the model's central
 * estimate. Every step corresponds to one stateable rule; nothing is
 * silently dropped.
 *
 * The provenance slices answer "what evidence does the headline rest
 * on": seat mass by unit_counted, by label confidence, and by whether
 * the row was Fable-audited.
 */

import {
  type ProvenanceSlice,
  type SeatModelTotals,
  type WaterfallStep,
  UNIT_COUNTED_LABELS,
  type UnitCounted,
} from "../../experience-shared";
import type { LabeledBandRow, SeatModelSourceData } from "./strata";

export interface ProvenanceRollup {
  by_unit: ProvenanceSlice[];
  by_confidence: ProvenanceSlice[];
  by_audited: ProvenanceSlice[];
}

export function buildProvenance(rows: LabeledBandRow[]): ProvenanceRollup {
  const acc = (
    keyOf: (r: LabeledBandRow) => string,
    labelOf: (k: string) => string,
  ): ProvenanceSlice[] => {
    const m = new Map<string, { seats: number; rows: number }>();
    for (const r of rows) {
      const k = keyOf(r);
      const cur = m.get(k) ?? { seats: 0, rows: 0 };
      cur.seats += r.band_mid;
      cur.rows += 1;
      m.set(k, cur);
    }
    return [...m.entries()]
      .map(([key, v]) => ({
        key,
        label: labelOf(key),
        seats_mass: v.seats,
        rows: v.rows,
      }))
      .sort((a, b) => b.seats_mass - a.seats_mass);
  };

  return {
    by_unit: acc(
      (r) => r.unit_counted,
      (k) => UNIT_COUNTED_LABELS[k as UnitCounted] ?? k,
    ),
    by_confidence: acc(
      (r) => r.confidence,
      (k) => `Labeler confidence: ${k}`,
    ),
    by_audited: acc(
      (r) => (r.audited ? "audited" : "labeled"),
      (k) =>
        k === "audited"
          ? "Hand-audited (100% of 10k+ bands)"
          : "LLM-labeled, sampled",
    ),
  };
}

/**
 * The correction waterfall. `naiveSum` is the historical all-rows
 * band-midpoint sum (from seats.ts); each step's delta is derived from
 * the labeled data so the chart always reconciles exactly.
 */
export function buildWaterfall(
  naiveSum: number,
  source: SeatModelSourceData,
  totals: SeatModelTotals,
): WaterfallStep[] {
  const steps: WaterfallStep[] = [];
  let running = naiveSum;

  steps.push({
    key: "naive",
    label: "Sum of every filed band (uncorrected)",
    value: running,
    delta: 0,
    kind: "start",
    note:
      "One entry per task row: the same employees counted once per task, " +
      "plus devices, public users, and case counts.",
  });

  const order = [
    "unit:devices_endpoints",
    "unit:public_users",
    "unit:applicants_cases",
    "excluded_stratum",
  ];
  for (const key of order) {
    const slice = source.corrections.find((c) => c.key === key);
    if (!slice || slice.seats_mass === 0) continue;
    running -= slice.seats_mass;
    steps.push({
      key,
      label: `Remove: ${slice.label.toLowerCase()}`,
      value: running,
      delta: -slice.seats_mass,
      kind: "deduction",
      note: `${slice.rows} rows whose band counts ${slice.label.toLowerCase()}, not employee seats.`,
    });
  }

  // Dedup: within each agency-stratum only the largest band survives
  // (same population, many task rows). Delta = remainder between the
  // post-exclusion running total and the sum of stratum maxima.
  const stratumMaxSum = source.inputs.reduce((total, agency) => {
    const maxPerStratum = new Map<string, number>();
    for (const r of agency.reaches) {
      maxPerStratum.set(
        r.stratum,
        Math.max(maxPerStratum.get(r.stratum) ?? 0, r.band_mid),
      );
    }
    return (
      total + [...maxPerStratum.values()].reduce((a, b) => a + b, 0)
    );
  }, 0);
  const dedupDelta = stratumMaxSum - running;
  running = stratumMaxSum;
  steps.push({
    key: "dedup",
    label: "Count each population once (max band per stratum)",
    value: running,
    delta: dedupDelta,
    kind: "deduction",
    note:
      "Within an agency, general chat tools all reach the same people — " +
      "the largest filed band stands in for the stratum; task-row repeats " +
      "and multi-tool overlap collapse.",
  });

  const overlapDelta = totals.central - running;
  running = totals.central;
  steps.push({
    key: "model",
    label: "Cap at each agency's eligible workforce + overlap model",
    value: running,
    delta: overlapDelta,
    kind: "result",
    note:
      "Shares of the AI-eligible workforce combined by independence " +
      "across strata; occupation caps bind role tools (developers, " +
      "attorneys). No agency exceeds its own headcount.",
  });

  return steps;
}

/**
 * The stratified-overlap seat model — pure TS, no DB import.
 *
 * Inputs are per-agency banded rows carrying population labels from the
 * band_labels_2026-07 pass (assembled by strata.ts). The model turns
 * "what agencies filed" into "how many people plausibly have >=1 AI
 * tool" with three stateable rules:
 *
 *  1. Same-population tools combine by MAX. All rows in a stratum target
 *     the same people (ChatGPT + Gemini + Copilot all reach the same
 *     office population), so a stratum's reach is its largest band —
 *     never a sum.
 *  2. Different-population strata combine by independence. A developer
 *     with GitHub Copilot is assumed to hold the general chat tool at the
 *     same rate as everyone else: union = eligible x (1 - PROD(1 - share_s)).
 *  3. Everything is a share of the eligible workforce, capped by FedScope
 *     occupation counts for role strata — so no agency can exceed its
 *     own headcount, structurally.
 *
 * Bounds: floor = largest single stratum at band-lower (assumes bespoke
 * users all nest inside the general population); ceiling = min(sum of
 * capped stratum uppers, eligible) (assumes fully disjoint strata).
 */

import {
  type AgencySeatModel,
  type AgencySeatModelInput,
  type SeatModelScenario,
  type SeatModelTotals,
  type StratumReachInput,
  type StratumResult,
  DEFAULT_SCENARIO,
} from "../../experience-shared";

function bandValue(
  r: StratumReachInput,
  band: SeatModelScenario["band"],
): number {
  switch (band) {
    case "lower":
      return r.band_lower;
    case "mid":
      return r.band_mid;
    case "upper":
      return r.band_upper;
  }
}

function filterRows(
  rows: StratumReachInput[],
  scenario: SeatModelScenario,
): StratumReachInput[] {
  return rows.filter((r) => {
    if (scenario.dropLowConfidence && r.confidence === "low") return false;
    if (!scenario.includeClinical && r.stratum === "clinical") return false;
    return true;
  });
}

/** MAX row per stratum at a given band end; carries the winning row. */
function stratumMax(
  rows: StratumReachInput[],
  band: SeatModelScenario["band"],
): Map<string, { value: number; winner: StratumReachInput; rows: number }> {
  const out = new Map<
    string,
    { value: number; winner: StratumReachInput; rows: number }
  >();
  for (const r of rows) {
    const v = bandValue(r, band);
    const cur = out.get(r.stratum);
    if (!cur) {
      out.set(r.stratum, { value: v, winner: r, rows: 1 });
    } else {
      cur.rows += 1;
      if (v > cur.value) {
        cur.value = v;
        cur.winner = r;
      }
    }
  }
  return out;
}

export function computeAgencySeatModel(
  input: AgencySeatModelInput,
  scenario: SeatModelScenario = DEFAULT_SCENARIO,
): AgencySeatModel {
  const rows = filterRows(input.reaches, scenario);
  const rawLower = rows.reduce((m, r) => Math.max(m, r.band_lower), 0);
  const rawUpper = rows.reduce((a, r) => a + r.band_upper, 0);

  const base: Omit<
    AgencySeatModel,
    "modeled" | "strata" | "floor" | "central" | "ceiling" | "coverage_share"
  > = {
    agency_id: input.agency_id,
    abbreviation: input.abbreviation,
    name: input.name,
    eligible: input.eligible,
    total_headcount: input.total_headcount,
    contractor_headcount: input.contractor_headcount,
    denominator_basis: input.denominator_basis,
    headcount_as_of: input.headcount_as_of,
    headcount_source_url: input.headcount_source_url,
    headcount_source_title: input.headcount_source_title,
    workforce_captured_at: input.workforce_captured_at,
    raw_band_lower: rawLower,
    raw_band_upper: rawUpper,
  };

  if (input.eligible == null || input.eligible <= 0 || rows.length === 0) {
    return {
      ...base,
      modeled: false,
      strata: [],
      floor: null,
      central: null,
      ceiling: null,
      coverage_share: null,
    };
  }
  const eligible = input.eligible;

  const atScenario = stratumMax(rows, scenario.band);
  const atLower = stratumMax(rows, "lower");
  const atUpper = stratumMax(rows, "upper");

  const strata: StratumResult[] = [];
  let logNone = 0;
  for (const [stratum, { value, winner, rows: n }] of atScenario) {
    const occCap =
      input.stratum_caps[stratum as StratumResult["stratum"]] ?? null;
    const cap = Math.min(eligible, occCap ?? eligible);
    const capped = Math.min(value, cap);
    const share = eligible > 0 ? capped / eligible : 0;
    // Saturated: even the band's LOWER end covers >=95% of the ceiling.
    const lowerVal = atLower.get(stratum)?.value ?? 0;
    const saturated = cap > 0 && Math.min(lowerVal, cap) >= 0.95 * cap;
    strata.push({
      stratum: stratum as StratumResult["stratum"],
      reach: value,
      cap,
      share,
      saturated,
      winning_family: winner.family,
      winning_slug: winner.slug,
      winning_band_label: winner.band_label,
      rows: n,
    });
    // PROD(1 - share) accumulated in log space; clamp so a fully-saturated
    // stratum yields coverage ~= 1 without -Infinity.
    logNone += Math.log(1 - Math.min(share, 0.999));
  }
  strata.sort((a, b) => b.reach - a.reach);

  const central = Math.round(eligible * (1 - Math.exp(logNone)));
  const floor = Math.min(
    eligible,
    Math.max(
      0,
      ...[...atLower.entries()].map(([s, { value }]) => {
        const occCap = input.stratum_caps[s as StratumResult["stratum"]];
        return Math.min(value, Math.min(eligible, occCap ?? eligible));
      }),
    ),
  );
  const ceilingSum = [...atUpper.entries()].reduce((a, [s, { value }]) => {
    const occCap = input.stratum_caps[s as StratumResult["stratum"]];
    return a + Math.min(value, Math.min(eligible, occCap ?? eligible));
  }, 0);
  const ceiling = Math.min(ceilingSum, eligible);

  return {
    ...base,
    modeled: true,
    strata,
    floor,
    central: Math.min(central, eligible),
    ceiling,
    coverage_share: eligible > 0 ? Math.min(central, eligible) / eligible : null,
  };
}

export function computeSeatModel(
  inputs: AgencySeatModelInput[],
  scenario: SeatModelScenario = DEFAULT_SCENARIO,
): { agencies: AgencySeatModel[]; totals: SeatModelTotals } {
  const agencies = inputs
    .map((i) => computeAgencySeatModel(i, scenario))
    .sort((a, b) => (b.central ?? 0) - (a.central ?? 0));
  const modeled = agencies.filter((a) => a.modeled);
  const totals: SeatModelTotals = {
    agencies_total: agencies.length,
    agencies_modeled: modeled.length,
    eligible_total: modeled.reduce((a, r) => a + (r.eligible ?? 0), 0),
    floor: modeled.reduce((a, r) => a + (r.floor ?? 0), 0),
    central: modeled.reduce((a, r) => a + (r.central ?? 0), 0),
    ceiling: modeled.reduce((a, r) => a + (r.ceiling ?? 0), 0),
  };
  return { agencies, totals };
}

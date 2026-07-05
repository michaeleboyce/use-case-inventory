import {
  buildProvenance,
  buildWaterfall,
  computeSeatModel,
  getAgencyToolMatrix,
  getCapabilityLadder,
  getEnterpriseTierRollup,
  getGenAiHeadlines,
  getGenAiTimeline,
  getOmbIfpCrosstab,
  getSeatExtrapolationByAgency,
  getStratifiedSeatInputs,
  getYearCompareGenAi,
} from "@/lib/db";
import {
  DEFAULT_SCENARIO,
  type SeatModelScenario,
} from "@/lib/experience-shared";

/** Fixed scenario set for the sensitivity view (server-computed). */
const SENSITIVITY_SCENARIOS: Array<{ label: string; scenario: SeatModelScenario }> = [
  { label: "Central (band midpoints)", scenario: DEFAULT_SCENARIO },
  { label: "Band lower ends", scenario: { ...DEFAULT_SCENARIO, band: "lower" } },
  { label: "Band upper ends", scenario: { ...DEFAULT_SCENARIO, band: "upper" } },
  {
    label: "Drop low-confidence labels",
    scenario: { ...DEFAULT_SCENARIO, dropLowConfidence: true },
  },
  {
    label: "Exclude clinical stratum",
    scenario: { ...DEFAULT_SCENARIO, includeClinical: false },
  },
];

export async function buildExperienceViewModel() {
  const headlines = getGenAiHeadlines();
  const crosstab = getOmbIfpCrosstab();
  const timeline = getGenAiTimeline();
  const seats = getSeatExtrapolationByAgency();
  const matrix = getAgencyToolMatrix();
  const yearCompare = getYearCompareGenAi();
  const ladder = getCapabilityLadder();
  const enterpriseTiers = getEnterpriseTierRollup();

  // Historical naive estimate — kept as "what the raw filings imply" and
  // as the waterfall's starting bar. Never the headline again.
  const totalSeatsMidpoint = seats.reduce((a, r) => a + r.midpoint, 0);
  const totalSeatsLower = seats.reduce((a, r) => a + r.lower_bound, 0);
  const totalSeatsUpper = seats.reduce((a, r) => a + r.upper_bound, 0);

  // Stratified-overlap model (band_labels_2026-07 pass).
  const seatSource = getStratifiedSeatInputs();
  const seatModel = computeSeatModel(seatSource.inputs);
  const waterfall = buildWaterfall(
    totalSeatsMidpoint,
    seatSource,
    seatModel.totals,
  );
  const provenance = buildProvenance(seatSource.rows);
  const sensitivity = SENSITIVITY_SCENARIOS.map(({ label, scenario }) => {
    const { totals } = computeSeatModel(seatSource.inputs, scenario);
    return { label, ...totals };
  });

  // Estimator scatter: each modeled agency's naive filed-band midpoint sum
  // (from the uncorrected `seats` rows, matched by agency_id) against the
  // stratified-overlap model's central estimate. Only modeled agencies —
  // an agency needs a workforce denominator to have a model central.
  const naiveByAgency = new Map(seats.map((s) => [s.agency_id, s.midpoint]));
  const scatter = seatModel.agencies
    .filter(
      (a): a is typeof a & { central: number; eligible: number } =>
        a.modeled && a.central != null && a.eligible != null,
    )
    .map((a) => ({
      abbreviation: a.abbreviation,
      name: a.name,
      naive: naiveByAgency.get(a.agency_id) ?? 0,
      model: a.central,
      eligible: a.eligible,
    }));

  return {
    headlines,
    crosstab,
    timeline,
    seats,
    matrix,
    yearCompare,
    ladder,
    enterpriseTiers,
    totalSeatsMidpoint,
    totalSeatsLower,
    totalSeatsUpper,
    seatModel,
    seatSource,
    waterfall,
    provenance,
    sensitivity,
    scatter,
  };
}

export type ExperienceViewModel = Awaited<
  ReturnType<typeof buildExperienceViewModel>
>;

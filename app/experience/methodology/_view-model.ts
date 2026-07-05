/**
 * View model for /experience/methodology — the seat-model methodology page.
 *
 * Reuses the same lib/db functions as the /experience page so every number
 * on the methodology page reconciles exactly with the headline it documents.
 * Adds a few derived process statistics (audit coverage, seat-mass
 * concentration in the large bands) so the labeling-pass narrative stays
 * data-driven rather than hand-typed.
 */

import {
  buildProvenance,
  buildWaterfall,
  computeSeatModel,
  getSeatExtrapolationByAgency,
  getStratifiedSeatInputs,
} from "@/lib/db";
import {
  DEFAULT_SCENARIO,
  type AgencySeatModel,
  type SeatModelScenario,
} from "@/lib/experience-shared";

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

/** A band label is "large" (≥10k) when its lower end is at least 10,000. */
const LARGE_BAND_FLOOR = 10000;

export async function buildMethodologyViewModel() {
  const seatSource = getStratifiedSeatInputs();
  const { agencies, totals } = computeSeatModel(seatSource.inputs);

  const seats = getSeatExtrapolationByAgency();
  const naiveSum = seats.reduce((a, r) => a + r.midpoint, 0);
  const waterfall = buildWaterfall(naiveSum, seatSource, totals);
  const provenance = buildProvenance(seatSource.rows);

  const sensitivity = SENSITIVITY_SCENARIOS.map(({ label, scenario }) => {
    const { totals: t } = computeSeatModel(seatSource.inputs, scenario);
    return { label, ...t };
  });

  // Process statistics for the labeling-pass narrative, derived from the
  // labeled rows so they never drift from the data.
  const rows = seatSource.rows;
  const totalLabeled = rows.length;
  const auditedCount = rows.filter((r) => r.audited === 1).length;
  const totalMass = rows.reduce((a, r) => a + r.band_mid, 0);
  const largeBandRows = rows.filter((r) => r.band_lower >= LARGE_BAND_FLOOR);
  const largeBandCount = largeBandRows.length;
  const largeBandMass = largeBandRows.reduce((a, r) => a + r.band_mid, 0);
  const largeBandMassShare =
    totalMass > 0 ? Math.round((largeBandMass / totalMass) * 100) : 0;

  // Worked example: DHS's saturated general stratum tells the model story
  // cleanly. Fall back to the largest modeled agency if DHS isn't present.
  const modeled = agencies.filter((a) => a.modeled);
  const exemplar: AgencySeatModel | null =
    modeled.find((a) => a.abbreviation === "DHS") ?? modeled[0] ?? null;

  return {
    seatSource,
    agencies,
    totals,
    naiveSum,
    waterfall,
    provenance,
    sensitivity,
    labeling: {
      totalLabeled,
      auditedCount,
      largeBandCount,
      largeBandMassShare,
    },
    exemplar,
  };
}

export type MethodologyViewModel = Awaited<
  ReturnType<typeof buildMethodologyViewModel>
>;

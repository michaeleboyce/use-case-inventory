/**
 * View model for /experience/seats/[slug] — one agency's corrected seat
 * model. slug is the lowercased agency abbreviation.
 *
 * Reuses the stratified-overlap model so the per-agency floor/central/ceiling
 * reconciles with the /experience headline. Adds this agency's labeled band
 * rows and its researched AI-access rollout evidence.
 */

import {
  computeSeatModel,
  getAgencyAiAccessEvidence,
  getAgencyOccupationCaps,
  getStratifiedSeatInputs,
} from "@/lib/db";
import type { OccupationCapRow } from "@/lib/db";
import type {
  AgencySeatModel,
  AgencySeatModelInput,
} from "@/lib/experience-shared";
import type { LabeledBandRow } from "@/lib/db";
import type { AgencyAiAccessRow } from "@/lib/types";

export interface AgencySeatPageData {
  agency: AgencySeatModel;
  input: AgencySeatModelInput | null;
  /** This agency's labeled band rows (model inputs + excluded). */
  rows: LabeledBandRow[];
  /** Researched rollout evidence for this agency, if any. */
  access: AgencyAiAccessRow[];
  /** eligible / denominator base (contractor-aware), or null. */
  eligibleShare: number | null;
  /** Denominator base actually used (headcount, contractor-aware). */
  denominatorBase: number | null;
  /** FedScope-successor occupational ceilings for this agency, with sources. */
  occupationCaps: OccupationCapRow[];
}

/** Lowercased abbreviations of every modeled agency — for generateStaticParams. */
export function getModeledAgencySlugs(): string[] {
  const { agencies } = computeSeatModel(getStratifiedSeatInputs().inputs);
  return agencies
    .filter((a) => a.modeled)
    .map((a) => a.abbreviation.toLowerCase());
}

export async function buildAgencySeatViewModel(
  slug: string,
): Promise<AgencySeatPageData | null> {
  const seatSource = getStratifiedSeatInputs();
  const { agencies } = computeSeatModel(seatSource.inputs);

  const target = slug.toLowerCase();
  const agency = agencies.find(
    (a) => a.modeled && a.abbreviation.toLowerCase() === target,
  );
  if (!agency) return null;

  const input =
    seatSource.inputs.find((i) => i.agency_id === agency.agency_id) ?? null;
  const rows = seatSource.rows.filter((r) => r.agency_id === agency.agency_id);
  const access = getAgencyAiAccessEvidence().filter(
    (e) =>
      e.agency_id === agency.agency_id ||
      e.agency_abbreviation.toLowerCase() === target,
  );

  // Contractor-aware denominator base for the eligible-share display.
  const denominatorBase =
    input == null
      ? agency.total_headcount
      : input.denominator_basis === "incl_contractors"
        ? (input.total_headcount ?? 0) + (input.contractor_headcount ?? 0)
        : (input.total_headcount ?? 0);
  const eligibleShare =
    agency.eligible != null && denominatorBase && denominatorBase > 0
      ? agency.eligible / denominatorBase
      : null;

  const occupationCaps = getAgencyOccupationCaps(agency.agency_id);

  return {
    agency,
    input,
    rows,
    access,
    eligibleShare,
    denominatorBase,
    occupationCaps,
  };
}

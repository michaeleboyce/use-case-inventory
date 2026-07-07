// app/adoption/_view-model.ts — server-side data shaping for /adoption.

import { getGenAiAdoptionSeries } from "@/lib/db/adoption";
import { ADOPTION_SERIES } from "@/lib/data/adoption-series";
import type { AdoptionSeries, GenAiCycleStats } from "@/lib/types/adoption";

export interface AdoptionViewModel {
  /** Checked-in external baseline series (lib/data/adoption-series.ts). */
  series: AdoptionSeries[];
  /** Live per-cycle GenAI stats from the inventory DB, oldest first. */
  genai: GenAiCycleStats[];
}

export async function buildAdoptionViewModel(): Promise<AdoptionViewModel> {
  return {
    series: ADOPTION_SERIES,
    genai: getGenAiAdoptionSeries(),
  };
}

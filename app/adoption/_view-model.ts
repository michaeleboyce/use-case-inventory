// app/adoption/_view-model.ts — server-side data shaping for /adoption.

import {
  getCloudCfoAtoSeries,
  getFederalLlmAccessBullishSeries,
  getFederalLlmAccessSeries,
  getGenAiAdoptionSeries,
} from "@/lib/db/adoption";
import { ADOPTION_SERIES } from "@/lib/data/adoption-series";
import type { AdoptionSeries, GenAiCycleStats } from "@/lib/types/adoption";

export interface AdoptionViewModel {
  /** Checked-in external baselines + the two live DB-derived federal series
   *  (cloud CFO Act ATOs, LLM-access corroborated floor). */
  series: AdoptionSeries[];
  /** Live per-cycle GenAI stats from the inventory DB, oldest first. */
  genai: GenAiCycleStats[];
}

/** Baselines + live series; shared by the page and the /figures twin. */
export function assembleAdoptionSeries(): AdoptionSeries[] {
  const live = [
    getCloudCfoAtoSeries(),
    getFederalLlmAccessSeries(),
    getFederalLlmAccessBullishSeries(),
  ].filter((s): s is AdoptionSeries => s !== null);
  return [...ADOPTION_SERIES, ...live];
}

export async function buildAdoptionViewModel(): Promise<AdoptionViewModel> {
  return {
    series: assembleAdoptionSeries(),
    genai: getGenAiAdoptionSeries(),
  };
}

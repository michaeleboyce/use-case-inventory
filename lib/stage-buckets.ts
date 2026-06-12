/**
 * Single source for 2024 `dev_stage` bucketing.
 *
 * Two representations live here on purpose:
 *
 *  - the EXACT canonical stage strings (post `column_maps_2024.
 *    DEV_STAGE_RECODE_2024` recode) used to build SQL CASE/IN clauses in
 *    `lib/db/year-comparison.ts`;
 *  - the substring-matching `stageBucket()` / `liveStageRank()` helpers the
 *    UI uses for chips and Deployed-first ordering (tolerant of unrecoded
 *    variants).
 *
 * Pure module — safe to import from client components; must never import
 * from `lib/db`.
 */

/** Canonical 2024 stages that count as deployed in the stage-mix rollup. */
export const DEPLOYED_STAGES_2024 = [
  "Operation and Maintenance",
  "In production",
  "In mission",
] as const;

/** Canonical 2024 pilot stage. */
export const PILOT_STAGES_2024 = ["Implementation and Assessment"] as const;

/** Canonical 2024 pre-deployment stages. */
export const PRE_DEPLOYMENT_STAGES_2024 = [
  "Acquisition and/or Development",
  "Planned",
  "Initiated",
  "Ideation",
  "Research or  Administrative Action Complete",
] as const;

/**
 * 2024 stages that count as a *live* capability for the silently-dropped
 * GenAI callout — production/implementation, not planning or research.
 */
export const LIVE_DEV_STAGES_2024 = [
  "Operation and Maintenance",
  "Implementation and Assessment",
  "In production",
  "Full operation",
] as const;

export type StageBucket = "Deployed" | "Pilot" | "Pre-deployment" | "Retired";

/** Bucket a raw `dev_stage` string into the four high-level deployment
 *  buckets the compare-years pages use for chips and sorting. Substring
 *  match so unrecoded variants still land in the right bucket. */
export function stageBucket(devStage: string | null | undefined): StageBucket {
  const s = (devStage ?? "").toLowerCase();
  if (s.includes("retired")) return "Retired";
  if (
    s.includes("operation") ||
    s.includes("production") ||
    s.includes("mission")
  ) {
    return "Deployed";
  }
  if (s.includes("implementation") || s.includes("assessment")) {
    return "Pilot";
  }
  return "Pre-deployment";
}

/** Deployed (2) > Pilot (1) > everything else (0) — for Deployed-first
 *  ordering of rows within a group or agency. */
export function liveStageRank(devStage: string | null | undefined): number {
  switch (stageBucket(devStage)) {
    case "Deployed":
      return 2;
    case "Pilot":
      return 1;
    default:
      return 0;
  }
}

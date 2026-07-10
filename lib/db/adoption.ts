// lib/db/adoption.ts
//
// Live GenAI-adoption series for the /adoption comparison page: per-cycle
// counts computed from the inventory tables so the page tracks every DB
// rebuild instead of hard-coding the fact-sheet numbers.
//
// Population discipline (see the ETL "population-attribution trap"): all
// counts here are INDIVIDUAL use cases only — 2025 tag rows are filtered to
// `use_case_id IS NOT NULL` so the 2024↔2025 comparison is like-for-like
// (the 900-row consolidated/Appendix-B grid has no 2024 counterpart).

import { DEPLOYED_STAGES_2024 } from "../stage-buckets";
import { getDb } from "./shared/init";
import type { AdoptionSeries, GenAiCycleStats } from "../types/adoption";

const DEPLOYED_2024_SQL = DEPLOYED_STAGES_2024.map((s) => `'${s}'`).join(", ");

/**
 * One row per inventory cycle (2024, 2025), oldest first:
 *   total_use_cases            — individually filed use cases
 *   genai_use_cases            — IFP-tagged generative AI
 *   deployed_genai             — GenAI in a deployed stage
 *   enterprise_genai_agencies  — agencies with ≥1 enterprise-wide GenAI entry
 */
export function getGenAiAdoptionSeries(): GenAiCycleStats[] {
  const db = getDb();

  const row2024 = db
    .prepare<[], Omit<GenAiCycleStats, "inventory_year">>(`
      SELECT
        (SELECT COUNT(*) FROM use_cases_2024) AS total_use_cases,
        COALESCE(SUM(c.is_generative_ai), 0) AS genai_use_cases,
        COALESCE(SUM(CASE WHEN c.is_generative_ai = 1
                       AND u.dev_stage IN (${DEPLOYED_2024_SQL})
                     THEN 1 ELSE 0 END), 0) AS deployed_genai,
        COUNT(DISTINCT CASE WHEN c.is_generative_ai = 1
                         AND c.is_enterprise_wide = 1
                       THEN u.agency_id END) AS enterprise_genai_agencies
      FROM use_case_tags_2024_canonical c
      JOIN use_cases_2024 u ON u.id = c.use_case_id_2024
    `)
    .get()!;

  const row2025 = db
    .prepare<[], Omit<GenAiCycleStats, "inventory_year">>(`
      SELECT
        (SELECT COUNT(*) FROM use_cases) AS total_use_cases,
        COALESCE(SUM(t.is_generative_ai), 0) AS genai_use_cases,
        COALESCE(SUM(CASE WHEN t.is_generative_ai = 1
                       AND u.stage_normalized = 'deployed'
                     THEN 1 ELSE 0 END), 0) AS deployed_genai,
        COUNT(DISTINCT CASE WHEN t.is_generative_ai = 1
                         AND t.is_enterprise_wide = 1
                       THEN u.agency_id END) AS enterprise_genai_agencies
      FROM use_case_tags t
      JOIN use_cases u ON u.id = t.use_case_id
      WHERE t.use_case_id IS NOT NULL
    `)
    .get()!;

  return [
    { inventory_year: 2024, ...row2024 },
    { inventory_year: 2025, ...row2025 },
  ];
}

/**
 * Federal cloud adoption on the % axis: share of the 24 CFO Act agencies
 * holding ≥1 agency ATO on a currently-FedRAMP-authorized cloud service by
 * date T, re-based to the FedRAMP policy memo. A FLOOR by construction —
 * the marketplace snapshot only records services authorized today, so a
 * service that was authorized and later withdrew never counts.
 *
 * Returns null when the FedRAMP tables are absent from this DB build.
 */
export function getCloudCfoAtoSeries(): AdoptionSeries | null {
  let rows: Array<{ first_ato: string }>;
  let denominator: number;
  try {
    const db = getDb();
    denominator =
      db
        .prepare<[], { n: number }>(
          `SELECT COUNT(*) AS n FROM agencies WHERE agency_type = 'CFO_ACT'`,
        )
        .get()?.n ?? 0;
    rows = db
      .prepare<[], { first_ato: string }>(`
        SELECT MIN(a.ato_issuance_date) AS first_ato
          FROM fedramp_authorizations a
          JOIN fedramp_agency_links al ON al.fedramp_agency_id = a.agency_id
          JOIN agencies ag ON ag.id = al.inventory_agency_id
         WHERE ag.agency_type = 'CFO_ACT'
           AND a.ato_issuance_date >= '2010-01-01'
         GROUP BY al.inventory_agency_id
         ORDER BY first_ato
      `)
      .all();
  } catch {
    return null;
  }
  if (denominator === 0 || rows.length === 0) return null;

  const points = rows.map((r, i) => ({
    date: r.first_ato,
    value: Math.round(((i + 1) / denominator) * 1000) / 10,
  }));

  return {
    id: "cloud-cfo-ato",
    label: "Federal cloud (agency ATOs)",
    population: `The ${denominator} CFO Act agencies`,
    metric:
      "Share of CFO Act agencies holding ≥1 agency ATO on a FedRAMP-authorized cloud service (floor: current-marketplace snapshot only)",
    unit: "percent",
    start: { date: "2011-12-08", label: "FedRAMP policy memo (post Cloud First, 2010-12-09)" },
    introduced: { date: "2006-08-25", label: "commercial IaaS in use (AWS EC2 public beta)" },
    driver: "federal mandate",
    source: {
      title: "IFP analysis of the FedRAMP marketplace snapshot",
      url: "https://use-case-inventory.vercel.app/fedramp/marketplace",
      accessed: "2026-06-12",
      note: "First agency-ATO issuance date per CFO Act agency; withdrawn services absent from the snapshot are not counted (floor).",
    },
    points: [{ date: "2011-12-08", value: 0 }, ...points],
  };
}

/**
 * Federal LLM access on the % axis: cumulative share of the AI-eligible
 * workforce (across all IFP-profiled agencies) at agencies with dated,
 * web-corroborated GenAI-rollout evidence — each agency weighted by its
 * best corroborated share as of T. A FLOOR by construction: evidence dates
 * lag rollouts, tier-only (non-corroborated) agencies contribute zero, and
 * the denominator includes every profiled agency. Clock starts at the
 * ChatGPT release so the mandate's arrival (+2.6y) reads on the same axis.
 *
 * Returns null when the evidence or workforce sidecars are absent.
 */
export function getFederalLlmAccessSeries(): AdoptionSeries | null {
  return buildLlmAccessSeries("floor");
}

/**
 * The bullish reading of the same evidence: once an agency has ANY dated,
 * web-corroborated rollout evidence, its FULL AI-eligible workforce counts
 * as having access ("the tool is available at your agency"). User-level
 * share estimates are deliberately ignored; corroborated rows without a
 * share estimate still count. Same clock and denominator as the floor.
 */
export function getFederalLlmAccessBullishSeries(): AdoptionSeries | null {
  return buildLlmAccessSeries("bullish");
}

function buildLlmAccessSeries(
  variant: "floor" | "bullish",
): AdoptionSeries | null {
  let anchors: Array<{
    agency_abbreviation: string;
    source_date: string;
    share: number | null;
  }>;
  let workforce: Array<{ abbreviation: string; eligible: number }>;
  try {
    const db = getDb();
    anchors = db
      .prepare<[], { agency_abbreviation: string; source_date: string; share: number | null }>(`
        SELECT agency_abbreviation, source_date,
               estimated_share_of_eligible AS share
          FROM agency_ai_access_evidence
         WHERE status = 'corroborated'
           AND source_date IS NOT NULL
         ORDER BY source_date
      `)
      .all();
    workforce = db
      .prepare<[], { abbreviation: string; eligible: number }>(`
        SELECT a.abbreviation,
               CAST(ROUND((CASE WHEN w.denominator_basis = 'incl_contractors'
                             THEN w.total_headcount + COALESCE(w.contractor_headcount, 0)
                             ELSE w.total_headcount END) * w.ai_eligible_share) AS INTEGER)
                 AS eligible
          FROM agency_workforce_profile w
          JOIN agencies a ON a.id = w.agency_id
         WHERE w.level = 'agency'
           AND w.total_headcount IS NOT NULL
           AND w.ai_eligible_share IS NOT NULL
           AND a.abbreviation IS NOT NULL
      `)
      .all();
  } catch {
    return null;
  }
  if (anchors.length === 0 || workforce.length === 0) return null;

  const eligibleByAbbr = new Map(
    workforce.map((w) => [w.abbreviation, w.eligible]),
  );
  const totalEligible = workforce.reduce((a, w) => a + w.eligible, 0);
  if (totalEligible === 0) return null;

  // Walk anchors in date order, keeping each agency's best weight so far;
  // emit one point per date where the covered-worker sum moves. Floor:
  // weight = best corroborated share (rows without a share estimate are
  // skipped). Bullish: weight = 1 on the agency's first corroborated row.
  const bestWeight = new Map<string, number>();
  const points: Array<{ date: string; value: number }> = [
    { date: "2022-11-30", value: 0 },
  ];
  let covered = 0;
  for (const a of anchors) {
    const eligible = eligibleByAbbr.get(a.agency_abbreviation);
    if (eligible == null) continue;
    const weight = variant === "bullish" ? 1 : a.share;
    if (weight == null) continue;
    const prev = bestWeight.get(a.agency_abbreviation) ?? 0;
    if (weight <= prev) continue;
    bestWeight.set(a.agency_abbreviation, weight);
    covered += eligible * (weight - prev);
    const value = Math.round((covered / totalEligible) * 1000) / 10;
    const last = points[points.length - 1];
    if (last.date === a.source_date) last.value = value;
    else points.push({ date: a.source_date, value });
  }
  if (points.length < 2) return null;

  const floor = variant === "floor";
  return {
    id: floor ? "federal-llm-access" : "federal-llm-access-bullish",
    label: floor
      ? "Federal LLM access (corroborated floor)"
      : "Federal LLM access (bullish: agency availability)",
    population: "AI-eligible workers at IFP-profiled agencies",
    metric: floor
      ? "Cumulative share of AI-eligible federal workers at agencies with dated, web-corroborated GenAI rollout evidence, weighted by each agency's best corroborated share of eligible staff (floor: tier-only agencies count as zero)"
      : "Cumulative share of AI-eligible federal workers at agencies with ≥1 dated, web-corroborated GenAI rollout — full eligible workforce counted from the agency's first corroborated evidence (bullish: availability, not measured use)",
    unit: "percent",
    start: {
      date: "2022-11-30",
      label: "ChatGPT released (LLM-access mandate follows at +2.6y)",
    },
    driver: "federal mandate",
    source: {
      title: "IFP web-corroborated agency access evidence",
      url: "https://use-case-inventory.vercel.app/experience",
      accessed: "2026-06-12",
      note: "Evidence publication dates lag actual rollouts; IFP assessments, not OMB data.",
    },
    points,
  };
}

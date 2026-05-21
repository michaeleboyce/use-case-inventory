/**
 * AI Access & Scale queries — the `agency_ai_access_evidence` table.
 *
 * Researched public evidence of how widely each CFO Act agency has made a
 * general-purpose AI tool available to its workforce. `coverage_assessment`
 * is an AVAILABILITY measure (who can use the tool), not active usage.
 * Backs the /readiness/access route. Source table populated by the ETL's
 * scripts/apply_ai_access_evidence.py (migration m008).
 */

import { getDb } from "./shared/init";
import type {
  AgencyAiAccessCoverage,
  AgencyAiAccessRow,
  AiAccessSummary,
} from "../types";

// Availability-tier sort order — most-available first.
const COVERAGE_RANK: Record<string, number> = {
  all: 1,
  most: 2,
  partial: 3,
  pilot: 4,
  unknown: 5,
  none: 6,
};

const COVERAGE_VALUES: AgencyAiAccessCoverage[] = [
  "all",
  "most",
  "partial",
  "pilot",
  "unknown",
  "none",
];

/** Every researched finding, joined to the agency, ordered by availability
 *  tier then agency abbreviation. */
export function getAgencyAiAccessEvidence(): AgencyAiAccessRow[] {
  const rows = getDb()
    .prepare<[], AgencyAiAccessRow>(
      `SELECT e.id,
              e.agency_id,
              e.agency_abbreviation,
              a.name AS agency_name,
              e.tool_name,
              e.finding,
              e.estimated_users,
              e.coverage_assessment,
              e.exact_quote,
              e.source_url,
              e.source_title,
              e.source_date,
              e.source_type,
              e.confidence,
              e.status,
              e.notes,
              e.captured_at
         FROM agency_ai_access_evidence e
         LEFT JOIN agencies a ON a.id = e.agency_id`,
    )
    .all();

  return rows.sort((x, y) => {
    const rx = COVERAGE_RANK[x.coverage_assessment ?? "unknown"] ?? 5;
    const ry = COVERAGE_RANK[y.coverage_assessment ?? "unknown"] ?? 5;
    if (rx !== ry) return rx - ry;
    return x.agency_abbreviation.localeCompare(y.agency_abbreviation);
  });
}

/** Coverage rollup for the /readiness/access header and the /readiness teaser.
 *  `by_coverage` counts DISTINCT agencies at each agency's BEST (most
 *  available) coverage tier — so an agency with both an `all` tool and a
 *  `none` tool counts once, under `all`. */
export function getAiAccessSummary(): AiAccessSummary {
  const rows = getAgencyAiAccessEvidence();

  const bestByAgency = new Map<string, number>();
  let computed_at: string | null = null;
  let corroborated = 0;
  let searched_no_source = 0;

  for (const r of rows) {
    if (r.status === "corroborated") corroborated += 1;
    else searched_no_source += 1;
    if (!computed_at || r.captured_at > computed_at) computed_at = r.captured_at;

    const rank = COVERAGE_RANK[r.coverage_assessment ?? "unknown"] ?? 5;
    const prev = bestByAgency.get(r.agency_abbreviation);
    if (prev === undefined || rank < prev) {
      bestByAgency.set(r.agency_abbreviation, rank);
    }
  }

  const by_coverage = Object.fromEntries(
    COVERAGE_VALUES.map((v) => [v, 0]),
  ) as Record<AgencyAiAccessCoverage, number>;
  for (const rank of bestByAgency.values()) {
    const tier = COVERAGE_VALUES[rank - 1];
    if (tier) by_coverage[tier] += 1;
  }

  return {
    total_agencies: bestByAgency.size,
    by_coverage,
    corroborated_findings: corroborated,
    searched_no_source,
    computed_at,
  };
}

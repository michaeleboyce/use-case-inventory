/**
 * Agency × LLM tool matrix from `consolidated_use_cases` + `use_case_tags`,
 * with two seat estimates per agency: filed license bands and
 * headcount-derived (workforce profile × per-tool share evidence).
 */

import { getDb } from "../shared/init";
import type {
  AgencyToolMatrixRow,
  MatrixProductKey,
} from "../../experience-shared";
import { bandUpper, BAND_UPPER_SQL, BAND_UPPER_TO_MIDPOINT } from "./bands";

/**
 * Bucketing logic shared by both data sources. Operates on a lowercase
 * product string. Returns 0..many MatrixProductKey hits.
 */
function bucketsForProduct(p: string): MatrixProductKey[] {
  const out: MatrixProductKey[] = [];
  if (
    (/copilot/.test(p) || /m365/.test(p) || /office 365/.test(p)) &&
    !/^\s*github copilot\s*$/.test(p)
  ) {
    if (
      /m365|m 365|office 365|microsoft ?365|ms ?365|365 copilot|microsoft copilot|ms copilot|copilot for microsoft|copilot studio|copilot chat/.test(
        p,
      )
    ) {
      out.push("ms_copilot");
    } else if (!/github/.test(p)) {
      out.push("ms_copilot");
    }
  }
  if (/github copilot/.test(p)) out.push("github_copilot");
  if (/chatgpt|openai|gpt-/.test(p)) out.push("chatgpt");
  if (/claude/.test(p)) out.push("claude");
  if (/gemini/.test(p) || /bard/.test(p)) out.push("gemini");
  if (/amazon q|bedrock|aws q/.test(p)) out.push("amazon_q");
  if (
    /gsai|usai\.gov|usai\b|edav|energpt|enerpod|parsgpt|nasagpt|elsa|chirp|camogpt|niprgpt/.test(
      p,
    )
  )
    out.push("agency_built");
  return out;
}

/** Direct map from `use_case_tags` boolean flags to matrix buckets. */
const TAG_TO_BUCKET: Array<[string, MatrixProductKey]> = [
  ["is_microsoft_copilot", "ms_copilot"],
  ["is_github_copilot", "github_copilot"],
  ["is_openai", "chatgpt"],
  ["is_anthropic", "claude"],
  ["is_google", "gemini"],
  ["is_aws_ai", "amazon_q"],
];

/** Hand-set fallback share-of-eligible when Wave-0 priors have n=0.
 *  Exported as the tier→share prior for reach-vs-access views (the
 *  decoupling scatter / people waffle impute from this same map). */
export const TIER_SHARE_PRIOR: Record<string, number> = {
  all: 0.50,
  most: 0.30,
  partial: 0.12,
  pilot: 0.02,
  latent: 0.01,
  unknown: 0.05,
  none: 0.0,
};
const PRIOR_FALLBACK = TIER_SHARE_PRIOR;

export function getAgencyToolMatrix(): AgencyToolMatrixRow[] {
  // (A) Pull consolidated_use_cases rows with a band.
  const consolidatedRows = getDb()
    .prepare<
      [],
      {
        agency_id: number;
        abbreviation: string;
        name: string;
        row_id: number;
        slug: string | null;
        title: string;
        raw_product: string;
        commercial_product: string;
        band: string;
        upper: number;
      }
    >(`
      SELECT a.id AS agency_id,
             a.abbreviation,
             a.name,
             c.id   AS row_id,
             c.slug AS slug,
             COALESCE(c.ai_use_case, '')        AS title,
             COALESCE(c.commercial_product, '') AS raw_product,
             LOWER(COALESCE(c.commercial_product, '')) AS commercial_product,
             c.estimated_licenses_users AS band,
             ${BAND_UPPER_SQL}    AS upper
        FROM consolidated_use_cases c
        JOIN agencies a ON a.id = c.agency_id
       WHERE c.estimated_licenses_users IS NOT NULL
         AND c.estimated_licenses_users != ''
    `)
    .all();

  // (B) Pull use_cases rows whose tag row matches any matrix product family.
  const useCaseRows = getDb()
    .prepare<
      [],
      {
        agency_id: number;
        abbreviation: string;
        name: string;
        row_id: number;
        slug: string | null;
        title: string;
        raw_product: string;
        is_microsoft_copilot: number;
        is_github_copilot: number;
        is_openai: number;
        is_anthropic: number;
        is_google: number;
        is_aws_ai: number;
      }
    >(`
      SELECT a.id AS agency_id,
             a.abbreviation,
             a.name,
             uc.id   AS row_id,
             uc.slug AS slug,
             COALESCE(uc.use_case_name, '')   AS title,
             COALESCE(NULLIF(t.tool_product_name, ''),
                      NULLIF(uc.vendor_name, ''),
                      '')                     AS raw_product,
             COALESCE(t.is_microsoft_copilot, 0) AS is_microsoft_copilot,
             COALESCE(t.is_github_copilot,    0) AS is_github_copilot,
             COALESCE(t.is_openai,            0) AS is_openai,
             COALESCE(t.is_anthropic,         0) AS is_anthropic,
             COALESCE(t.is_google,            0) AS is_google,
             COALESCE(t.is_aws_ai,            0) AS is_aws_ai
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
        JOIN use_case_tags t ON t.use_case_id = uc.id
       WHERE COALESCE(t.is_microsoft_copilot,0)=1
          OR COALESCE(t.is_github_copilot,   0)=1
          OR COALESCE(t.is_openai,           0)=1
          OR COALESCE(t.is_anthropic,        0)=1
          OR COALESCE(t.is_google,           0)=1
          OR COALESCE(t.is_aws_ai,           0)=1
    `)
    .all();

  const byAgency = new Map<number, AgencyToolMatrixRow>();
  const MAX_ENTRIES_PER_CELL = 8;

  function ensureAgency(
    agency_id: number,
    abbreviation: string,
    name: string,
  ): AgencyToolMatrixRow {
    let row = byAgency.get(agency_id);
    if (!row) {
      row = {
        agency_id,
        abbreviation,
        name,
        cells: {},
        estimated_seats_filed: 0,
        estimated_seats_headcount: null,
        headcount_breakdown: null,
      };
      byAgency.set(agency_id, row);
    }
    return row;
  }

  // Insert consolidated rows.
  for (const r of consolidatedRows) {
    const agencyRow = ensureAgency(r.agency_id, r.abbreviation, r.name);
    const buckets = bucketsForProduct(r.commercial_product);
    for (const k of buckets) {
      const existing = agencyRow.cells[k];
      const entry = {
        source: "consolidated" as const,
        subsumed: false,
        row_id: r.row_id,
        slug: r.slug,
        title: r.title,
        commercial_product: r.raw_product,
        band_label: r.band,
      };
      if (!existing) {
        agencyRow.cells[k] = {
          highest_band_upper: r.upper,
          highest_band_label: r.band,
          rows: 1,
          entries: [entry],
        };
      } else {
        existing.rows += 1;
        if (r.upper > existing.highest_band_upper) {
          existing.highest_band_upper = r.upper;
          existing.highest_band_label = r.band;
        }
        existing.entries.push(entry);
      }
    }
  }

  // Insert use_cases rows. Bucket via the tag boolean flags directly; for
  // each agency × bucket pair, mark `subsumed=true` if the cell already has
  // a consolidated entry (the consolidated row is the authoritative
  // workforce-scale artifact).
  for (const r of useCaseRows) {
    const agencyRow = ensureAgency(r.agency_id, r.abbreviation, r.name);
    const buckets: MatrixProductKey[] = [];
    for (const [flag, bucket] of TAG_TO_BUCKET) {
      if ((r as unknown as Record<string, number>)[flag] === 1) {
        buckets.push(bucket);
      }
    }
    for (const k of buckets) {
      const existing = agencyRow.cells[k];
      const subsumed =
        !!existing &&
        existing.entries.some((e) => e.source === "consolidated");
      const entry = {
        source: "use_case" as const,
        subsumed,
        row_id: r.row_id,
        slug: r.slug,
        title: r.title,
        commercial_product: r.raw_product,
        band_label: null,
      };
      if (!existing) {
        // No consolidated band — create the cell with no band info; the
        // sentinel `0` upper indicates "no band data."
        agencyRow.cells[k] = {
          highest_band_upper: 0,
          highest_band_label: "",
          rows: 1,
          entries: [entry],
        };
      } else {
        existing.rows += 1;
        existing.entries.push(entry);
      }
    }
  }

  // Sort entries per cell: consolidated rows by band desc, then unsubsumed
  // use_case rows, then subsumed use_case rows. Trim.
  for (const agencyRow of byAgency.values()) {
    for (const cell of Object.values(agencyRow.cells)) {
      if (!cell) continue;
      cell.entries.sort((a, b) => {
        if (a.source !== b.source) {
          return a.source === "consolidated" ? -1 : 1;
        }
        if (a.subsumed !== b.subsumed) return a.subsumed ? 1 : -1;
        const ba = bandUpper(a.band_label);
        const bb = bandUpper(b.band_label);
        if (bb !== ba) return bb - ba;
        return a.title.length - b.title.length;
      });
      if (cell.entries.length > MAX_ENTRIES_PER_CELL) {
        cell.entries = cell.entries.slice(0, MAX_ENTRIES_PER_CELL);
      }
    }
  }

  // Estimate A — "Filed bands": sum of band midpoints across cells that
  // have at least one consolidated entry. Behavior unchanged from launch.
  for (const ar of byAgency.values()) {
    let seats = 0;
    for (const cell of Object.values(ar.cells)) {
      if (!cell) continue;
      if (cell.highest_band_upper > 0) {
        seats += BAND_UPPER_TO_MIDPOINT.get(cell.highest_band_upper) ?? 0;
      }
    }
    ar.estimated_seats_filed = seats;
  }

  // Estimate B — "Headcount-derived". For each agency, look up the
  // agency-level workforce profile and the per-(agency, tool) shares.
  // Computed in a follow-up pass so the matrix payload stays self-contained.
  applyHeadcountEstimates(byAgency);

  return Array.from(byAgency.values()).sort(
    (a, b) => b.estimated_seats_filed - a.estimated_seats_filed,
  );
}

/**
 * Populate `estimated_seats_headcount` and `headcount_breakdown` on each
 * AgencyToolMatrixRow using:
 *
 *   - agency_workforce_profile (level='agency') for headcount + eligible share
 *   - agency_ai_access_evidence.{estimated_share_of_eligible, matrix_product_key}
 *     for the per-tool share. Defaults to coverage-tier priors when missing.
 *
 * Mutates `byAgency` in place. Leaves estimate null when no workforce row
 * exists for the agency — UI then shows `—` for that row.
 */
function applyHeadcountEstimates(
  byAgency: Map<number, AgencyToolMatrixRow>,
): void {
  if (byAgency.size === 0) return;

  // Agency-level workforce profile keyed by agency_id.
  const workforce = new Map<
    number,
    { headcount: number; ai_eligible_share: number }
  >();
  for (const r of getDb()
    .prepare<
      [],
      {
        agency_id: number | null;
        total_headcount: number | null;
        ai_eligible_share: number | null;
      }
    >(`
      SELECT agency_id, total_headcount, ai_eligible_share
        FROM agency_workforce_profile
       WHERE level = 'agency'
         AND total_headcount IS NOT NULL
         AND ai_eligible_share IS NOT NULL
    `)
    .all()) {
    if (r.agency_id == null) continue;
    workforce.set(r.agency_id, {
      headcount: r.total_headcount as number,
      ai_eligible_share: r.ai_eligible_share as number,
    });
  }

  if (workforce.size === 0) return; // No backfill data — leave all null.

  // Per-(agency, MatrixProductKey) share. Pull from agency_ai_access_evidence
  // with the explicit `matrix_product_key`; fall back to tier prior via
  // coverage_assessment.
  type ShareRow = {
    agency_id: number | null;
    matrix_product_key: string | null;
    coverage_assessment: string | null;
    estimated_share_of_eligible: number | null;
  };
  const evidenceRows = getDb()
    .prepare<[], ShareRow>(`
      SELECT agency_id, matrix_product_key, coverage_assessment,
             estimated_share_of_eligible
        FROM agency_ai_access_evidence
       WHERE matrix_product_key IS NOT NULL
    `)
    .all();
  // Pick the highest share per (agency, key) — agencies often have multiple
  // evidence rows per tool (one per source).
  const shareByAgencyTool = new Map<string, number>();
  for (const r of evidenceRows) {
    if (r.agency_id == null || !r.matrix_product_key) continue;
    const key = `${r.agency_id}::${r.matrix_product_key}`;
    const share =
      r.estimated_share_of_eligible ??
      (r.coverage_assessment ? PRIOR_FALLBACK[r.coverage_assessment] : null);
    if (share == null) continue;
    const prev = shareByAgencyTool.get(key);
    if (prev === undefined || share > prev) {
      shareByAgencyTool.set(key, share);
    }
  }

  for (const ar of byAgency.values()) {
    const w = workforce.get(ar.agency_id);
    if (!w) continue;
    const eligible = w.headcount * w.ai_eligible_share;
    let toolShareSum = 0;
    let matchedTools = 0;
    for (const [key, cell] of Object.entries(ar.cells)) {
      if (!cell) continue;
      const share = shareByAgencyTool.get(`${ar.agency_id}::${key}`);
      if (share === undefined) continue;
      toolShareSum += share;
      matchedTools += 1;
    }
    if (matchedTools === 0) {
      ar.estimated_seats_headcount = 0;
      ar.headcount_breakdown =
        `${formatInt(w.headcount)} staff × ${formatPct(w.ai_eligible_share)} eligible — no per-tool share recorded yet`;
    } else {
      const seats = Math.round(eligible * toolShareSum);
      ar.estimated_seats_headcount = seats;
      ar.headcount_breakdown =
        `${formatInt(w.headcount)} staff × ${formatPct(w.ai_eligible_share)} eligible × Σ ${matchedTools} tool share${matchedTools === 1 ? "" : "s"}`;
    }
  }
}

function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

function formatPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

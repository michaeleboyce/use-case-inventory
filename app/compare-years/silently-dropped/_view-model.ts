/**
 * View-model for /compare-years/silently-dropped.
 *
 * Pulls the four queries that power the page and curates a small set of
 * §IV case-study rows. Selection logic:
 *
 *   1. Exclude USAID (the agency was dissolved in 2025 — its disappearance
 *      is a different category, presented separately).
 *   2. Prefer use cases whose 2024 dev_stage was Deployed or Pilot (the
 *      most striking — actively-used systems that left no Retired trace).
 *   3. Prefer use cases with a substantive narrative (purpose_benefits +
 *      outputs combined length over 250 chars), so each example reads as
 *      a real system, not a stub filing.
 *   4. Round-robin across agencies, then cap at the requested count, so a
 *      single agency cannot dominate the example set.
 *
 * The page renders the curated examples verbatim; commentary is written
 * inline in `page.tsx` keyed by the (agency, use_case_name) pair so the
 * editorial framing can change without touching this file.
 */

import {
  getSilentlyDroppedByAgency,
  getSilentlyDroppedByStage,
  getSilentlyDroppedRows,
  getSilentlyDroppedSummary,
  getSilentlyDroppedGenAiRows,
} from "@/lib/db";
import type {
  SilentlyDroppedAgencyRow,
  SilentlyDroppedRow,
  SilentlyDroppedStageRow,
  SilentlyDroppedSummary,
  SilentlyDroppedGenAiRow,
} from "@/lib/types";

/** A `SilentlyDroppedAgencyRow` decorated with its sorted per-use-case rows,
 *  used by the §III table to render an expandable sub-row per agency. */
export type SilentlyDroppedAgencyRowExpanded = SilentlyDroppedAgencyRow & {
  rows: SilentlyDroppedRow[];
};

export interface SilentlyDroppedViewModel {
  summary: SilentlyDroppedSummary;
  byStage: SilentlyDroppedStageRow[];
  byAgency: SilentlyDroppedAgencyRow[];
  /** Per-agency aggregates with their sorted (Deployed-first) use-case rows
   *  attached. Includes USAID; the page peels that row out separately. */
  byAgencyExpanded: SilentlyDroppedAgencyRowExpanded[];
  /** All non-USAID silently-dropped rows, used by the §V full-list table. */
  allRows: SilentlyDroppedRow[];
  /** Curated case-study pool for §IV (4–6 rows, prose commentary inline). */
  examples: SilentlyDroppedRow[];
  /** Live (production/implementation) GenAI use cases silently dropped — the
   *  sharpest subset of the finding. Excludes the dissolved agency. */
  liveGenAi: SilentlyDroppedGenAiRow[];
  /** `liveGenAi` collapsed by (agency, use_case_name). Several agencies —
   *  Education most of all — filed many distinct task-level entries under a
   *  single repeated name ("Generative AI Usage"). Grouping keeps the table
   *  honest: one row per named capability, with a count of how many filings
   *  share that name, instead of 49 identical-looking ED rows drowning the
   *  ~80 distinct systems. */
  liveGenAiGroups: SilentlyDroppedGenAiGroup[];
}

/** A run of `SilentlyDroppedGenAiRow`s sharing the same (agency, name). */
export interface SilentlyDroppedGenAiGroup {
  /** Stable group key, `${agency}|${name}` — used for the React key. */
  key: string;
  /** Representative 2024 id (first row in the group). */
  uc_2024_id: number;
  agency_abbreviation: string | null;
  agency_name: string | null;
  use_case_name: string | null;
  /** Number of filings collapsed into this group (1 for most). */
  count: number;
  /** Distinct bureaus the filings span, sorted. */
  bureaus: string[];
  /** Shared 2024 dev stage, or null if the group mixes stages. */
  dev_stage: string | null;
  /** Single named tool if the group agrees, else null (mixed / unnamed). */
  tool_product_name: string | null;
  ai_sophistication: string | null;
  /** The underlying filings, Deployed-first. A `count: 1` group has one
   *  member; the ED "Generative AI Usage" cluster has 49. Rendered when the
   *  row is expanded. */
  members: SilentlyDroppedGenAiRow[];
}

/** Deployed > Pilot > everything else, for ordering members within a group.
 *  Mirrors the stage buckets used elsewhere on the page. */
function liveStageRank(devStage: string | null | undefined): number {
  const s = (devStage ?? "").toLowerCase();
  if (s.includes("operation") || s.includes("production") || s.includes("mission"))
    return 2;
  if (s.includes("implementation") || s.includes("assessment")) return 1;
  return 0;
}

/** Collapse live-GenAI rows by (agency, use_case_name). Single-row groups
 *  pass through unchanged (count 1); multi-row clusters fold into one entry
 *  carrying the count and the union of their bureaus. */
function groupLiveGenAi(
  rows: SilentlyDroppedGenAiRow[],
): SilentlyDroppedGenAiGroup[] {
  type Acc = SilentlyDroppedGenAiGroup & {
    _stages: Set<string>;
    _tools: Set<string>;
  };
  const map = new Map<string, Acc>();
  for (const r of rows) {
    const key = `${r.agency_abbreviation ?? "?"}|${r.use_case_name ?? "?"}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        uc_2024_id: r.uc_2024_id,
        agency_abbreviation: r.agency_abbreviation,
        agency_name: r.agency_name,
        use_case_name: r.use_case_name,
        count: 0,
        bureaus: [],
        dev_stage: null,
        tool_product_name: null,
        ai_sophistication: r.ai_sophistication,
        members: [],
        _stages: new Set<string>(),
        _tools: new Set<string>(),
      };
      map.set(key, g);
    }
    g.count += 1;
    g.members.push(r);
    if (r.bureau && !g.bureaus.includes(r.bureau)) g.bureaus.push(r.bureau);
    if (r.dev_stage) g._stages.add(r.dev_stage);
    if (r.tool_product_name) g._tools.add(r.tool_product_name);
  }

  const out: SilentlyDroppedGenAiGroup[] = [];
  for (const g of map.values()) {
    g.bureaus.sort((a, b) => a.localeCompare(b));
    g.dev_stage = g._stages.size === 1 ? [...g._stages][0] : null;
    g.tool_product_name = g._tools.size === 1 ? [...g._tools][0] : null;
    // Members Deployed-first, then by bureau, so the most striking filings
    // surface at the top of an expanded cluster.
    g.members.sort(
      (a, b) =>
        liveStageRank(b.dev_stage) - liveStageRank(a.dev_stage) ||
        (a.bureau ?? "").localeCompare(b.bureau ?? ""),
    );
    const { _stages: _s, _tools: _t, ...clean } = g;
    void _s;
    void _t;
    out.push(clean);
  }
  // Agency asc, then biggest clusters first within an agency, then name.
  out.sort(
    (a, b) =>
      (a.agency_abbreviation ?? "").localeCompare(b.agency_abbreviation ?? "") ||
      b.count - a.count ||
      (a.use_case_name ?? "").localeCompare(b.use_case_name ?? ""),
  );
  return out;
}

/** Use cases whose name appears in this set are skipped when curating
 *  examples — they're either stubs, single words, or so generic they read
 *  badly as case studies. Conservative; only entries hand-verified to be
 *  uninformative belong here. */
const EXAMPLE_NAME_DENYLIST = new Set<string>([]);

function narrativeLength(r: SilentlyDroppedRow): number {
  return (
    (r.purpose_benefits?.length ?? 0) + (r.outputs?.length ?? 0)
  );
}

/** Score for example curation. Higher = better example. Stage matters
 *  most (Deployed > Pilot > everything else); narrative length is the
 *  tiebreaker. */
function exampleScore(r: SilentlyDroppedRow): number {
  const stage = (r.dev_stage ?? "").toLowerCase();
  let stageScore = 0;
  if (
    stage.includes("operation") ||
    stage.includes("production") ||
    stage.includes("mission")
  ) {
    stageScore = 100; // Deployed
  } else if (stage.includes("implementation") || stage.includes("assessment")) {
    stageScore = 60; // Pilot
  } else {
    stageScore = 20;
  }
  return stageScore * 1000 + Math.min(narrativeLength(r), 5000);
}

/** Round-robin across agencies so one agency cannot dominate the set. */
function pickRoundRobin(
  pool: SilentlyDroppedRow[],
  count: number,
): SilentlyDroppedRow[] {
  const byAgency = new Map<string, SilentlyDroppedRow[]>();
  for (const r of pool) {
    const key = r.agency_abbreviation ?? "?";
    const arr = byAgency.get(key) ?? [];
    arr.push(r);
    byAgency.set(key, arr);
  }
  // Sort each agency bucket by score desc.
  for (const arr of byAgency.values()) {
    arr.sort((a, b) => exampleScore(b) - exampleScore(a));
  }
  // Then walk the agencies in order of their best row's score.
  const agencyOrder = [...byAgency.entries()].sort(
    (a, b) => exampleScore(b[1][0]) - exampleScore(a[1][0]),
  );
  const out: SilentlyDroppedRow[] = [];
  let i = 0;
  while (out.length < count && agencyOrder.some(([, arr]) => arr.length > 0)) {
    const [, arr] = agencyOrder[i % agencyOrder.length];
    if (arr.length > 0) out.push(arr.shift()!);
    i += 1;
    if (i > 10_000) break; // belt-and-suspenders
  }
  return out;
}

export async function buildSilentlyDroppedViewModel(): Promise<SilentlyDroppedViewModel> {
  const summary = getSilentlyDroppedSummary();
  const byStage = getSilentlyDroppedByStage();
  const byAgency = getSilentlyDroppedByAgency();
  const allRows = getSilentlyDroppedRows({ includeDissolved: false });
  const liveGenAi = getSilentlyDroppedGenAiRows();
  // Second fetch including USAID, so the §III table can expand USAID's row
  // and reveal its 137 dropped use cases too. Cheap — ~600 rows total.
  const allRowsWithDissolved = getSilentlyDroppedRows({
    includeDissolved: true,
  });

  // Group by agency abbreviation, then attach to each aggregate row. Sorted
  // Deployed-first via the same `exampleScore` helper §IV uses.
  const rowsByAbbr = new Map<string, SilentlyDroppedRow[]>();
  for (const r of allRowsWithDissolved) {
    const key = r.agency_abbreviation ?? "?";
    const arr = rowsByAbbr.get(key) ?? [];
    arr.push(r);
    rowsByAbbr.set(key, arr);
  }
  for (const arr of rowsByAbbr.values()) {
    arr.sort((a, b) => exampleScore(b) - exampleScore(a));
  }
  const byAgencyExpanded: SilentlyDroppedAgencyRowExpanded[] = byAgency.map(
    (a) => ({ ...a, rows: rowsByAbbr.get(a.abbreviation) ?? [] }),
  );

  // Curate examples from the non-USAID, substantive-narrative pool.
  const pool = allRows.filter(
    (r) =>
      !r.is_dissolved &&
      narrativeLength(r) >= 250 &&
      !EXAMPLE_NAME_DENYLIST.has(r.use_case_name ?? ""),
  );
  const examples = pickRoundRobin(pool, 6);

  return {
    summary,
    byStage,
    byAgency,
    byAgencyExpanded,
    allRows,
    examples,
    liveGenAi,
    liveGenAiGroups: groupLiveGenAi(liveGenAi),
  };
}

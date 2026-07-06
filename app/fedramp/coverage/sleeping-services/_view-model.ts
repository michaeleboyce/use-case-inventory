/**
 * Server-side data shaping for /fedramp/coverage/sleeping-services.
 *
 * One DB round-trip (getSleepingServicePairs) + one small helper query
 * (agency × reported-capability set); every view on the page — funnel,
 * frontier grid, board, capability matrix, timing histogram — derives from
 * the pair array here so all counts are guaranteed mutually consistent.
 *
 * Headline counts EXCLUDE timing-excluded pairs (first host ATO issued
 * after the inventory cutoff — the agency could not have reported use).
 * Those pairs are retained with a flag and rendered grayed: they're the
 * board's falsification test and should disappear next inventory cycle.
 */
import {
  bucketTiming,
  getAgencyReportedCategories,
  getSleepingServicePairs,
  hasSleepingServices,
} from "@/lib/db";
import type {
  CapabilityCategory,
  SleepingServicePairRow,
  SleepingTimingBucket,
} from "@/lib/types";
import type {
  BoardAgencyDetail,
  BoardFilters,
  BoardRow,
  Funnel,
  GridCell,
  GridColumn,
  GridRow,
  MatrixRow,
  SleepingPair,
} from "./_shared";
import { CAPABILITY_LABELS, TIMING_LABELS, productSlug } from "./_shared";

// Client-safe shapes live in ./_shared (no lib/db import there); re-export
// for the server page so existing imports keep working.
export { CAPABILITY_LABELS, TIMING_LABELS, productSlug } from "./_shared";
export type {
  BoardAgencyDetail,
  BoardFilters,
  BoardRow,
  Funnel,
  GridCell,
  GridColumn,
  GridRow,
  MatrixRow,
  SleepingPair,
} from "./_shared";

export interface SleepingServicesViewModel {
  available: boolean;
  error: string | null;
  pairs: SleepingPair[];
  funnel: Funnel;
  board: BoardRow[]; // filtered per searchParams
  boardUnfilteredCount: number;
  filters: BoardFilters;
  capabilitiesPresent: CapabilityCategory[];
  grid: { columns: GridColumn[]; rows: GridRow[] };
  matrix: { categories: CapabilityCategory[]; rows: MatrixRow[] };
  timing: Array<{ bucket: SleepingTimingBucket; label: string; count: number }>;
}

function toDetail(p: SleepingPair): BoardAgencyDetail {
  return {
    agency_id: p.agency_id,
    agency_abbr: p.agency_abbr,
    agency_name: p.agency_name,
    first_ato_date: p.first_ato_date,
    timing_bucket: p.timing_bucket,
    timing_excluded: p.timing_excluded,
    recency_last90: p.recency_last90 === 1,
    similar_deployed: p.similar_deployed === 1,
    similar_products: (p.similar_products ?? "").split(",").filter(Boolean).slice(0, 6),
    host_packages: (p.host_packages ?? "").split(",").filter(Boolean),
  };
}

export function parseBoardFilters(sp: {
  genai?: string;
  similar?: string;
  tier?: string;
  capability?: string;
  hidetiming?: string;
}): BoardFilters {
  const cap = sp.capability as CapabilityCategory | undefined;
  return {
    genai: sp.genai === "1",
    voidOnly: sp.similar === "void",
    tier:
      sp.tier === "named_offering" || sp.tier === "catalog" ? sp.tier : null,
    capability: cap && cap in CAPABILITY_LABELS ? cap : null,
    hideTiming: sp.hidetiming === "1",
  };
}

export function buildViewModel(filters: BoardFilters): SleepingServicesViewModel {
  const empty: SleepingServicesViewModel = {
    available: false,
    error: null,
    pairs: [],
    funnel: { reach_pairs: 0, sleeping: 0, nothing_similar: 0, genai_void: 0, timing_excluded: 0 },
    board: [],
    boardUnfilteredCount: 0,
    filters,
    capabilitiesPresent: [],
    grid: { columns: [], rows: [] },
    matrix: { categories: [], rows: [] },
    timing: [],
  };

  let raw: SleepingServicePairRow[];
  let reported: Array<{ agency_id: number; category: string }>;
  try {
    if (!hasSleepingServices()) return empty;
    raw = getSleepingServicePairs();
    reported = getAgencyReportedCategories();
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : "Unknown error." };
  }
  if (raw.length === 0) return empty;

  const pairs: SleepingPair[] = raw.map((p) => {
    const bucket = bucketTiming(p.first_ato_date);
    return {
      ...p,
      timing_bucket: bucket,
      timing_excluded:
        p.role === "sleeping" &&
        (bucket === "post_cutoff" || p.recency_last90 === 1),
    };
  });

  const sleeping = pairs.filter((p) => p.role === "sleeping");
  const headline = sleeping.filter((p) => !p.timing_excluded);
  const funnel: Funnel = {
    reach_pairs: pairs.filter((p) => p.has_reach === 1).length,
    sleeping: headline.length,
    nothing_similar: headline.filter((p) => p.similar_deployed === 0).length,
    genai_void: headline.filter(
      (p) => p.similar_deployed === 0 && p.gen_ai === 1,
    ).length,
    timing_excluded: sleeping.length - headline.length,
  };

  // ---- board rows, grouped per product --------------------------------
  const byProduct = new Map<string, SleepingPair[]>();
  for (const p of pairs) {
    const arr = byProduct.get(p.product) ?? [];
    arr.push(p);
    byProduct.set(p.product, arr);
  }
  const allBoard: BoardRow[] = [...byProduct.entries()].map(([product, ps]) => {
    const leads = ps.filter((p) => p.role === "lead").map(toDetail);
    const sleep = ps.filter((p) => p.role === "sleeping").map(toDetail);
    const first = ps[0];
    return {
      product,
      slug: productSlug(product),
      services: [...new Set(ps.flatMap((p) => p.services.split(",")))].filter(Boolean),
      capability_category: first.capability_category,
      gen_ai: first.gen_ai === 1,
      confidence: first.confidence,
      evidence_tier: first.evidence_tier,
      leads,
      sleeping: sleep,
      sleeping_count: sleep.filter((d) => !d.timing_excluded).length,
      void_count: sleep.filter((d) => !d.timing_excluded && !d.similar_deployed).length,
      timing_excluded_count: sleep.filter((d) => d.timing_excluded).length,
    };
  });
  // Named offerings first, then by gap size.
  allBoard.sort((a, b) => {
    if (a.evidence_tier !== b.evidence_tier) {
      return a.evidence_tier === "named_offering" ? -1 : 1;
    }
    return b.sleeping_count - a.sleeping_count || a.product.localeCompare(b.product);
  });

  const board = allBoard.filter((r) => {
    if (filters.genai && !r.gen_ai) return false;
    if (filters.tier && r.evidence_tier !== filters.tier) return false;
    if (filters.capability && r.capability_category !== filters.capability) return false;
    if (filters.voidOnly && r.void_count === 0) return false;
    return true;
  });

  // ---- frontier grid (gen-AI platforms × agencies) ---------------------
  const genaiBoard = allBoard.filter((r) => r.gen_ai);
  const columns: GridColumn[] = genaiBoard
    .map((r) => ({
      product: r.product,
      slug: r.slug,
      lead_count: r.leads.length,
      reach_count:
        r.sleeping.length + r.leads.filter((l) => hasReach(pairs, r.product, l.agency_id)).length,
    }))
    .sort(
      (a, b) =>
        b.reach_count - a.reach_count ||
        b.lead_count - a.lead_count ||
        a.product.localeCompare(b.product),
    );

  const gridAgencies = new Map<number, { abbr: string; name: string }>();
  for (const r of genaiBoard) {
    for (const d of [...r.leads, ...r.sleeping]) {
      gridAgencies.set(d.agency_id, { abbr: d.agency_abbr, name: d.agency_name });
    }
  }
  const gridRows: GridRow[] = [...gridAgencies.entries()]
    .map(([agency_id, a]) => {
      const cells: GridCell[] = columns.map((col) => {
        const row = genaiBoard.find((r) => r.product === col.product)!;
        const lead = row.leads.find((d) => d.agency_id === agency_id);
        if (lead) return { state: "lead" as const, detail: lead };
        const sleep = row.sleeping.find((d) => d.agency_id === agency_id);
        if (!sleep) return { state: "no_reach" as const, detail: null };
        if (sleep.timing_excluded)
          return { state: "timing_excluded" as const, detail: sleep };
        return {
          state: sleep.similar_deployed
            ? ("sleeping_similar" as const)
            : ("sleeping_void" as const),
          detail: sleep,
        };
      });
      return {
        agency_id,
        agency_abbr: a.abbr,
        agency_name: a.name,
        cells,
        sleeping_count: cells.filter(
          (c) => c.state === "sleeping_similar" || c.state === "sleeping_void",
        ).length,
        void_count: cells.filter((c) => c.state === "sleeping_void").length,
      };
    })
    .sort(
      (a, b) =>
        b.void_count - a.void_count ||
        b.sleeping_count - a.sleeping_count ||
        a.agency_abbr.localeCompare(b.agency_abbr),
    );

  // ---- capability matrix ------------------------------------------------
  const reportedSet = new Set(reported.map((r) => `${r.agency_id}|${r.category}`));
  const categories = [...new Set(allBoard.map((r) => r.capability_category))].sort(
    (a, b) => CAPABILITY_LABELS[a].localeCompare(CAPABILITY_LABELS[b]),
  );
  const matrixAgencies = new Map<number, { abbr: string; name: string }>();
  for (const p of pairs) {
    matrixAgencies.set(p.agency_id, { abbr: p.agency_abbr, name: p.agency_name });
  }
  const matrixRows: MatrixRow[] = [...matrixAgencies.entries()]
    .map(([agency_id, a]) => {
      const cells = categories.map((cat) => {
        const catPairs = pairs.filter(
          (p) =>
            p.agency_id === agency_id &&
            p.capability_category === cat &&
            p.role === "sleeping" &&
            !p.timing_excluded,
        );
        if (catPairs.some((p) => p.similar_deployed === 0)) return "sleeping_void" as const;
        if (catPairs.length > 0) return "sleeping_similar" as const;
        if (
          reportedSet.has(`${agency_id}|${cat}`) ||
          pairs.some(
            (p) =>
              p.agency_id === agency_id &&
              p.capability_category === cat &&
              p.role === "lead",
          )
        ) {
          return "reports" as const;
        }
        return "none" as const;
      });
      return {
        agency_abbr: a.abbr,
        agency_name: a.name,
        cells,
        void_count: cells.filter((c) => c === "sleeping_void").length,
      };
    })
    .filter((r) => r.cells.some((c) => c !== "none"))
    .sort(
      (a, b) =>
        b.void_count - a.void_count || a.agency_abbr.localeCompare(b.agency_abbr),
    );

  // ---- timing histogram (sleeping rows incl. excluded) ------------------
  const order: SleepingTimingBucket[] = [
    "2022_or_earlier", "2023_24", "2025h1", "2025h2", "post_cutoff", "unknown",
  ];
  const timing = order.map((bucket) => ({
    bucket,
    label: TIMING_LABELS[bucket],
    count: sleeping.filter((p) => p.timing_bucket === bucket).length,
  }));

  return {
    available: true,
    error: null,
    pairs,
    funnel,
    board,
    boardUnfilteredCount: allBoard.length,
    filters,
    capabilitiesPresent: categories,
    grid: { columns, rows: gridRows },
    matrix: { categories, rows: matrixRows },
    timing,
  };
}

function hasReach(pairs: SleepingPair[], product: string, agencyId: number): boolean {
  return pairs.some(
    (p) => p.product === product && p.agency_id === agencyId && p.has_reach === 1,
  );
}

// ---------------------------------------------------------------------------
// Divergence timeline (§ "the two clocks")
//
// Two cumulative step curves plotted against the same year axis:
//   1. ATO clock — for each inventory agency, the earliest ATO it holds on
//      any package whose scope catalog carries a core-AI service. This is
//      "capability first legally in reach," not enablement or staff access.
//   2. Rollout clock — for each agency, the earliest DATED, web-corroborated
//      IFP evidence row that it actually stood a general-purpose AI tool up
//      for its workforce. Sparse by construction (a few dozen rows at most).
//
// The gap between the curves is the point of the figure: reach arrived years
// before rollout did. Guarded-degrade to null so the page can drop the whole
// section when the FedRAMP service classification sidecar is absent.
// ---------------------------------------------------------------------------
import { getAgencyAiAccessEvidence, getFirstCoreAiAtoByAgency } from "@/lib/db";

export interface DivergenceTimelinePoint {
  /** ISO date */
  date: string;
  cumulative: number;
  abbr: string | null;
  name: string;
  /** rollout anchors only */
  tool?: string | null;
}

export interface DivergenceTimelineData {
  /** Cumulative agencies whose FIRST agency ATO on a core-AI-in-scope package ≤ date. */
  atoSteps: DivergenceTimelinePoint[];
  /** Cumulative agencies with a dated, corroborated GenAI rollout evidence row ≤ date. */
  anchorSteps: DivergenceTimelinePoint[];
  snapshotDate: string; // "2026-06-12"
}

// The FedRAMP marketplace snapshot the frontier reach is drawn from. Distinct
// from SLEEPING_INVENTORY_CUTOFF (the OMB inventory reporting cutoff); this is
// the right edge of the timeline's x-domain.
const DIVERGENCE_SNAPSHOT_DATE = "2026-06-12";

export function buildDivergenceTimeline(): DivergenceTimelineData | null {
  try {
    // Ordered by first_ato_date already; re-sort defensively before running
    // the cumulative so the step curve is monotonic regardless of query order.
    const atoRows = getFirstCoreAiAtoByAgency();
    if (atoRows.length === 0) return null;

    const atoSteps: DivergenceTimelinePoint[] = atoRows
      .slice()
      .sort((a, b) => a.first_ato_date.localeCompare(b.first_ato_date))
      .map((r, i) => ({
        date: r.first_ato_date,
        cumulative: i + 1,
        abbr: r.agency_abbreviation,
        name: r.agency_name,
      }));

    // Rollout clock: earliest dated, corroborated evidence row per agency.
    // Undated or unsourced ("searched_no_source") rows carry no temporal
    // signal and are skipped — the anchors mark discrete, sourced dates only.
    const bestByAgency = new Map<
      string,
      { date: string; name: string; tool: string | null }
    >();
    for (const e of getAgencyAiAccessEvidence()) {
      if (e.status !== "corroborated" || !e.source_date) continue;
      const prev = bestByAgency.get(e.agency_abbreviation);
      if (!prev || e.source_date < prev.date) {
        bestByAgency.set(e.agency_abbreviation, {
          date: e.source_date,
          name: e.agency_name ?? e.agency_abbreviation,
          tool: e.tool_name,
        });
      }
    }
    const anchorSteps: DivergenceTimelinePoint[] = [...bestByAgency.entries()]
      .map(([abbr, v]) => ({ abbr, date: v.date, name: v.name, tool: v.tool }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p, i) => ({ ...p, cumulative: i + 1 }));

    return { atoSteps, anchorSteps, snapshotDate: DIVERGENCE_SNAPSHOT_DATE };
  } catch {
    return null;
  }
}

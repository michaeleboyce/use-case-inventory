/**
 * Shared view-model for the reach-vs-access visualizations: the decoupling
 * scatter and the people-weighted waffle. Rendered on
 * /fedramp/coverage/agencies (§II), /fedramp/coverage/sleeping-services,
 * /experience (compact waffle), and /figures/[slug] — hence promoted out of
 * any route-local _view-model.ts per AGENTS.md.
 *
 * Framing rules baked into this model (see fact_sheet.md guardrail 7):
 * "reach" counts core-AI services IN SCOPE OF A PACKAGE THE AGENCY HOLDS AN
 * ATO FOR — never "enabled" or "available to staff". Access shares are IFP
 * web-corroborated assessments, not OMB data; where no corroborated share
 * exists the tier prior imputes one and the point/square is flagged
 * `imputed` so every renderer can disclose it (hollow dots, caption notes).
 */

import {
  getAgencyAccessTiers,
  getAgencyEligibleWorkforce,
  getFrontierReachByAgency,
  TIER_SHARE_PRIOR,
  type AgencyAccessTier,
} from "@/lib/db";

/** One agency on the decoupling scatter. */
export interface DecouplingPoint {
  agency_id: number;
  abbr: string;
  name: string;
  /** Core-AI services in scope of packages the agency holds an ATO for. */
  reach: number;
  /** Estimated share of eligible staff with a general-purpose AI tool (0–1). */
  share: number;
  /** true → share imputed from the tier prior (render hollow). */
  imputed: boolean;
  /** true → no assessment row at all (render hollow + extra-dimmed at y=0). */
  noAssessment: boolean;
  tier: AgencyAccessTier["tier"] | null;
  /** AI-eligible workforce (dot area), null when no workforce profile. */
  eligible: number | null;
  /** High reach, little access — the story quadrant (stamp red). */
  emphasized: boolean;
  /** Direct-label this point (selective labels; ≤ MAX_LABELS). */
  labeled: boolean;
}

export type WaffleState = "access" | "reach_only" | "neither";

/** One square ≈ WAFFLE_UNIT AI-eligible workers. */
export interface WaffleSquare {
  state: WaffleState;
  /** Agency contributing this square's midpoint worker (hover detail). */
  dominant: { abbr: string; name: string } | null;
  /** That agency's total workers in this state (rounded). */
  dominantWorkers: number;
  /** Dominant agency's share was tier-prior imputed, not corroborated. */
  imputed: boolean;
}

export interface WaffleModel {
  unit: number;
  squares: WaffleSquare[];
  totals: {
    access: number;
    reachOnly: number;
    neither: number;
    eligible: number;
  };
  /** Agencies contributing workers to the model. */
  agencyCount: number;
  /** Of those, how many have only an imputed (non-corroborated) share. */
  imputedAgencyCount: number;
}

export interface FrontierAccessModel {
  scatter: DecouplingPoint[];
  /** Reach rows dropped from the scatter for lacking an abbreviation. */
  droppedNoAbbr: number;
  /** The computed emphasis threshold (median reach), for captions. */
  medianReach: number;
  waffle: WaffleModel;
}

export const WAFFLE_UNIT = 25_000;
const MAX_LABELS = 8;
const LOW_ACCESS_SHARE = 0.1;

/** The emphasis rule, exported for tests: high reach AND ≤10% access. */
export function classifyDecoupling(
  reach: number,
  share: number,
  medianReach: number,
): boolean {
  return reach >= medianReach && share <= LOW_ACCESS_SHARE;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Resolve an agency's plotted share + provenance flags from its tier row. */
function resolveShare(tierRow: AgencyAccessTier | undefined): {
  share: number;
  imputed: boolean;
  noAssessment: boolean;
  tier: AgencyAccessTier["tier"] | null;
} {
  if (!tierRow) {
    return { share: 0, imputed: true, noAssessment: true, tier: null };
  }
  if (tierRow.share != null) {
    return {
      share: tierRow.share,
      imputed: false,
      noAssessment: false,
      tier: tierRow.tier,
    };
  }
  return {
    share: TIER_SHARE_PRIOR[tierRow.tier] ?? 0,
    imputed: true,
    noAssessment: false,
    tier: tierRow.tier,
  };
}

/** Largest-remainder apportionment of `totalSquares` across pools. */
export function largestRemainder(
  pools: number[],
  totalSquares: number,
): number[] {
  const total = pools.reduce((a, b) => a + b, 0);
  if (total <= 0 || totalSquares <= 0) return pools.map(() => 0);
  const exact = pools.map((p) => (p / total) * totalSquares);
  const floors = exact.map(Math.floor);
  let remaining = totalSquares - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }
  return floors;
}

/**
 * Assemble the shared model. Returns null when the FedRAMP service sidecars
 * or the workforce profiles are absent from this DB build — callers hide
 * their sections rather than rendering empty charts.
 */
export function buildFrontierAccessModel(): FrontierAccessModel | null {
  let reach, tiers, workforce;
  try {
    reach = getFrontierReachByAgency();
    tiers = getAgencyAccessTiers();
    workforce = getAgencyEligibleWorkforce();
  } catch {
    return null;
  }
  if (reach.length === 0 || workforce.length === 0) return null;

  const eligibleByAbbr = new Map<string, { eligible: number; name: string }>();
  for (const w of workforce) {
    if (w.abbreviation) {
      eligibleByAbbr.set(w.abbreviation, {
        eligible: w.eligible,
        name: w.name,
      });
    }
  }

  // ---- Scatter ----
  const usable = reach.filter((r) => r.agency_abbreviation);
  const droppedNoAbbr = reach.length - usable.length;
  const medianReach = median(usable.map((r) => r.core_ai_services_in_reach));

  const points: DecouplingPoint[] = usable.map((r) => {
    const abbr = r.agency_abbreviation;
    const resolved = resolveShare(tiers[abbr]);
    const eligible = eligibleByAbbr.get(abbr)?.eligible ?? null;
    return {
      agency_id: r.inventory_agency_id,
      abbr,
      name: r.agency_name,
      reach: r.core_ai_services_in_reach,
      ...resolved,
      eligible,
      emphasized: classifyDecoupling(
        r.core_ai_services_in_reach,
        resolved.share,
        medianReach,
      ),
      labeled: false,
    };
  });

  // Selective direct labels: the emphasized corner first (by reach), then
  // the strongest counter-examples (highest share), then largest reach.
  const salience = (p: DecouplingPoint) =>
    (p.emphasized ? 10_000 : 0) + (p.share >= 0.8 ? 5_000 : 0) + p.reach;
  [...points]
    .sort((a, b) => salience(b) - salience(a) || a.abbr.localeCompare(b.abbr))
    .slice(0, MAX_LABELS)
    .forEach((p) => {
      p.labeled = true;
    });

  // ---- Waffle ----
  const reachByAbbr = new Map<string, number>();
  for (const r of usable) {
    reachByAbbr.set(r.agency_abbreviation, r.core_ai_services_in_reach);
  }

  interface AgencyPools {
    abbr: string;
    name: string;
    imputed: boolean;
    pools: Record<WaffleState, number>;
  }
  const perAgency: AgencyPools[] = [];
  for (const w of workforce) {
    if (!w.abbreviation || w.eligible <= 0) continue;
    const resolved = resolveShare(tiers[w.abbreviation]);
    const hasReach = (reachByAbbr.get(w.abbreviation) ?? 0) > 0;
    const access = w.eligible * resolved.share;
    const rest = w.eligible - access;
    perAgency.push({
      abbr: w.abbreviation,
      name: w.name,
      imputed: resolved.imputed,
      pools: {
        access,
        reach_only: hasReach ? rest : 0,
        neither: hasReach ? 0 : rest,
      },
    });
  }
  if (perAgency.length === 0) return null;

  const totals = {
    access: perAgency.reduce((a, p) => a + p.pools.access, 0),
    reachOnly: perAgency.reduce((a, p) => a + p.pools.reach_only, 0),
    neither: perAgency.reduce((a, p) => a + p.pools.neither, 0),
    eligible: 0,
  };
  totals.eligible = totals.access + totals.reachOnly + totals.neither;

  const totalSquares = Math.max(1, Math.round(totals.eligible / WAFFLE_UNIT));
  const stateOrder: WaffleState[] = ["access", "reach_only", "neither"];
  const squareCounts = largestRemainder(
    [totals.access, totals.reachOnly, totals.neither],
    totalSquares,
  );

  const squares: WaffleSquare[] = [];
  stateOrder.forEach((state, si) => {
    const n = squareCounts[si];
    if (n === 0) return;
    const poolKey = state;
    const contributors = perAgency
      .filter((p) => p.pools[poolKey] > 0)
      .sort((a, b) => b.pools[poolKey] - a.pools[poolKey]);
    const poolTotal = contributors.reduce((a, p) => a + p.pools[poolKey], 0);
    const perSquare = poolTotal / n;
    let ci = 0;
    let consumed = 0;
    for (let k = 0; k < n; k++) {
      const midpoint = (k + 0.5) * perSquare;
      while (
        ci < contributors.length - 1 &&
        consumed + contributors[ci].pools[poolKey] < midpoint
      ) {
        consumed += contributors[ci].pools[poolKey];
        ci += 1;
      }
      const c = contributors[ci];
      squares.push({
        state,
        dominant: c ? { abbr: c.abbr, name: c.name } : null,
        dominantWorkers: c ? Math.round(c.pools[poolKey]) : 0,
        imputed: c ? c.imputed : false,
      });
    }
  });

  return {
    scatter: points,
    droppedNoAbbr,
    medianReach,
    waffle: {
      unit: WAFFLE_UNIT,
      squares,
      totals: {
        access: Math.round(totals.access),
        reachOnly: Math.round(totals.reachOnly),
        neither: Math.round(totals.neither),
        eligible: Math.round(totals.eligible),
      },
      agencyCount: perAgency.length,
      imputedAgencyCount: perAgency.filter((p) => p.imputed).length,
    },
  };
}

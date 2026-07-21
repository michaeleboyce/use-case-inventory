/**
 * View-model for the access-trajectory slope chart: per-agency growth in
 * the estimated share of eligible staff with a general-purpose AI tool,
 * built from the DATED, web-corroborated evidence anchors in
 * `agency_ai_access_evidence` (the same corpus behind /experience and the
 * /adoption LLM-access curve).
 *
 * Semantics mirror lib/db/adoption.ts's buildLlmAccessSeries: each plotted
 * point is the agency's BEST corroborated share as of that evidence date
 * (a running maximum), so a later, lower-share finding about a narrower
 * tool never reads as a rollback. Evidence dates lag rollouts — every
 * trajectory is a floor, and agencies with one dated anchor render as a
 * lone point (their "growth" is unmeasurable, not zero). Shared by
 * /experience and /figures — hence app/_view-models per AGENTS.md.
 */

import { getAccessShareAnchors } from "@/lib/db";

/** One plotted anchor: best corroborated share as of an evidence date. */
export interface TrajectoryAnchor {
  /** Normalized ISO date (partial YYYY / YYYY-MM dates centered). */
  date: string;
  /** Epoch ms of `date`, the x value. */
  t: number;
  /** Running-best corroborated share of eligible staff (0–1). */
  share: number;
  /** The finding behind this anchor (tooltip detail). */
  tool: string | null;
  sourceTitle: string | null;
}

export interface AccessTrajectory {
  abbr: string;
  name: string;
  anchors: TrajectoryAnchor[];
  /** Share at the first dated anchor / best share overall. */
  first: number;
  best: number;
  /** best − first; 0 by construction for single-anchor agencies. */
  delta: number;
  /** Climbed ≥ EMPHASIS_DELTA within the evidence window (stamp red). */
  emphasized: boolean;
  /** Only one dated anchor — renders as a point, not a line. */
  single: boolean;
}

export interface AccessTrajectoriesModel {
  /** Sorted by best share desc so labels stack predictably. */
  trajectories: AccessTrajectory[];
  /** Epoch ms of the AI Action Plan LLM-access mandate (2025-07-23). */
  mandateT: number;
  climberCount: number;
  singleAnchorCount: number;
}

/** Growth threshold for the emphasis (stamp) treatment: +25 pp. */
export const EMPHASIS_DELTA = 0.25;

/** Agencies kept out of the trajectory chart (editorial call — the
 *  evidence rows stay in the DB and on /readiness/access). Treasury's
 *  line is flat at ~5% across its whole window and adds clutter without
 *  a trajectory story. */
export const EXCLUDED_ABBRS = new Set(["Treasury"]);

export const LLM_MANDATE_DATE = "2025-07-23";

/**
 * Normalize the evidence table's partial dates to a plottable day:
 * YYYY → July 1, YYYY-MM → the 15th. Returns null for unparseable input.
 */
export function normalizeSourceDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-15`;
  if (/^\d{4}$/.test(raw)) return `${raw}-07-01`;
  return null;
}

export function buildAccessTrajectoriesModel(): AccessTrajectoriesModel | null {
  let rows: ReturnType<typeof getAccessShareAnchors>;
  try {
    rows = getAccessShareAnchors();
  } catch {
    return null;
  }
  if (rows.length === 0) return null;

  const byAgency = new Map<string, { name: string; rows: typeof rows }>();
  for (const r of rows) {
    const entry = byAgency.get(r.agency_abbreviation) ?? {
      name: r.agency_name ?? r.agency_abbreviation,
      rows: [],
    };
    entry.rows.push(r);
    byAgency.set(r.agency_abbreviation, entry);
  }

  const trajectories: AccessTrajectory[] = [];
  for (const [abbr, { name, rows: agencyRows }] of byAgency) {
    if (EXCLUDED_ABBRS.has(abbr)) continue;
    // Normalize dates, drop unparseable, sort chronologically.
    const dated = agencyRows
      .map((r) => {
        const date = normalizeSourceDate(r.source_date);
        return date === null ? null : { ...r, date, t: Date.parse(date) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.t - b.t);
    if (dated.length === 0) continue;

    // Running max, one anchor per date (same-date findings collapse to the
    // strongest). A finding strictly below the running best is dropped —
    // narrower-tool evidence never reads as a rollback — but an equal-share
    // finding at a later date is kept as a flat segment (re-corroboration).
    const anchors: TrajectoryAnchor[] = [];
    let best = 0;
    for (const r of dated) {
      const prev = anchors[anchors.length - 1];
      if (r.share < best && prev && prev.date !== r.date) continue;
      if (r.share > best) best = r.share;
      const anchor: TrajectoryAnchor = {
        date: r.date,
        t: r.t,
        share: best,
        tool: r.tool_name,
        sourceTitle: r.source_title,
      };
      if (prev && prev.date === r.date) {
        if (best > prev.share) anchors[anchors.length - 1] = anchor;
      } else {
        anchors.push(anchor);
      }
    }

    const first = anchors[0].share;
    const delta = best - first;
    trajectories.push({
      abbr,
      name,
      anchors,
      first,
      best,
      delta,
      emphasized: anchors.length > 1 && delta >= EMPHASIS_DELTA,
      single: anchors.length === 1,
    });
  }
  if (trajectories.length === 0) return null;

  trajectories.sort((a, b) => b.best - a.best || a.abbr.localeCompare(b.abbr));

  return {
    trajectories,
    mandateT: Date.parse(LLM_MANDATE_DATE),
    climberCount: trajectories.filter((t) => t.emphasized).length,
    singleAnchorCount: trajectories.filter((t) => t.single).length,
  };
}

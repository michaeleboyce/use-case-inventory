/**
 * Data assembly for /fedramp/coverage/lab — four deliberately different
 * visual grammars over the same FedRAMP × adoption data, built as sketches
 * so the reader (and the author) can feel which framing lands.
 *
 * One payload feeds all four sections; every number reuses the guarded
 * query layer (degrades to null when sidecars are absent). Guardrail 7
 * applies everywhere downstream: "reach" counts services in scope of a
 * package the agency holds an ATO for — never "enabled".
 */

import {
  getAccessShareAnchors,
  getFirstCoreAiAtoByAgency,
  getSleepingServicePairs,
  hasSleepingServices,
} from "@/lib/db";
import {
  buildFrontierAccessModel,
  type DecouplingPoint,
} from "@/app/_view-models/frontier-access";

/** One agency, everything the four sketches need. */
export interface LabAgency {
  abbr: string;
  name: string;
  /** AI-eligible workforce; null when no profile. */
  eligible: number | null;
  /** Estimated share of eligible staff with a general tool (0–1). */
  share: number;
  imputed: boolean;
  noAssessment: boolean;
  /** Core-AI services in scope of held packages. */
  reach: number;
  /** Sleeping (peer-proven, unreported) product pairs at this agency. */
  sleeping: number;
  /** Of those, pairs with nothing similar deployed. */
  voids: number;
}

/** One product's lead/sleeper structure for the peer-proof arcs. */
export interface LabPair {
  product: string;
  gen_ai: boolean;
  leads: string[];
  /** Sleeping holders; voids ⊆ sleepers. */
  sleepers: string[];
  voids: string[];
}

export interface LabEvent {
  /** ISO date (may be partial for rollout evidence). */
  date: string;
  kind: "ato" | "rollout";
  abbr: string;
}

export interface LabModel {
  agencies: LabAgency[];
  pairs: LabPair[];
  events: LabEvent[];
  totals: { eligible: number; agencies: number };
}

export function buildLabModel(): LabModel | null {
  let access: ReturnType<typeof buildFrontierAccessModel>;
  try {
    access = buildFrontierAccessModel();
  } catch {
    return null;
  }
  if (!access) return null;

  const byAbbr = new Map<string, LabAgency>();
  const fromPoint = (p: DecouplingPoint): LabAgency => ({
    abbr: p.abbr,
    name: p.name,
    eligible: p.eligible,
    share: p.share,
    imputed: p.imputed,
    noAssessment: p.noAssessment,
    reach: p.reach,
    sleeping: 0,
    voids: 0,
  });
  for (const p of access.scatter) byAbbr.set(p.abbr, fromPoint(p));

  // Sleeping pairs → per-agency counts + product lead/sleeper structure.
  const pairs: LabPair[] = [];
  try {
    if (hasSleepingServices()) {
      const raw = getSleepingServicePairs();
      const byProduct = new Map<string, LabPair>();
      for (const r of raw) {
        let entry = byProduct.get(r.product);
        if (!entry) {
          entry = {
            product: r.product,
            gen_ai: r.gen_ai === 1,
            leads: [],
            sleepers: [],
            voids: [],
          };
          byProduct.set(r.product, entry);
        }
        if (r.role === "lead") {
          if (!entry.leads.includes(r.agency_abbr)) entry.leads.push(r.agency_abbr);
        } else {
          if (!entry.sleepers.includes(r.agency_abbr)) {
            entry.sleepers.push(r.agency_abbr);
          }
          if (!r.similar_deployed && !entry.voids.includes(r.agency_abbr)) {
            entry.voids.push(r.agency_abbr);
          }
          const a = byAbbr.get(r.agency_abbr);
          if (a) {
            a.sleeping += 1;
            if (!r.similar_deployed) a.voids += 1;
          }
        }
      }
      pairs.push(...byProduct.values());
    }
  } catch {
    // Sleeping sidecar absent — sketches that need pairs render empty.
  }

  const events: LabEvent[] = [];
  try {
    for (const r of getFirstCoreAiAtoByAgency()) {
      if (r.agency_abbreviation) {
        events.push({ date: r.first_ato_date, kind: "ato", abbr: r.agency_abbreviation });
      }
    }
    for (const r of getAccessShareAnchors()) {
      events.push({ date: r.source_date, kind: "rollout", abbr: r.agency_abbreviation });
    }
  } catch {
    // Timeline sketch degrades.
  }

  const agencies = [...byAbbr.values()].sort((a, b) => b.reach - a.reach);
  return {
    agencies,
    pairs: pairs.sort((a, b) => b.sleepers.length - a.sleepers.length),
    events,
    totals: {
      eligible: agencies.reduce((s, a) => s + (a.eligible ?? 0), 0),
      agencies: agencies.length,
    },
  };
}

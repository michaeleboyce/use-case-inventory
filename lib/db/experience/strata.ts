/**
 * Assembles the stratified seat model's inputs from the labeled DB.
 *
 * Sources:
 *  - consolidated_use_cases (banded rows) x consolidated_band_labels
 *    (the band_labels_2026-07 population labels)
 *  - consolidated_use_case_products -> products, rolled up to the root
 *    family via parent_product_id (display/pivot only — the model
 *    aggregates per stratum)
 *  - agency_workforce_profile (level='agency'; denominator_basis-aware)
 *  - agency_occupation_counts (FedScope occupational caps per stratum)
 *
 * Rows labeled `excluded_not_seats` or counted in non-person units
 * (devices, public users, applications) are NOT model inputs — they're
 * returned separately as correction buckets so the waterfall can show
 * exactly what was removed and why, instead of silently dropping it.
 */

import { getDb } from "../shared/init";
import type {
  AgencySeatModelInput,
  LabelConfidence,
  ProvenanceSlice,
  Stratum,
  StratumReachInput,
  UnitCounted,
} from "../../experience-shared";

const BAND_LOWER_SQL = `
  CASE c.estimated_licenses_users
    WHEN '1-100'         THEN 1
    WHEN '101-1000'      THEN 101
    WHEN '1001-5000'     THEN 1001
    WHEN '5001-10,000'   THEN 5001
    WHEN '10,000-50,000' THEN 10000
    WHEN '50,000+'       THEN 50000
    ELSE 0
  END
`;
const BAND_MID_SQL = `
  CASE c.estimated_licenses_users
    WHEN '1-100'         THEN 50
    WHEN '101-1000'      THEN 550
    WHEN '1001-5000'     THEN 3000
    WHEN '5001-10,000'   THEN 7500
    WHEN '10,000-50,000' THEN 30000
    WHEN '50,000+'       THEN 75000
    ELSE 0
  END
`;
const BAND_UPPER_SQL = `
  CASE c.estimated_licenses_users
    WHEN '1-100'         THEN 100
    WHEN '101-1000'      THEN 1000
    WHEN '1001-5000'     THEN 5000
    WHEN '5001-10,000'   THEN 10000
    WHEN '10,000-50,000' THEN 50000
    WHEN '50,000+'       THEN 100000
    ELSE 0
  END
`;

/** Non-person units — excluded from the model, shown in the waterfall. */
const NON_SEAT_UNITS = new Set<UnitCounted>([
  "devices_endpoints",
  "public_users",
  "applicants_cases",
]);

interface LabeledBandRow {
  agency_id: number;
  abbreviation: string;
  agency_name: string;
  slug: string;
  title: string;
  band_label: string;
  band_lower: number;
  band_mid: number;
  band_upper: number;
  unit_counted: UnitCounted;
  population: string;
  org_scope: string;
  stratum: string;
  confidence: LabelConfidence;
  reasoning: string | null;
  audited: number;
  families: string | null;
}

function fetchLabeledRows(): LabeledBandRow[] {
  return getDb()
    .prepare<[], LabeledBandRow>(`
      SELECT c.agency_id,
             a.abbreviation,
             a.name              AS agency_name,
             c.slug,
             c.ai_use_case       AS title,
             c.estimated_licenses_users AS band_label,
             ${BAND_LOWER_SQL}   AS band_lower,
             ${BAND_MID_SQL}     AS band_mid,
             ${BAND_UPPER_SQL}   AS band_upper,
             l.unit_counted,
             l.population,
             l.org_scope,
             l.stratum,
             l.confidence,
             l.reasoning,
             l.audited,
             (SELECT GROUP_CONCAT(DISTINCT COALESCE(root.canonical_name,
                                                    p.canonical_name))
                FROM consolidated_use_case_products cp
                JOIN products p ON p.id = cp.product_id
                LEFT JOIN products root ON root.id = p.parent_product_id
               WHERE cp.consolidated_use_case_id = c.id) AS families
        FROM consolidated_use_cases c
        JOIN agencies a ON a.id = c.agency_id
        JOIN consolidated_band_labels l ON l.consolidated_use_case_id = c.id
       WHERE c.estimated_licenses_users IS NOT NULL
         AND c.estimated_licenses_users != ''
       ORDER BY a.abbreviation, c.slug
    `)
    .all();
}

export interface SeatModelSourceData {
  inputs: AgencySeatModelInput[];
  /** Band mass removed before modeling, by reason — feeds the waterfall. */
  corrections: ProvenanceSlice[];
  /** All labeled rows (model + excluded) for evidence tables. */
  rows: LabeledBandRow[];
}

export type { LabeledBandRow };

export function getStratifiedSeatInputs(): SeatModelSourceData {
  const rows = fetchLabeledRows();

  // Workforce denominators, denominator_basis-aware.
  const workforce = new Map<
    number,
    {
      eligible: number;
      total_headcount: number;
      contractor_headcount: number | null;
      denominator_basis: string | null;
      headcount_as_of: string | null;
      headcount_source_url: string | null;
    }
  >();
  for (const r of getDb()
    .prepare<
      [],
      {
        agency_id: number | null;
        total_headcount: number | null;
        contractor_headcount: number | null;
        denominator_basis: string | null;
        ai_eligible_share: number | null;
        headcount_as_of: string | null;
        headcount_source_url: string | null;
      }
    >(`
      SELECT agency_id, total_headcount, contractor_headcount,
             denominator_basis, ai_eligible_share, headcount_as_of,
             headcount_source_url
        FROM agency_workforce_profile
       WHERE level = 'agency'
         AND total_headcount IS NOT NULL
         AND ai_eligible_share IS NOT NULL
    `)
    .all()) {
    if (r.agency_id == null) continue;
    const base =
      r.denominator_basis === "incl_contractors"
        ? (r.total_headcount ?? 0) + (r.contractor_headcount ?? 0)
        : (r.total_headcount ?? 0);
    workforce.set(r.agency_id, {
      eligible: Math.round(base * (r.ai_eligible_share ?? 0)),
      total_headcount: r.total_headcount ?? 0,
      contractor_headcount: r.contractor_headcount,
      denominator_basis: r.denominator_basis,
      headcount_as_of: r.headcount_as_of,
      headcount_source_url: r.headcount_source_url,
    });
  }

  // Occupation caps: latest as_of per (agency, series), summed per stratum.
  const caps = new Map<number, Partial<Record<Stratum, number>>>();
  for (const r of getDb()
    .prepare<
      [],
      { agency_id: number | null; stratum: string; headcount: number }
    >(`
      SELECT o.agency_id, o.stratum, o.headcount
        FROM agency_occupation_counts o
       WHERE o.as_of = (SELECT MAX(o2.as_of) FROM agency_occupation_counts o2
                         WHERE o2.organization_slug = o.organization_slug
                           AND o2.occ_series = o.occ_series)
    `)
    .all()) {
    if (r.agency_id == null) continue;
    const byStratum = caps.get(r.agency_id) ?? {};
    const s = r.stratum as Stratum;
    byStratum[s] = (byStratum[s] ?? 0) + r.headcount;
    caps.set(r.agency_id, byStratum);
  }

  const byAgency = new Map<number, AgencySeatModelInput>();
  const correctionMass = new Map<string, { seats: number; rows: number }>();

  for (const row of rows) {
    const isNonSeatUnit = NON_SEAT_UNITS.has(row.unit_counted);
    const isExcludedStratum = row.stratum === "excluded_not_seats";
    if (isNonSeatUnit || isExcludedStratum) {
      const key = isNonSeatUnit ? `unit:${row.unit_counted}` : "excluded_stratum";
      const cur = correctionMass.get(key) ?? { seats: 0, rows: 0 };
      cur.seats += row.band_mid;
      cur.rows += 1;
      correctionMass.set(key, cur);
      continue;
    }

    let agency = byAgency.get(row.agency_id);
    if (!agency) {
      const w = workforce.get(row.agency_id);
      agency = {
        agency_id: row.agency_id,
        abbreviation: row.abbreviation,
        name: row.agency_name,
        eligible: w?.eligible ?? null,
        total_headcount: w?.total_headcount ?? null,
        contractor_headcount: w?.contractor_headcount ?? null,
        denominator_basis: w?.denominator_basis ?? null,
        headcount_as_of: w?.headcount_as_of ?? null,
        headcount_source_url: w?.headcount_source_url ?? null,
        stratum_caps: caps.get(row.agency_id) ?? {},
        reaches: [],
      };
      byAgency.set(row.agency_id, agency);
    }
    const reach: StratumReachInput = {
      slug: row.slug,
      stratum: row.stratum as Stratum,
      family: row.families?.split(",")[0] ?? row.title.slice(0, 40),
      band_label: row.band_label,
      band_lower: row.band_lower,
      band_mid: row.band_mid,
      band_upper: row.band_upper,
      unit_counted: row.unit_counted,
      confidence: row.confidence,
      audited: row.audited === 1,
      title: row.title,
    };
    agency.reaches.push(reach);
  }

  const CORRECTION_LABELS: Record<string, string> = {
    "unit:devices_endpoints": "Devices & endpoints (not people)",
    "unit:public_users": "Members of the public",
    "unit:applicants_cases": "Applications & cases processed",
    excluded_stratum: "Non-seat rows (consumer/ambient AI)",
  };
  const corrections: ProvenanceSlice[] = [...correctionMass.entries()].map(
    ([key, v]) => ({
      key,
      label: CORRECTION_LABELS[key] ?? key,
      seats_mass: v.seats,
      rows: v.rows,
    }),
  );

  return {
    inputs: [...byAgency.values()],
    corrections,
    rows,
  };
}

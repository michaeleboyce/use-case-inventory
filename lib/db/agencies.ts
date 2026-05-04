/**
 * Agency queries — the `agencies` table and its derived shapes
 * (`AgencyMaturity` join, comparison payloads, filter dropdown options).
 *
 * Cross-domain: `getAgencyCompareData` composes results from analytics and
 * products domain helpers; until those move into their own modules, it
 * imports from the legacy `../db` barrel (a benign ESM cycle on hoisted
 * function exports).
 */

import { getDb } from "./shared/init";
import type { Agency, AgencyMaturity, AgencyWithMaturity } from "../types";
import { getProductsForAgency } from "./products";
import { getEntryTypeBreakdown, getAISophisticationBreakdown } from "./analytics";

export function getAgencies(): Agency[] {
  const stmt = getDb().prepare<[], Agency>(`
    SELECT *
      FROM agencies
     WHERE status IN ('FOUND_2025', 'FOUND_2024_ONLY')
     ORDER BY name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

/** Every row in the `agencies` table, including those with no data. */
export function getAllAgenciesIncludingEmpty(): Agency[] {
  const stmt = getDb().prepare<[], Agency>(`
    SELECT * FROM agencies ORDER BY name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

/** Look up a single agency by its abbreviation (e.g. "VA", "DHS"). */
export function getAgencyByAbbr(abbr: string): AgencyWithMaturity | null {
  const stmt = getDb().prepare<[string], Agency>(`
    SELECT * FROM agencies WHERE LOWER(abbreviation) = LOWER(?) LIMIT 1
  `);
  const agency = stmt.get(abbr);
  if (!agency) return null;
  const maturity = getMaturityForAgency(agency.id);
  return { ...agency, maturity };
}

/** Look up a single agency by numeric primary key. */
export function getAgencyById(id: number): AgencyWithMaturity | null {
  const stmt = getDb().prepare<[number], Agency>(
    `SELECT * FROM agencies WHERE id = ? LIMIT 1`,
  );
  const agency = stmt.get(id);
  if (!agency) return null;
  const maturity = getMaturityForAgency(agency.id);
  return { ...agency, maturity };
}

function getMaturityForAgency(agencyId: number): AgencyMaturity | null {
  const stmt = getDb().prepare<[number], AgencyMaturity>(
    `SELECT * FROM agency_ai_maturity WHERE agency_id = ? LIMIT 1`,
  );
  return stmt.get(agencyId) ?? null;
}

/** Every `agency_ai_maturity` row joined onto its parent agency. */
export function getAgencyMaturity(): AgencyWithMaturity[] {
  // We query the two tables in one shot and assemble into the shape
  // `AgencyWithMaturity` on the JS side. Two prepared statements are cheap.
  const agencies = getDb()
    .prepare<[], Agency>(
      `SELECT a.*
         FROM agencies a
         JOIN agency_ai_maturity m ON m.agency_id = a.id
        ORDER BY a.name COLLATE NOCASE ASC`,
    )
    .all();
  const maturityRows = getDb()
    .prepare<[], AgencyMaturity>(`SELECT * FROM agency_ai_maturity`)
    .all();
  const byAgency = new Map<number, AgencyMaturity>();
  for (const m of maturityRows) byAgency.set(m.agency_id, m);
  return agencies.map((a) => ({ ...a, maturity: byAgency.get(a.id) ?? null }));
}

export function getRecentlyModifiedAgencies(n = 5): Agency[] {
  const stmt = getDb().prepare<[number], Agency>(`
    SELECT *
      FROM agencies
     WHERE status IN ('FOUND_2025','FOUND_2024_ONLY')
       AND last_modified IS NOT NULL
     ORDER BY last_modified DESC
     LIMIT ?
  `);
  return stmt.all(n);
}

/** Agencies that show up in the use-case explorer's agency filter. Switched
 *  from `inventory_entries` membership to `IN (SELECT DISTINCT agency_id FROM
 *  inventory_entries)` after a regression where the dropdown was filtering
 *  on `status IN ('FOUND_2025','FOUND_2024_ONLY')`, which excluded agencies
 *  whose only 2025 data is consolidated (EXIM/NEH/FLRA) and included
 *  agencies that have neither (status=FOUND_2024_ONLY: PT/USAGM/USCCR). */
export function getAgencyOptions(): Array<{
  id: number;
  name: string;
  abbreviation: string;
}> {
  return getDb()
    .prepare<[], { id: number; name: string; abbreviation: string }>(
      `SELECT id, name, abbreviation
         FROM agencies
        WHERE id IN (SELECT DISTINCT agency_id FROM inventory_entries)
        ORDER BY name COLLATE NOCASE ASC`,
    )
    .all();
}

/** Agencies with an `inventory_page_url`. Used by About page data-sources list. */
export function getAgencyInventoryLinks(): Array<{
  id: number;
  name: string;
  abbreviation: string;
  inventory_page_url: string | null;
  csv_download_url: string | null;
  date_accessed: string | null;
}> {
  return getDb()
    .prepare<
      [],
      {
        id: number;
        name: string;
        abbreviation: string;
        inventory_page_url: string | null;
        csv_download_url: string | null;
        date_accessed: string | null;
      }
    >(`
      SELECT id, name, abbreviation, inventory_page_url, csv_download_url, date_accessed
        FROM agencies
       WHERE inventory_page_url IS NOT NULL AND inventory_page_url <> ''
       ORDER BY name COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Full comparison payload for a single agency — everything the /compare grid
 * needs, in one round trip.
 */
export interface AgencyCompareData {
  id: number;
  name: string;
  abbreviation: string;
  agency_type: string | null;
  status: string | null;
  maturity_tier: string | null;
  total_use_cases: number;
  distinct_products_deployed: number;
  general_llm_count: number;
  coding_tool_count: number;
  agentic_ai_count: number;
  custom_system_count: number;
  pct_deployed: number | null;
  pct_high_impact: number | null;
  pct_with_risk_docs: number | null;
  year_over_year_growth: number | null;
  has_enterprise_llm: number | null;
  has_coding_assistants: number | null;
  entry_type_mix: {
    custom_system: number;
    product_deployment: number;
    bespoke_application: number;
    generic_use_pattern: number;
    product_feature: number;
    unknown: number;
  };
  ai_sophistication_mix: Array<{ label: string; count: number }>;
  top_products: Array<{
    id: number;
    canonical_name: string;
    vendor: string | null;
    use_case_count: number;
  }>;
}

export function getAgencyCompareData(
  abbr: string,
): AgencyCompareData | null {
  const agency = getAgencyByAbbr(abbr);
  if (!agency) return null;

  const m = agency.maturity;
  const entryRows = getEntryTypeBreakdown(agency.id);
  const entryMix = {
    custom_system: 0,
    product_deployment: 0,
    bespoke_application: 0,
    generic_use_pattern: 0,
    product_feature: 0,
    unknown: 0,
  };
  for (const r of entryRows) {
    const key = r.label as keyof typeof entryMix;
    if (key in entryMix) entryMix[key] += r.count;
    else entryMix.unknown += r.count;
  }
  const sophistication = getAISophisticationBreakdown(agency.id).map((r) => ({
    label: r.label,
    count: r.count,
  }));
  const topProducts = getProductsForAgency(agency.id).slice(0, 5);

  return {
    id: agency.id,
    name: agency.name,
    abbreviation: agency.abbreviation,
    agency_type: agency.agency_type,
    status: agency.status,
    maturity_tier: m?.maturity_tier ?? null,
    total_use_cases: m?.total_use_cases ?? 0,
    distinct_products_deployed: m?.distinct_products_deployed ?? 0,
    general_llm_count: m?.general_llm_count ?? 0,
    coding_tool_count: m?.coding_tool_count ?? 0,
    agentic_ai_count: m?.agentic_ai_count ?? 0,
    custom_system_count: m?.custom_system_count ?? 0,
    pct_deployed: m?.pct_deployed ?? null,
    pct_high_impact: m?.pct_high_impact ?? null,
    pct_with_risk_docs: m?.pct_with_risk_docs ?? null,
    year_over_year_growth: m?.year_over_year_growth ?? null,
    has_enterprise_llm: m?.has_enterprise_llm ?? null,
    has_coding_assistants: m?.has_coding_assistants ?? null,
    entry_type_mix: entryMix,
    ai_sophistication_mix: sophistication,
    top_products: topProducts,
  };
}

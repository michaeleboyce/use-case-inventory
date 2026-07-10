import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getCloudCfoAtoSeries,
  getFederalLlmAccessBullishSeries,
  getFederalLlmAccessSeries,
} from "@/lib/db/adoption";

/**
 * The two live AdoptionSeries computed from the DB for the /adoption
 * comparison chart: cloud (share of CFO Act agencies with ≥1 FedRAMP agency
 * ATO by date) and federal LLM access (cumulative corroborated-share-weighted
 * share of the AI-eligible workforce).
 *
 * NOTE: the live DB spells agency_type 'CFO_ACT'; the shared seed's agencies
 * use 'CFO Act' and therefore stay out of the denominator — the CFO Act
 * population here is exactly the two agencies inserted below.
 */
describe("lib/db/adoption — live series", () => {
  let db: BetterSqlite3.Database;

  beforeAll(() => {
    db = installTestDb();

    // Two CFO Act agencies (custom rows; seed rows use a different label).
    const ag = db.prepare(
      "INSERT INTO agencies (id, name, abbreviation, agency_type, status) VALUES (?, ?, ?, 'CFO_ACT', 'FOUND_2025')",
    );
    ag.run(11, "Alpha Department", "ALPHA");
    ag.run(12, "Beta Department", "BETA");

    db.prepare(
      "INSERT INTO fedramp_products (fedramp_id, csp, csp_slug, cso, status, impact_level) VALUES ('FR_C', 'Acme', 'acme', 'Acme Cloud', 'FedRAMP Authorized', 'Moderate')",
    ).run();
    db.prepare(
      "INSERT INTO fedramp_agencies (id, parent_agency, parent_slug) VALUES (200, 'Alpha', 'alpha'), (201, 'Beta', 'beta')",
    ).run();
    db.prepare(
      "INSERT INTO fedramp_agency_links (inventory_agency_id, fedramp_agency_id, confidence, source) VALUES (11, 200, 'strong', 't'), (12, 201, 'strong', 't')",
    ).run();
    const auth = db.prepare(
      "INSERT INTO fedramp_authorizations (fedramp_id, agency_id, ato_issuance_date) VALUES ('FR_C', ?, ?)",
    );
    auth.run(200, "2014-03-01");
    auth.run(200, "2016-01-01"); // later ATO — MIN wins
    auth.run(201, "2017-06-15");

    // Workforce + evidence for the LLM series.
    const org = db.prepare(
      "INSERT INTO federal_organizations (id, name, slug, level) VALUES (?, ?, ?, 'department')",
    );
    org.run(9011, "Alpha Org", "alpha-org");
    org.run(9012, "Beta Org", "beta-org");
    const wf = db.prepare(
      `INSERT INTO agency_workforce_profile
         (organization_id, agency_id, level, total_headcount,
          contractor_headcount, denominator_basis, ai_eligible_share, captured_at)
       VALUES (?, ?, 'agency', ?, NULL, NULL, ?, '2026-07-01')`,
    );
    wf.run(9011, 11, 100_000, 0.5); // ALPHA eligible 50k
    wf.run(9012, 12, 100_000, 0.5); // BETA eligible 50k

    const ev = db.prepare(
      `INSERT INTO agency_ai_access_evidence
         (agency_id, agency_abbreviation, finding, coverage_assessment,
          estimated_share_of_eligible, status, source_date, captured_at)
       VALUES (?, ?, 'f', ?, ?, ?, ?, '2026-07-01')`,
    );
    // ALPHA: pilot 10% (2025-01), later upgraded to 60% (2026-01).
    ev.run(11, "ALPHA", "pilot", 0.1, "corroborated", "2025-01-15");
    ev.run(11, "ALPHA", "all", 0.6, "corroborated", "2026-01-15");
    // BETA: corroborated but UNDATED — must not contribute.
    ev.run(12, "BETA", "all", 0.9, "corroborated", null);
    // BETA: dated but searched_no_source — must not contribute.
    ev.run(12, "BETA", "pilot", 0.5, "searched_no_source", "2025-06-01");
  });

  afterAll(() => uninstallTestDb());

  it("cloud series: cumulative CFO Act share by first-ATO date", () => {
    const s = getCloudCfoAtoSeries();
    expect(s).not.toBeNull();
    expect(s!.unit).toBe("percent");
    expect(s!.points).toEqual([
      { date: "2011-12-08", value: 0 },
      { date: "2014-03-01", value: 50 }, // ALPHA (1 of 2), MIN date wins
      { date: "2017-06-15", value: 100 }, // BETA
    ]);
  });

  it("LLM series: corroborated, dated, best-share-weighted floor", () => {
    const s = getFederalLlmAccessSeries();
    expect(s).not.toBeNull();
    // Total eligible = 100k. ALPHA 50k × 10% = 5% → later 50k × 60% = 30%.
    expect(s!.points).toEqual([
      { date: "2022-11-30", value: 0 },
      { date: "2025-01-15", value: 5 },
      { date: "2026-01-15", value: 30 },
    ]);
  });

  it("LLM series ignores undated and non-corroborated evidence", () => {
    const s = getFederalLlmAccessSeries()!;
    // BETA never contributes: max value stays at ALPHA's 30%.
    expect(Math.max(...s.points.map((p) => p.value))).toBe(30);
  });

  it("bullish series counts full eligible workforce from first evidence", () => {
    const s = getFederalLlmAccessBullishSeries();
    expect(s).not.toBeNull();
    // ALPHA's full 50k of 100k counts from its FIRST anchor; the later
    // share upgrade adds nothing; BETA (undated / non-corroborated) never
    // contributes.
    expect(s!.points).toEqual([
      { date: "2022-11-30", value: 0 },
      { date: "2025-01-15", value: 50 },
    ]);
    expect(s!.id).toBe("federal-llm-access-bullish");
  });

  it("cloud series degrades to null without CFO Act ATO rows", () => {
    db.exec("DELETE FROM fedramp_authorizations");
    expect(getCloudCfoAtoSeries()).toBeNull();
  });
});

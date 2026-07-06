import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import { getAgencyEligibleWorkforce, getStratifiedSeatInputs } from "@/lib/db";

/**
 * getAgencyEligibleWorkforce: the lean per-agency AI-eligible denominator
 * for reach-vs-access joins. Must apply the same denominator_basis-aware
 * arithmetic as the seat model (shared workforceBase helper).
 */
describe("lib/db/experience — getAgencyEligibleWorkforce", () => {
  let db: BetterSqlite3.Database;

  beforeAll(() => {
    db = installTestDb();
    const org = db.prepare(
      "INSERT INTO federal_organizations (id, name, slug, level) VALUES (?, ?, ?, 'department')",
    );
    org.run(9001, "VA Org", "va-org");
    org.run(9002, "DHS Org", "dhs-org");
    org.run(9003, "GSA Org", "gsa-org");
    org.run(9004, "Bar Org", "bar-org");
    const wf = db.prepare(
      `INSERT INTO agency_workforce_profile
         (organization_id, agency_id, level, total_headcount,
          contractor_headcount, denominator_basis, ai_eligible_share,
          captured_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '2026-07-01')`,
    );
    // VA: plain federal basis — eligible = 100000 × 0.6
    wf.run(9001, 1, "agency", 100_000, 50_000, "federal_employees", 0.6);
    // DHS: contractor-inclusive basis — eligible = (80000 + 20000) × 0.3
    wf.run(9002, 2, "agency", 80_000, 20_000, "incl_contractors", 0.3);
    // GSA: bureau-level row — must be ignored (level != 'agency')
    wf.run(9003, 3, "bureau", 12_000, null, null, 0.9);
    // BAR: missing eligible share — must be ignored
    wf.run(9004, 5, "agency", 5_000, null, null, null);
  });

  afterAll(() => uninstallTestDb());

  it("computes eligible with the denominator_basis-aware base", () => {
    const rows = getAgencyEligibleWorkforce();
    const byAbbr = Object.fromEntries(rows.map((r) => [r.abbreviation, r]));
    expect(byAbbr.VA.eligible).toBe(60_000);
    expect(byAbbr.DHS.eligible).toBe(30_000); // contractors counted
    expect(byAbbr.DHS.total_headcount).toBe(80_000); // headcount stays federal-only
  });

  it("only returns agency-level rows with both headcount and share", () => {
    const abbrs = getAgencyEligibleWorkforce().map((r) => r.abbreviation);
    expect(abbrs.sort()).toEqual(["DHS", "VA"]);
  });

  it("sorts by eligible descending", () => {
    const rows = getAgencyEligibleWorkforce();
    expect(rows[0].abbreviation).toBe("VA");
  });

  it("matches the seat model's eligible arithmetic for the same agencies", () => {
    const lean = getAgencyEligibleWorkforce();
    const seat = getStratifiedSeatInputs();
    for (const input of seat.inputs) {
      const twin = lean.find((r) => r.agency_id === input.agency_id);
      if (twin && input.eligible != null) {
        expect(twin.eligible).toBe(input.eligible);
      }
    }
  });
});

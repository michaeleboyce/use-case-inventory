import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  buildFrontierAccessModel,
  classifyDecoupling,
  largestRemainder,
  WAFFLE_UNIT,
} from "@/app/_view-models/frontier-access";

/**
 * The shared reach-vs-access view-model behind the decoupling scatter and
 * the people waffle.
 *
 * Scenario: VA and DHS hold ATOs on FR_AI (core-AI in scope); GSA holds
 * nothing. VA has a corroborated 90% share (filled dot, top-right); DHS has
 * a pilot tier with no corroborated share (hollow, imputed 2%); GSA has no
 * evidence row at all (hollow at 0, no reach → "neither" pool).
 */
describe("app/_view-models/frontier-access", () => {
  let db: BetterSqlite3.Database;

  beforeAll(() => {
    db = installTestDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS fedramp_ai_service_classification (
        service TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        confidence TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        signals TEXT,
        model TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        classified_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'llm'
      );
    `);
    db.prepare(
      "INSERT INTO fedramp_products (fedramp_id, csp, csp_slug, cso, status, impact_level) VALUES ('FR_AI', 'Acme', 'acme', 'Acme GovCloud', 'FedRAMP Authorized', 'High')",
    ).run();
    db.prepare(
      "INSERT INTO fedramp_authorized_services (fedramp_id, service, recency) VALUES ('FR_AI', 'Test Bedrock', 'older')",
    ).run();
    db.prepare(
      `INSERT INTO fedramp_ai_service_classification
         (service, category, confidence, reasoning, signals, model, input_hash, classified_at, source)
       VALUES ('Test Bedrock', 'core_ai', 'high', 'test', NULL, 'm', 'h', '2026-01-01', 'qc_confirmed')`,
    ).run();
    db.prepare(
      "INSERT INTO fedramp_agencies (id, parent_agency, parent_slug) VALUES (100, 'Veterans Affairs', 'va'), (101, 'Homeland Security', 'dhs')",
    ).run();
    db.prepare(
      "INSERT INTO fedramp_agency_links (inventory_agency_id, fedramp_agency_id, confidence, source) VALUES (1, 100, 'strong', 't'), (2, 101, 'strong', 't')",
    ).run();
    db.prepare(
      "INSERT INTO fedramp_authorizations (fedramp_id, agency_id, ato_issuance_date) VALUES ('FR_AI', 100, '2023-05-01'), ('FR_AI', 101, '2024-01-15')",
    ).run();

    const ev = db.prepare(
      `INSERT INTO agency_ai_access_evidence
         (agency_id, agency_abbreviation, finding, coverage_assessment,
          estimated_share_of_eligible, status, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, '2026-07-01')`,
    );
    // VA: corroborated near-universal access.
    ev.run(1, "VA", "StateChat-style rollout", "all", 0.9, "corroborated");
    // DHS: pilot tier, no corroborated share → imputed from prior (0.02).
    ev.run(2, "DHS", "pilot only", "pilot", null, "searched_no_source");

    const org = db.prepare(
      "INSERT INTO federal_organizations (id, name, slug, level) VALUES (?, ?, ?, 'department')",
    );
    org.run(9001, "VA Org", "va-org");
    org.run(9002, "DHS Org", "dhs-org");
    org.run(9003, "GSA Org", "gsa-org");
    const wf = db.prepare(
      `INSERT INTO agency_workforce_profile
         (organization_id, agency_id, level, total_headcount,
          contractor_headcount, denominator_basis, ai_eligible_share, captured_at)
       VALUES (?, ?, 'agency', ?, NULL, NULL, ?, '2026-07-01')`,
    );
    wf.run(9001, 1, 100_000, 0.5); // VA eligible 50k
    wf.run(9002, 2, 200_000, 0.25); // DHS eligible 50k
    wf.run(9003, 3, 40_000, 0.5); // GSA eligible 20k, no reach, no evidence
  });

  afterAll(() => uninstallTestDb());

  it("classifyDecoupling: high reach + low share only", () => {
    expect(classifyDecoupling(10, 0.05, 5)).toBe(true);
    expect(classifyDecoupling(10, 0.5, 5)).toBe(false); // access fine
    expect(classifyDecoupling(2, 0.0, 5)).toBe(false); // low reach
  });

  it("largestRemainder: apportions exactly and deterministically", () => {
    const out = largestRemainder([50, 30, 20], 10);
    expect(out).toEqual([5, 3, 2]);
    expect(largestRemainder([1, 1, 1], 10).reduce((a, b) => a + b)).toBe(10);
    expect(largestRemainder([0, 0, 0], 10)).toEqual([0, 0, 0]);
  });

  it("builds scatter points with corroborated vs imputed provenance", () => {
    const model = buildFrontierAccessModel();
    expect(model).not.toBeNull();
    const byAbbr = Object.fromEntries(model!.scatter.map((p) => [p.abbr, p]));
    expect(byAbbr.VA.share).toBe(0.9);
    expect(byAbbr.VA.imputed).toBe(false);
    expect(byAbbr.VA.eligible).toBe(50_000);
    expect(byAbbr.DHS.share).toBeCloseTo(0.02); // pilot prior
    expect(byAbbr.DHS.imputed).toBe(true);
    expect(byAbbr.DHS.noAssessment).toBe(false);
    // GSA holds no ATO → not a scatter point (reach list only).
    expect(byAbbr.GSA).toBeUndefined();
  });

  it("emphasizes the high-reach/low-access quadrant only", () => {
    const model = buildFrontierAccessModel()!;
    const byAbbr = Object.fromEntries(model.scatter.map((p) => [p.abbr, p]));
    // Both agencies have reach 1 (= median); VA's 90% share is never
    // emphasized, DHS's 2% is.
    expect(byAbbr.VA.emphasized).toBe(false);
    expect(byAbbr.DHS.emphasized).toBe(true);
  });

  it("caps direct labels at 8", () => {
    const model = buildFrontierAccessModel()!;
    expect(model.scatter.filter((p) => p.labeled).length).toBeLessThanOrEqual(8);
  });

  it("waffle: squares sum to round(eligible/unit) and states partition workers", () => {
    const model = buildFrontierAccessModel()!;
    const { totals, squares, unit } = model.waffle;
    expect(unit).toBe(WAFFLE_UNIT);
    expect(totals.eligible).toBe(120_000); // 50k + 50k + 20k
    expect(squares.length).toBe(Math.round(120_000 / WAFFLE_UNIT));
    expect(totals.access + totals.reachOnly + totals.neither).toBe(
      totals.eligible,
    );
    // GSA has no reach → its workers land in "neither".
    expect(totals.neither).toBeGreaterThan(0);
  });

  it("waffle squares carry dominant-agency hover detail", () => {
    const model = buildFrontierAccessModel()!;
    for (const sq of model.waffle.squares) {
      expect(sq.dominant).not.toBeNull();
      expect(sq.dominantWorkers).toBeGreaterThan(0);
    }
  });

  it("degrades to null when the FedRAMP sidecar is missing", () => {
    db.exec("DROP TABLE fedramp_ai_service_classification");
    expect(buildFrontierAccessModel()).toBeNull();
  });
});

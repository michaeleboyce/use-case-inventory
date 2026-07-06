import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import { getFirstCoreAiAtoByAgency } from "@/lib/db";

/**
 * Tests for the divergence-timeline clock: earliest agency ATO on any
 * package whose scope catalog carries a core-AI service.
 *
 * Scenario: FR_AI hosts "Test Bedrock" (core_ai); FR_PLAIN hosts only
 * "Test Backup" (not_ai). VA holds ATOs on both — but only the FR_AI dates
 * count. DHS holds FR_AI with a NULL issuance date only → excluded. GSA
 * holds FR_AI dated later than VA → ordering check.
 */
describe("lib/db/fedramp — getFirstCoreAiAtoByAgency", () => {
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

    const prod = db.prepare(
      "INSERT INTO fedramp_products (fedramp_id, csp, csp_slug, cso, status, impact_level) VALUES (?, ?, ?, ?, ?, ?)",
    );
    prod.run("FR_AI", "Acme Cloud", "acme-cloud", "Acme GovCloud", "FedRAMP Authorized", "High");
    prod.run("FR_PLAIN", "Initech", "initech", "Initech Files", "FedRAMP Authorized", "Moderate");

    const svc = db.prepare(
      "INSERT INTO fedramp_authorized_services (fedramp_id, service, recency) VALUES (?, ?, ?)",
    );
    svc.run("FR_AI", "Test Bedrock", "older");
    svc.run("FR_PLAIN", "Test Backup", "older");

    const cls = db.prepare(
      `INSERT INTO fedramp_ai_service_classification
         (service, category, confidence, reasoning, signals, model, input_hash, classified_at, source)
       VALUES (?, ?, 'high', 'test', NULL, 'test-model', 'hash', '2026-01-01', 'qc_confirmed')`,
    );
    cls.run("Test Bedrock", "core_ai");
    cls.run("Test Backup", "not_ai");

    const fedAg = db.prepare(
      "INSERT INTO fedramp_agencies (id, parent_agency, parent_slug) VALUES (?, ?, ?)",
    );
    fedAg.run(100, "Veterans Affairs", "veterans-affairs");
    fedAg.run(101, "Homeland Security", "homeland-security");
    fedAg.run(102, "General Services", "general-services");

    const link = db.prepare(
      "INSERT INTO fedramp_agency_links (inventory_agency_id, fedramp_agency_id, confidence, source) VALUES (?, ?, 'strong', 'test')",
    );
    link.run(1, 100); // VA
    link.run(2, 101); // DHS
    link.run(3, 102); // GSA

    const auth = db.prepare(
      "INSERT INTO fedramp_authorizations (fedramp_id, agency_id, ato_issuance_date) VALUES (?, ?, ?)",
    );
    auth.run("FR_AI", 100, "2023-05-01");
    auth.run("FR_PLAIN", 100, "2021-02-03"); // earlier, but not core-AI
    auth.run("FR_AI", 100, "2024-06-01"); // later duplicate — MIN wins
    auth.run("FR_AI", 101, null); // DHS: NULL date only → excluded
    auth.run("FR_AI", 102, "2024-01-15");
  });

  afterAll(() => uninstallTestDb());

  it("returns MIN core-AI ATO date per agency, ordered by date", () => {
    const rows = getFirstCoreAiAtoByAgency();
    expect(rows.map((r) => [r.agency_abbreviation, r.first_ato_date])).toEqual([
      ["VA", "2023-05-01"],
      ["GSA", "2024-01-15"],
    ]);
  });

  it("ignores non-core-AI packages when computing the first date", () => {
    const va = getFirstCoreAiAtoByAgency().find(
      (r) => r.agency_abbreviation === "VA",
    );
    // The 2021 FR_PLAIN ATO must not count.
    expect(va?.first_ato_date).toBe("2023-05-01");
  });

  it("excludes agencies with only NULL issuance dates", () => {
    const abbrs = getFirstCoreAiAtoByAgency().map((r) => r.agency_abbreviation);
    expect(abbrs).not.toContain("DHS");
  });

  it("degrades to [] when the classification sidecar is absent", () => {
    db.exec("DROP TABLE fedramp_ai_service_classification");
    expect(getFirstCoreAiAtoByAgency()).toEqual([]);
  });
});

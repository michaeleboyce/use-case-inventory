import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  hasServiceClassification,
  getAiServicesInScope,
  getAiServiceShelfCounts,
  getServicesInScopeForProduct,
  getAiServicesInReachForAgency,
  getFrontierReachByAgency,
} from "@/lib/db";

/**
 * Tests for the "shelf inside the shelf" surface — core-AI services in scope
 * of authorized packages (/fedramp/coverage/spread §services).
 *
 * Scenario: FR_HOST is an authorized package whose services-in-scope catalog
 * carries "Test Bedrock" (core_ai, qc_confirmed) and "Test Backup" (not_ai).
 * VA (inventory agency 1 ↔ fedramp agency 100) and DHS (2 ↔ 101) hold ATOs
 * on FR_HOST. FR_OTHER hosts only the not_ai service → never a shelf row.
 */
describe("lib/db/fedramp — services in scope (shelf inside the shelf)", () => {
  let db: BetterSqlite3.Database;

  beforeAll(() => {
    db = installTestDb();
    // Sidecar table is created by the ETL apply script; fixture schema only
    // carries mirror tables, so create it here (mirrors the real DDL).
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
    prod.run("FR_HOST", "Acme Cloud", "acme-cloud", "Acme GovCloud", "FedRAMP Authorized", "High");
    prod.run("FR_OTHER", "Initech", "initech", "Initech Files", "FedRAMP Authorized", "Moderate");

    const svc = db.prepare(
      "INSERT INTO fedramp_authorized_services (fedramp_id, service, recency) VALUES (?, ?, ?)",
    );
    svc.run("FR_HOST", "Test Bedrock", "older");
    svc.run("FR_HOST", "Test Backup", "older");
    svc.run("FR_OTHER", "Test Backup", "last_90");

    const cls = db.prepare(
      `INSERT INTO fedramp_ai_service_classification
         (service, category, confidence, reasoning, signals, model, input_hash, classified_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    cls.run("Test Bedrock", "core_ai", "high", "Managed foundation-model hosting.", "[]", "test-model", "h1", "2026-07-04T00:00:00Z", "qc_confirmed");
    cls.run("Test Backup", "not_ai", "high", "Plain backup service.", "[]", "test-model", "h2", "2026-07-04T00:00:00Z", "qc_confirmed");

    db.prepare("INSERT INTO fedramp_agencies (id, parent_agency, parent_slug) VALUES (?, ?, ?)").run(100, "Department of Veterans Affairs", "va");
    db.prepare("INSERT INTO fedramp_agencies (id, parent_agency, parent_slug) VALUES (?, ?, ?)").run(101, "Department of Homeland Security", "dhs");
    const al = db.prepare(
      "INSERT INTO fedramp_agency_links (inventory_agency_id, fedramp_agency_id, confidence, source) VALUES (?, ?, ?, ?)",
    );
    al.run(1, 100, "manual", "test");
    al.run(2, 101, "manual", "test");
    const ato = db.prepare(
      "INSERT INTO fedramp_authorizations (fedramp_id, agency_id, ato_type, ato_issuance_date) VALUES (?, ?, ?, ?)",
    );
    ato.run("FR_HOST", 100, "Initial", "2024-05-01");
    ato.run("FR_HOST", 101, "Reuse", "2025-02-01");
    ato.run("FR_OTHER", 100, "Initial", "2023-01-01");
  });
  afterAll(() => uninstallTestDb());

  it("reports the classification as present", () => {
    expect(hasServiceClassification()).toBe(true);
  });

  it("returns one row per core-AI service × host, with host-ATO agency count", () => {
    const rows = getAiServicesInScope();
    expect(rows).toHaveLength(1); // not_ai services never appear
    const r = rows[0];
    expect(r.service).toBe("Test Bedrock");
    expect(r.host_fedramp_id).toBe("FR_HOST");
    expect(r.impact_level).toBe("High");
    expect(r.source).toBe("qc_confirmed");
    expect(r.agencies_with_host_ato).toBe(2); // VA + DHS
  });

  it("computes the shelf headline counts", () => {
    const c = getAiServiceShelfCounts();
    expect(c.core_ai_services).toBe(1);
    expect(c.ai_featured_services).toBe(0);
    expect(c.host_packages).toBe(1); // FR_OTHER hosts no core-AI service
    expect(c.agencies_in_reach).toBe(2);
  });

  it("lists a product's services with AI labels first (Wave B)", () => {
    const host = getServicesInScopeForProduct("FR_HOST");
    expect(host.map((s) => s.service)).toEqual(["Test Bedrock", "Test Backup"]);
    expect(host[0].category).toBe("core_ai");
    expect(host[1].category).toBe("not_ai");

    const other = getServicesInScopeForProduct("FR_OTHER");
    expect(other).toHaveLength(1);
    expect(other[0].category).toBe("not_ai");
    expect(other[0].recency).toBe("last_90");

    expect(getServicesInScopeForProduct("FR_NOPE")).toEqual([]);
  });

  it("lists core-AI services in reach for an agency (Wave B)", () => {
    const va = getAiServicesInReachForAgency(1);
    expect(va).toHaveLength(1);
    expect(va[0].service).toBe("Test Bedrock");
    expect(va[0].host_fedramp_id).toBe("FR_HOST");
    expect(va[0].ato_issuance_date).toBe("2024-05-01"); // VA's own ATO date
    expect(getAiServicesInReachForAgency(3)).toEqual([]); // unmapped agency
  });

  it("rolls up frontier reach by agency (Wave B)", () => {
    const rows = getFrontierReachByAgency();
    expect(rows).toHaveLength(2); // VA and DHS both hold FR_HOST
    for (const r of rows) {
      expect(r.core_ai_services_in_reach).toBe(1);
      expect(r.host_packages).toBe(1);
    }
  });

  it("degrades to empty/zero when the sidecar table is absent", () => {
    db.exec("DROP TABLE fedramp_ai_service_classification");
    expect(hasServiceClassification()).toBe(false);
    expect(getAiServicesInScope()).toEqual([]);
    expect(getAiServiceShelfCounts()).toEqual({
      core_ai_services: 0,
      ai_featured_services: 0,
      host_packages: 0,
      agencies_in_reach: 0,
    });
    // Wave B guards: reach helpers empty; the per-product list still works
    // (labels degrade to null rather than hiding the catalog).
    expect(getAiServicesInReachForAgency(1)).toEqual([]);
    expect(getFrontierReachByAgency()).toEqual([]);
    const host = getServicesInScopeForProduct("FR_HOST");
    expect(host).toHaveLength(2);
    expect(host.every((s) => s.category === null)).toBe(true);
  });
});

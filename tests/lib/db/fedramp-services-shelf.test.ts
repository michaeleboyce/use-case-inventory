import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  hasServiceClassification,
  getAiServicesInScope,
  getAiServiceShelfCounts,
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
  });
});

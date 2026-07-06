import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import { buildDivergenceTimeline } from "@/app/fedramp/coverage/sleeping-services/_view-model";

/**
 * Tests for the divergence-timeline view-model builder.
 *
 * Scenario: FR_AI is an authorized package carrying core-AI service
 * "Test Bedrock". VA (inventory agency 1 ↔ fedramp agency 100) holds an ATO
 * dated 2023-05-01; DHS (2 ↔ 101) holds one dated 2024-01-15 → the ATO clock
 * ticks up once per agency at its first date. Rollout evidence: VA has a
 * dated, corroborated row (2025-10-01) that anchors; DHS's corroborated row
 * is undated (skipped) and its dated row is unsourced (skipped).
 */
describe("buildDivergenceTimeline", () => {
  let db: BetterSqlite3.Database;

  beforeAll(() => {
    db = installTestDb();
    // Sidecar created by the ETL apply script; fixture only carries mirrors.
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
      "INSERT INTO fedramp_products (fedramp_id, csp, csp_slug, cso, status, impact_level) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("FR_AI", "Acme Cloud", "acme-cloud", "Acme GovCloud", "FedRAMP Authorized", "High");

    db.prepare(
      "INSERT INTO fedramp_authorized_services (fedramp_id, service, recency) VALUES (?, ?, ?)",
    ).run("FR_AI", "Test Bedrock", "older");

    db.prepare(
      `INSERT INTO fedramp_ai_service_classification
         (service, category, confidence, reasoning, signals, model, input_hash, classified_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("Test Bedrock", "core_ai", "high", "Managed foundation-model hosting.", "[]", "test-model", "h1", "2026-07-04T00:00:00Z", "qc_confirmed");

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
    ato.run("FR_AI", 100, "Initial", "2023-05-01");
    ato.run("FR_AI", 101, "Reuse", "2024-01-15");

    const ev = db.prepare(
      `INSERT INTO agency_ai_access_evidence
         (agency_id, agency_abbreviation, finding, coverage_assessment,
          estimated_share_of_eligible, status, source_date, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    // VA: dated + corroborated → anchors.
    ev.run(1, "VA", "VA stood up an enterprise chatbot.", "all", 0.9, "corroborated", "2025-10-01", "2026-07-04T00:00:00Z");
    // DHS: corroborated but undated → skipped.
    ev.run(2, "DHS", "DHS references broad access.", "most", null, "corroborated", null, "2026-07-04T00:00:00Z");
    // DHS: dated but unsourced → skipped.
    ev.run(2, "DHS", "DHS unsourced note.", "partial", null, "searched_no_source", "2025-01-01", "2026-07-04T00:00:00Z");
  });

  afterAll(() => uninstallTestDb());

  it("builds cumulative ATO steps, one per agency at its first date", () => {
    const data = buildDivergenceTimeline();
    expect(data).not.toBeNull();
    expect(data!.snapshotDate).toBe("2026-06-12");
    expect(data!.atoSteps.map((s) => ({ date: s.date, cumulative: s.cumulative }))).toEqual([
      { date: "2023-05-01", cumulative: 1 },
      { date: "2024-01-15", cumulative: 2 },
    ]);
  });

  it("anchors only dated, corroborated evidence — one point (VA)", () => {
    const data = buildDivergenceTimeline()!;
    expect(data.anchorSteps).toHaveLength(1);
    expect(data.anchorSteps[0]).toMatchObject({
      abbr: "VA",
      date: "2025-10-01",
      cumulative: 1,
    });
  });

  it("degrades to null when the service classification sidecar is absent", () => {
    db.exec("DROP TABLE fedramp_ai_service_classification");
    expect(buildDivergenceTimeline()).toBeNull();
  });
});

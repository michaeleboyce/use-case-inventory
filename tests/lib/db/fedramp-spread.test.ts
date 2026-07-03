import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getAiClassificationCounts,
  getAuthorizedCoreAiSpread,
  getFrontierTrioStatus,
  getSpreadCounts,
} from "@/lib/db";

/**
 * Tests for the /fedramp/coverage/spread surface — authorization vs adoption.
 *
 * Scenario: five FedRAMP products.
 *  - FR_SOLO   : core_ai, Authorized, one ATO (VA), no inventory link
 *                → single-ATO product; its (VA) pair has no reported use.
 *  - FR_SPREAD : core_ai, Authorized, ATOs at VA+DHS, linked to inventory
 *                product 1 (seed: use_case 1 at agency 1/VA uses product 1)
 *                → multi-ATO; VA pair corroborated, DHS pair not.
 *  - FR_PIPE   : core_ai but only FedRAMP Ready → excluded from spread.
 *  - FR_FEAT   : ai_featured, Authorized → excluded from the core-AI board.
 *  - FR_TRIO   : "Gemini for Government" by cso name, no classification row
 *                needed → picked up by getFrontierTrioStatus, zero holders.
 * Agency links: VA=1↔100, DHS=2↔101 (mirrors the sleeping-auth fixture).
 */
describe("lib/db/fedramp — spread (authorization vs adoption)", () => {
  beforeAll(() => {
    const db = installTestDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS fedramp_ai_classification (
        fedramp_id TEXT PRIMARY KEY,
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
      `INSERT INTO fedramp_products
         (fedramp_id, csp, csp_slug, cso, status, impact_level, auth_date, reuse_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    prod.run("FR_SOLO", "Acme", "acme", "Acme Vision AI", "FedRAMP Authorized", "Moderate", "2025-06-01", 0);
    prod.run("FR_SPREAD", "Globex", "globex", "Globex LLM", "FedRAMP Authorized", "High", "2024-11-19", 5);
    prod.run("FR_PIPE", "Umbra", "umbra", "Umbra ML", "FedRAMP Ready", "Moderate", null, 0);
    prod.run("FR_FEAT", "Initech", "initech", "Initech Suite", "FedRAMP Authorized", "Low", "2023-01-01", 2);
    prod.run("FR_TRIO", "Google", "google", "Gemini for Government", "FedRAMP Authorized", "Low", "2026-01-21", 0);

    const cls = db.prepare(
      `INSERT INTO fedramp_ai_classification
         (fedramp_id, category, confidence, reasoning, signals, model, input_hash, classified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    cls.run("FR_SOLO", "core_ai", "high", "CV service.", "[]", "test-model", "h1", "2026-06-12T00:00:00Z");
    cls.run("FR_SPREAD", "core_ai", "high", "LLM platform.", "[]", "test-model", "h2", "2026-06-12T00:00:00Z");
    cls.run("FR_PIPE", "core_ai", "medium", "ML platform.", "[]", "test-model", "h3", "2026-06-12T00:00:00Z");
    cls.run("FR_FEAT", "ai_featured", "high", "Suite with AI features.", "[]", "test-model", "h4", "2026-06-12T00:00:00Z");

    // FR_SPREAD is linked to inventory product 1; the seed already has
    // use_case 1 (agency 1 = VA) referencing product 1 via use_case_products.
    db.prepare(
      "INSERT INTO fedramp_product_links (inventory_product_id, fedramp_id, confidence, source) VALUES (?, ?, ?, ?)",
    ).run(1, "FR_SPREAD", "manual", "test");

    const al = db.prepare(
      "INSERT INTO fedramp_agency_links (inventory_agency_id, fedramp_agency_id, confidence, source) VALUES (?, ?, ?, ?)",
    );
    al.run(1, 100, "manual", "test");
    al.run(2, 101, "manual", "test");

    db.prepare("INSERT INTO fedramp_agencies (id, parent_agency, parent_slug) VALUES (?, ?, ?)").run(
      100,
      "Department of Veterans Affairs",
      "va",
    );
    db.prepare("INSERT INTO fedramp_agencies (id, parent_agency, parent_slug) VALUES (?, ?, ?)").run(
      101,
      "Department of Homeland Security",
      "dhs",
    );

    const ato = db.prepare(
      "INSERT INTO fedramp_authorizations (fedramp_id, agency_id, ato_type, ato_issuance_date) VALUES (?, ?, ?, ?)",
    );
    ato.run("FR_SOLO", 100, "Initial", "2025-06-01");
    ato.run("FR_SPREAD", 100, "Initial", "2024-11-19");
    ato.run("FR_SPREAD", 101, "Reuse", "2025-03-01");
    ato.run("FR_FEAT", 100, "Initial", "2023-01-01");
  });
  afterAll(() => uninstallTestDb());

  it("returns one row per authorized core-AI product, ATO-heavy first", () => {
    const rows = getAuthorizedCoreAiSpread();
    expect(rows.map((r) => r.fedramp_id)).toEqual(["FR_SPREAD", "FR_SOLO"]);

    const spread = rows[0];
    expect(spread.ato_count).toBe(2);
    expect(spread.reuse_count).toBe(5);
    expect(spread.linked_to_inventory).toBe(1);
    // Seed: product 1 is referenced by use cases at VA (uc 1) and GSA
    // (ucs 10, 12) — two distinct reporting agencies.
    expect(spread.reporting_agency_count).toBe(2);

    const solo = rows[1];
    expect(solo.ato_count).toBe(1);
    expect(solo.linked_to_inventory).toBe(0);
    expect(solo.reporting_agency_count).toBe(0);
  });

  it("computes the concentration and corroboration cuts", () => {
    const c = getSpreadCounts();
    expect(c.authorized_core_ai).toBe(2); // FR_PIPE (Ready) and FR_FEAT excluded
    expect(c.single_ato).toBe(1); // FR_SOLO
    expect(c.multi_ato).toBe(1); // FR_SPREAD
    // Pairs: FR_SOLO×VA, FR_SPREAD×VA, FR_SPREAD×DHS.
    expect(c.ato_pairs).toBe(3);
    // Only FR_SPREAD×VA is corroborated by a reported use case.
    expect(c.ato_pairs_with_reported_use).toBe(1);
  });

  it("resolves frontier products by cso name with their ATO holders", () => {
    const trio = getFrontierTrioStatus();
    expect(trio).toHaveLength(1);
    expect(trio[0].cso).toBe("Gemini for Government");
    expect(trio[0].status).toBe("FedRAMP Authorized");
    expect(trio[0].reuse_count).toBe(0);
    expect(trio[0].ato_holders).toEqual([]);
  });

  it("splits the unlinked-AI count into authorized vs pipeline", () => {
    const c = getAiClassificationCounts();
    // Unlinked AI: FR_SOLO (authorized), FR_PIPE (Ready), FR_FEAT (authorized).
    expect(c.ai_unlinked).toBe(3);
    expect(c.ai_unlinked_authorized).toBe(2);
    expect(c.ai_unlinked_pipeline).toBe(1);
    expect(c.ai_unlinked_authorized + c.ai_unlinked_pipeline).toBe(c.ai_unlinked);
  });
});

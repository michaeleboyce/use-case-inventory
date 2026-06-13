import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  hasAiClassification,
  getAiClassificationCounts,
  getAiClassificationMap,
  getUnlinkedAiProducts,
  getUnlinkedAiByAgency,
  getCoverageHubStats,
} from "@/lib/db";

/**
 * Tests for the independent AI-classification gap surface.
 *
 * Scenario: three FedRAMP products.
 *  - FR_LINKED  : core_ai, linked to inventory product 1 → NOT a gap.
 *  - FR_GAP     : core_ai, no inventory link, VA+DHS hold ATOs → the gap.
 *  - FR_NOTAI   : not_ai → never counts as AI either way.
 * Agency links: VA=1↔100, DHS=2↔101 (mirrors the sleeping-auth fixture).
 */
describe("lib/db/fedramp — AI classification gap", () => {
  beforeAll(() => {
    const db = installTestDb();
    // The classification table is a sidecar created by the ETL apply script;
    // the fixture schema may predate it, so create it here (mirrors the real
    // DDL in scripts/apply_fedramp_ai_classification.py).
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
      "INSERT INTO fedramp_products (fedramp_id, csp, csp_slug, cso, status, impact_level) VALUES (?, ?, ?, ?, ?, ?)",
    );
    prod.run("FR_LINKED", "Acme", "acme", "Acme LLM", "FedRAMP Authorized", "Moderate");
    prod.run("FR_GAP", "Globex", "globex", "Globex Vision AI", "FedRAMP Authorized", "High");
    prod.run("FR_NOTAI", "Initech", "initech", "Initech File Store", "FedRAMP Authorized", "Low");

    const cls = db.prepare(
      "INSERT INTO fedramp_ai_classification (fedramp_id, category, confidence, reasoning, signals, model, input_hash, classified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    cls.run("FR_LINKED", "core_ai", "high", "An LLM platform.", '["LLM"]', "test-model", "h1", "2026-06-12T00:00:00Z");
    cls.run("FR_GAP", "core_ai", "high", "A computer-vision service.", '["computer vision"]', "test-model", "h2", "2026-06-12T00:00:00Z");
    cls.run("FR_NOTAI", "not_ai", "high", "Plain object storage.", "[]", "test-model", "h3", "2026-06-12T00:00:00Z");

    // FR_LINKED is linked to inventory product 1 → excluded from the gap.
    db.prepare(
      "INSERT INTO fedramp_product_links (inventory_product_id, fedramp_id, confidence, source) VALUES (?, ?, ?, ?)",
    ).run(1, "FR_LINKED", "manual", "test");

    // Agency links + ATOs: VA and DHS both authorize the gap product.
    const al = db.prepare(
      "INSERT INTO fedramp_agency_links (inventory_agency_id, fedramp_agency_id, confidence, source) VALUES (?, ?, ?, ?)",
    );
    al.run(1, 100, "manual", "test");
    al.run(2, 101, "manual", "test");
    const ato = db.prepare(
      "INSERT INTO fedramp_authorizations (fedramp_id, agency_id, ato_type, ato_issuance_date) VALUES (?, ?, ?, ?)",
    );
    ato.run("FR_GAP", 100, "Initial", "2025-01-15");
    ato.run("FR_GAP", 101, "Reuse", "2025-02-20");
    ato.run("FR_LINKED", 100, "Initial", "2025-03-01");
  });
  afterAll(() => uninstallTestDb());

  it("reports the table as present", () => {
    expect(hasAiClassification()).toBe(true);
  });

  it("counts AI products and splits linked vs unlinked", () => {
    const c = getAiClassificationCounts();
    expect(c.core_ai).toBe(2);
    expect(c.not_ai).toBe(1);
    expect(c.ai_linked).toBe(1); // FR_LINKED
    expect(c.ai_unlinked).toBe(1); // FR_GAP
    // Invariant: linked + unlinked == total AI products.
    expect(c.ai_linked + c.ai_unlinked).toBe(c.core_ai + c.ai_featured);
  });

  it("returns only AI products with no inventory link, ordered by ATO count", () => {
    const rows = getUnlinkedAiProducts();
    expect(rows.map((r) => r.fedramp_id)).toEqual(["FR_GAP"]);
    const gap = rows[0];
    expect(gap.category).toBe("core_ai");
    expect(gap.ato_count).toBe(2); // VA + DHS
    expect(gap.agency_count).toBe(2);
    expect(gap.signals).toEqual(["computer vision"]);
  });

  it("never includes a product that has a fedramp_product_links row", () => {
    const rows = getUnlinkedAiProducts();
    expect(rows.some((r) => r.fedramp_id === "FR_LINKED")).toBe(false);
    expect(rows.some((r) => r.fedramp_id === "FR_NOTAI")).toBe(false);
  });

  it("leaderboards agencies by unlinked-AI ATO count", () => {
    const board = getUnlinkedAiByAgency();
    const byAbbr = Object.fromEntries(
      board.map((a) => [a.agency_abbreviation, a.unlinked_ai_ato_count]),
    );
    expect(byAbbr["VA"]).toBe(1);
    expect(byAbbr["DHS"]).toBe(1);
  });

  it("pre-seeds missing ids in the batched map", () => {
    const map = getAiClassificationMap(["FR_GAP", "FR_UNKNOWN"]);
    expect(map.get("FR_GAP")?.category).toBe("core_ai");
    expect(map.has("FR_UNKNOWN")).toBe(true);
    expect(map.get("FR_UNKNOWN")).toBeNull();
  });

  it("adds an unlinked_ai hub stat", () => {
    const stat = getCoverageHubStats().find((s) => s.key === "unlinked_ai");
    expect(stat).toBeDefined();
    expect(stat?.value).toBe(1);
    expect(stat?.denominator).toBe(2);
  });
});

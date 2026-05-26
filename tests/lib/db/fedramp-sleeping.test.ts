import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getSleepingAuthorizationsCounts,
  getSleepingAuthorizationRows,
  getSleepingAuthorizationDetail,
  getCoverageHubStats,
} from "@/lib/db";

/**
 * Tests for the "sleeping authorizations" gap surface.
 *
 * Scenario: ChatGPT (product 1) is FedRAMP product FR_TEST. VA and GSA both
 * report use cases using ChatGPT (per the existing seed's `use_case_products`
 * rows (1,1) / (10,1) / (12,1)). VA, GSA, AND DHS all hold ATOs for FR_TEST.
 * DHS is the "sleeping" authorizer — has the ATO, reports no AI use.
 */
describe("lib/db/fedramp — sleeping authorizations", () => {
  beforeAll(() => {
    const db = installTestDb();
    // FedRAMP product fixture
    db.prepare(
      "INSERT INTO fedramp_products (fedramp_id, csp, csp_slug, cso, status, impact_level) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("FR_TEST", "Acme", "acme", "Acme AI Platform", "FedRAMP Authorized", "Moderate");
    // Link inventory product 1 (ChatGPT) to FR_TEST
    db.prepare(
      "INSERT INTO fedramp_product_links (inventory_product_id, fedramp_id, confidence, source) VALUES (?, ?, ?, ?)",
    ).run(1, "FR_TEST", "manual", "test");
    // FedRAMP-side agency IDs mapped to inventory agencies (VA=1, DHS=2, GSA=3)
    const linkInsert = db.prepare(
      "INSERT INTO fedramp_agency_links (inventory_agency_id, fedramp_agency_id, confidence, source) VALUES (?, ?, ?, ?)",
    );
    linkInsert.run(1, 100, "manual", "test");
    linkInsert.run(2, 101, "manual", "test");
    linkInsert.run(3, 102, "manual", "test");
    // All three agencies hold an ATO for FR_TEST; only VA and GSA report use cases.
    const atoInsert = db.prepare(
      "INSERT INTO fedramp_authorizations (fedramp_id, agency_id, ato_type, ato_issuance_date) VALUES (?, ?, ?, ?)",
    );
    atoInsert.run("FR_TEST", 100, "Initial", "2025-01-15");
    atoInsert.run("FR_TEST", 101, "Initial", "2025-02-20");
    atoInsert.run("FR_TEST", 102, "Initial", "2025-03-10");
  });
  afterAll(() => uninstallTestDb());

  describe("getSleepingAuthorizationsCounts", () => {
    it("counts the DHS × FR_TEST sleeping pair", () => {
      const c = getSleepingAuthorizationsCounts();
      expect(c.sleeping_pairs).toBe(1);
      expect(c.products_with_gap).toBe(1);
      expect(c.ai_used_products).toBe(1);
    });
  });

  describe("getSleepingAuthorizationRows", () => {
    it("returns one row for FR_TEST with the expected per-product counts", () => {
      const rows = getSleepingAuthorizationRows();
      expect(rows).toHaveLength(1);
      const r = rows[0];
      expect(r.fedramp_id).toBe("FR_TEST");
      expect(r.lead_user_count).toBe(2); // VA + GSA
      expect(r.sleeping_count).toBe(1); // DHS
      expect(r.total_ato_count).toBe(3); // VA + DHS + GSA
      expect(r.cso).toBe("Acme AI Platform");
      expect(r.impact_level).toBe("Moderate");
    });
  });

  describe("getSleepingAuthorizationDetail", () => {
    it("splits agencies into lead users (VA, GSA) and sleeping authorizers (DHS)", () => {
      const d = getSleepingAuthorizationDetail("FR_TEST");
      expect(d.fedramp_id).toBe("FR_TEST");
      expect(d.leadUsers.map((u) => u.agency_abbreviation).sort()).toEqual([
        "GSA",
        "VA",
      ]);
      expect(d.sleepingAuthorizers.map((s) => s.agency_abbreviation)).toEqual([
        "DHS",
      ]);
      const dhs = d.sleepingAuthorizers[0];
      expect(dhs.ato_issuance_date).toBe("2025-02-20");
      expect(dhs.authorization_type).toBe("Initial");
    });

    it("populates each lead user's use_cases list with the actual reported entries", () => {
      const d = getSleepingAuthorizationDetail("FR_TEST");
      const va = d.leadUsers.find((u) => u.agency_abbreviation === "VA")!;
      const gsa = d.leadUsers.find((u) => u.agency_abbreviation === "GSA")!;
      // VA seed: use_case_products(1,1) — one ChatGPT use case (use_case 1)
      expect(va.use_cases).toHaveLength(1);
      expect(va.use_cases[0].use_case_name).toContain("Clinical");
      expect(va.use_cases[0].slug).toBe("va-clinical-summary");
      // GSA seed: use_case_products(10,1) and (12,1) — two ChatGPT use cases
      expect(gsa.use_cases).toHaveLength(2);
    });

    it("returns empty lists for an unknown FedRAMP id", () => {
      const d = getSleepingAuthorizationDetail("FR_DOES_NOT_EXIST");
      expect(d.leadUsers).toEqual([]);
      expect(d.sleepingAuthorizers).toEqual([]);
    });
  });

  describe("getCoverageHubStats", () => {
    it("includes a sleeping_authorizations stat card", () => {
      const stats = getCoverageHubStats();
      const sleeping = stats.find((s) => s.key === "sleeping_authorizations");
      expect(sleeping).toBeDefined();
      expect(sleeping?.value).toBe(1);
      expect(sleeping?.denominator).toBe(1);
      expect(sleeping?.label).toBe("Sleeping authorizations");
    });
  });
});

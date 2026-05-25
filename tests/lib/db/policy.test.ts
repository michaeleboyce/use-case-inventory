import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getPolicyStats,
  getAgencyCompliance,
  getAgencyPagesByPolicy,
  getPolicyDocuments,
  getGoverningDocuments,
  getDocumentsForAgency,
} from "@/lib/db/policy";

describe("lib/db/policy", () => {
  beforeAll(() => installTestDb());
  afterAll(() => uninstallTestDb());

  describe("getPolicyStats", () => {
    it("counts agency pages only (excludes governing docs)", () => {
      const s = getPolicyStats();
      // Seed: DHS 10+12, DOJ 11, NSF 22+7 = 62. Governing 2+25 excluded.
      expect(s.total_pages).toBe(62);
    });
    it("counts agency documents (excludes governing docs)", () => {
      const s = getPolicyStats();
      // Seed: 5 agency docs + 2 governing → 5 agency docs counted.
      expect(s.total_documents).toBe(5);
    });
    it("counts distinct agencies searched", () => {
      const s = getPolicyStats();
      expect(s.total_agencies).toBe(3); // DHS, DOJ, NSF
    });
    it("counts agencies with a published M-25-21 AI Strategy", () => {
      const s = getPolicyStats();
      expect(s.strategies_published).toBe(2); // DHS + NSF
    });
    it("counts agencies with a published M-25-21 Compliance Plan", () => {
      const s = getPolicyStats();
      expect(s.plans_published).toBe(2); // DHS + NSF
    });
    it("exposes last_refreshed date", () => {
      const s = getPolicyStats();
      expect(s.last_refreshed).toBe("2026-05-21");
    });
  });

  describe("getAgencyCompliance", () => {
    it("returns one row per agency, sorted by Cabinet first then name", () => {
      const rows = getAgencyCompliance();
      expect(rows.map((r) => r.agency_abbr)).toEqual(["DHS", "DOJ", "NSF"]);
    });
    it("normalizes searched 0/1 to boolean", () => {
      const rows = getAgencyCompliance();
      expect(typeof rows[0].searched).toBe("boolean");
      expect(rows[0].searched).toBe(true);
    });
  });

  describe("getAgencyPagesByPolicy", () => {
    it("returns one row per agency with summed pages, descending", () => {
      const rows = getAgencyPagesByPolicy();
      // DHS 22, NSF 29, DOJ 11 -> sorted desc by pages
      expect(rows.map((r) => r.agency_abbr)).toEqual(["NSF", "DHS", "DOJ"]);
      expect(rows.find((r) => r.agency_abbr === "DHS")?.pages).toBe(22);
      expect(rows.find((r) => r.agency_abbr === "NSF")?.pages).toBe(29);
    });
    it("excludes governing documents", () => {
      const rows = getAgencyPagesByPolicy();
      expect(rows.find((r) => r.agency_abbr === "EOP")).toBeUndefined();
      expect(rows.find((r) => r.agency_abbr === "OMB")).toBeUndefined();
    });
  });

  describe("getPolicyDocuments", () => {
    it("returns all agency documents, sorted year DESC then agency", () => {
      const rows = getPolicyDocuments();
      // Excludes governing; all 5 seed agency rows.
      expect(rows).toHaveLength(5);
      // 2025 rows first (DHS x2, NSF x2), then 2024 (DOJ).
      expect(rows[rows.length - 1].publication_year).toBe(2024);
    });
    it("filters by agency_abbr", () => {
      const rows = getPolicyDocuments({ agency_abbr: "NSF" });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.agency_abbr === "NSF")).toBe(true);
    });
    it("filters by document_type", () => {
      const rows = getPolicyDocuments({ document_type: "M-25-21 AI Strategy" });
      expect(rows).toHaveLength(2);
    });
    it("filters by publication_year", () => {
      const rows = getPolicyDocuments({ publication_year: 2024 });
      expect(rows).toHaveLength(1);
      expect(rows[0].agency_abbr).toBe("DOJ");
    });
    it("normalizes superseded/is_public to booleans", () => {
      const doj = getPolicyDocuments({ agency_abbr: "DOJ" })[0];
      expect(doj.superseded).toBe(true);
      expect(doj.is_public).toBe(true);
    });
  });

  describe("getGoverningDocuments", () => {
    it("returns only White House / OMB docs, oldest first", () => {
      const rows = getGoverningDocuments();
      expect(rows).toHaveLength(2);
      expect(rows[0].publication_year).toBeLessThanOrEqual(
        rows[1].publication_year,
      );
      expect(
        rows.every((r) => r.agency_type === "White House / OMB"),
      ).toBe(true);
    });
  });

  describe("getDocumentsForAgency", () => {
    it("returns just that agency's documents", () => {
      const rows = getDocumentsForAgency("DHS");
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.agency_abbr === "DHS")).toBe(true);
    });
    it("returns [] for an unknown agency", () => {
      expect(getDocumentsForAgency("ZZZ")).toEqual([]);
    });
  });
});

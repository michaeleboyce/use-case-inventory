import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import { getGenAiAdoptionSeries } from "@/lib/db/adoption";

describe("lib/db/adoption", () => {
  beforeAll(() => installTestDb());
  afterAll(() => uninstallTestDb());

  describe("getGenAiAdoptionSeries", () => {
    it("returns both cycles, oldest first", () => {
      const rows = getGenAiAdoptionSeries();
      expect(rows.map((r) => r.inventory_year)).toEqual([2024, 2025]);
    });

    it("counts the 2025 cycle over INDIVIDUAL use cases only", () => {
      const [, r2025] = getGenAiAdoptionSeries();
      // Seed: 12 individual use cases, 8 GenAI-tagged, 5 of them deployed.
      // The 4 consolidated tag rows (all GenAI) must NOT be counted.
      expect(r2025.total_use_cases).toBe(12);
      expect(r2025.genai_use_cases).toBe(8);
      expect(r2025.deployed_genai).toBe(5);
    });

    it("counts distinct enterprise-GenAI agencies per cycle", () => {
      const [r2024, r2025] = getGenAiAdoptionSeries();
      // 2025 seed: enterprise-wide GenAI rows at agencies 1 and 3.
      expect(r2025.enterprise_genai_agencies).toBe(2);
      // 2024 seed: use case 9001 (agency 1) is GenAI + enterprise-wide.
      expect(r2024.enterprise_genai_agencies).toBe(1);
    });

    it("computes the 2024 cycle from the canonical (deduped) tag view", () => {
      const [r2024] = getGenAiAdoptionSeries();
      // Seed: 2 use cases; 9001 GenAI (wave-3 row wins), 9002 not.
      // No dev_stage seeded → deployed count 0.
      expect(r2024.total_use_cases).toBe(2);
      expect(r2024.genai_use_cases).toBe(1);
      expect(r2024.deployed_genai).toBe(0);
    });
  });
});

/**
 * Regression tests for the home-page view-model's headline numbers
 * (app/_view-model.ts). Guards the two data-correctness fixes:
 *
 *  1. `distinctProducts` must be the canonical COUNT(*) FROM products —
 *     not the per-agency sum, which double-counts cross-agency products.
 *     The sum survives as `productDeployments`.
 *  2. Entry-mix numerators come from `use_case_tags` (individual use cases
 *     only), so percentages must be computed against total_use_cases, never
 *     the individual+consolidated total.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import { getGlobalStats } from "@/lib/db/stats";
import { getTags2024Headlines } from "@/lib/db/year-comparison";
import { buildHomeViewModel } from "@/app/_view-model";

beforeAll(() => installTestDb());
afterAll(() => uninstallTestDb());

describe("buildHomeViewModel product counts", () => {
  it("distinctProducts equals the canonical products count", async () => {
    const vm = await buildHomeViewModel();
    const stats = getGlobalStats();
    expect(vm.distinctProducts).toBe(stats.total_products);
  });

  it("productDeployments is the per-agency sum, kept separately", async () => {
    const vm = await buildHomeViewModel();
    const expected = vm.maturity.reduce(
      (acc, row) => acc + (row.maturity?.distinct_products_deployed ?? 0),
      0,
    );
    expect(vm.productDeployments).toBe(expected);
  });
});

describe("entry-mix denominator invariant", () => {
  it("tag-derived numerators never exceed the individual use-case count", () => {
    const stats = getGlobalStats();
    expect(stats.total_coding_entries).toBeLessThanOrEqual(
      stats.total_use_cases,
    );
    expect(stats.total_genai_entries).toBeLessThanOrEqual(
      stats.total_use_cases,
    );
    expect(stats.total_high_impact_entries).toBeLessThanOrEqual(
      stats.total_use_cases,
    );
  });
});

describe("getTags2024Headlines canonical view", () => {
  it("dedupes multi-wave tags to the best wave per use case", () => {
    const tags = getTags2024Headlines();
    // Fixture: uc 9001 tagged in waves 1 and 3 (both genai) → counts once;
    // uc 9002 tagged once, not genai.
    expect(tags.total).toBe(2);
    expect(tags.genai).toBe(1);
    expect(tags.enterprise_wide).toBe(1);
  });
});

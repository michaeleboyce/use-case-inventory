/**
 * Facet ↔ filter coherence for the normalized enum columns (ETL m016/m019).
 *
 * Guards the silent-0-results failure mode: a facet list offering values the
 * filter predicate can't match (e.g. facet lists normalized buckets while the
 * filter compares the raw free-text column, or vice versa). Every value each
 * facet offers must round-trip through the filter builder to at least one row.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import { getUseCaseFacets } from "@/lib/db/use-cases/facet-counts";
import { getUseCasesFiltered as searchUseCases } from "@/lib/db/use-cases/refined-search";

beforeAll(() => installTestDb());
afterAll(() => uninstallTestDb());

describe("normalized facet values round-trip through the filter builder", () => {
  it("every stages facet value matches >= 1 individual row", () => {
    const { stages } = getUseCaseFacets();
    expect(stages.length).toBeGreaterThan(0);
    for (const stage of stages) {
      const { total } = searchUseCases({ stage, entryKind: "use_case" });
      expect(total, `stage facet value ${JSON.stringify(stage)}`).toBeGreaterThan(0);
    }
  });

  it("every aiClassifications facet value matches >= 1 individual row", () => {
    const { aiClassifications } = getUseCaseFacets();
    expect(aiClassifications.length).toBeGreaterThan(0);
    for (const aiClassification of aiClassifications) {
      const { total } = searchUseCases({ aiClassification, entryKind: "use_case" });
      expect(
        total,
        `aiClassification facet value ${JSON.stringify(aiClassification)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("every highImpact facet value matches >= 1 individual row", () => {
    const { highImpact } = getUseCaseFacets();
    expect(highImpact.length).toBeGreaterThan(0);
    for (const isHighImpact of highImpact) {
      const { total } = searchUseCases({ isHighImpact, entryKind: "use_case" });
      expect(
        total,
        `highImpact facet value ${JSON.stringify(isHighImpact)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("facet vocabularies are the normalized buckets, not raw variants", () => {
    const { stages, highImpact } = getUseCaseFacets();
    // Raw stage values in the wild carry list prefixes / definition text
    // ("a) Pre-deployment – The use case is ..."); normalized buckets are
    // snake_case tokens.
    for (const s of stages) expect(s).toMatch(/^[a-z_]+$/);
    for (const h of highImpact) expect(h).toMatch(/^[a-z_]+$/);
  });
});

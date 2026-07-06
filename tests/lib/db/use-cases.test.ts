/**
 * Integration tests for `lib/db/use-cases/*` against the seeded fixture DB.
 * Coverage focus: single-row lookup, the filter compound (stage / agency /
 * entryKind), and facet enumeration.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getUseCaseBySlug,
  getUseCasesFiltered,
  getUseCaseFacets,
} from "@/lib/db/use-cases";

beforeAll(() => installTestDb());
afterAll(() => uninstallTestDb());

describe("getUseCaseBySlug", () => {
  it("returns the row + joined agency/product/template fields", () => {
    const uc = getUseCaseBySlug("va-clinical-summary");
    expect(uc).not.toBeNull();
    expect(uc!.use_case_name).toBe("Clinical Note Summarization");
    expect(uc!.agency_abbreviation).toBe("VA");
    expect(uc!.product_name).toBe("ChatGPT");
    expect(uc!.template_short_name).toBe("GenAI productivity");
    expect(uc!.tags).not.toBeNull();
    expect(uc!.tags!.deployment_scope).toBe("enterprise");
  });

  it("returns null for an unknown slug", () => {
    expect(getUseCaseBySlug("does-not-exist")).toBeNull();
  });
});

describe("getUseCasesFiltered", () => {
  it("returns all 12 use_case rows when no filters set (entryKind defaults to use_case)", () => {
    const { rows, total } = getUseCasesFiltered();
    expect(total).toBe(12);
    expect(rows).toHaveLength(12);
    for (const r of rows) expect(r.kind).toBe("use_case");
  });

  it("narrows to a single agency when agencyId is set", () => {
    const { rows, total } = getUseCasesFiltered({ agencyId: 1 });
    expect(total).toBe(5);
    expect(rows).toHaveLength(5);
    for (const r of rows) {
      if (r.kind === "use_case") expect(r.agency_abbreviation).toBe("VA");
    }
  });

  it("filters by normalized stage bucket", () => {
    // `stage` compares against stage_normalized (m016) — canonical
    // snake_case buckets, not the raw free-text variants.
    const { rows, total } = getUseCasesFiltered({ stage: "pilot" });
    expect(total).toBe(3);
    expect(rows).toHaveLength(3);
  });

  it("filters to entries naming neither a vendor nor a product (vendorUnspecified)", () => {
    // Fixture use cases VA-002, VA-005, DHS-001, DHS-004 (ids 2/5/6/9) have a
    // NULL vendor_name and no product/system name; the seed leaves every tag
    // vendor/product field unset, so the predicate resolves via vendor_name.
    const { rows, total } = getUseCasesFiltered({ vendorUnspecified: true });
    expect(total).toBe(4);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.kind).toBe("use_case");
      if (r.kind === "use_case") {
        expect(r.vendor_name == null || r.vendor_name === "").toBe(true);
      }
    }
  });

  it("AND-composes vendorUnspecified with a sophistication filter", () => {
    // The same 4 unspecified rows are all classical_ml; none are frontier_llm.
    // This is the composition Insight Card G relies on (general_llm + gap).
    expect(
      getUseCasesFiltered({
        aiSophistications: ["classical_ml"],
        vendorUnspecified: true,
      }).total,
    ).toBe(4);
    expect(
      getUseCasesFiltered({
        aiSophistications: ["frontier_llm"],
        vendorUnspecified: true,
      }).total,
    ).toBe(0);
  });

  it("returns the 4 consolidated rows when entryKind=consolidated", () => {
    const { rows, total } = getUseCasesFiltered({ entryKind: "consolidated" });
    expect(total).toBe(4);
    for (const r of rows) expect(r.kind).toBe("consolidated");
  });

  it('returns 16 (12 + 4) rows when entryKind="all"', () => {
    const { rows, total } = getUseCasesFiltered({ entryKind: "all" });
    expect(total).toBe(16);
    expect(rows).toHaveLength(16);
  });

  it("respects limit + offset", () => {
    const first = getUseCasesFiltered({ limit: 5, offset: 0 });
    const second = getUseCasesFiltered({ limit: 5, offset: 5 });
    expect(first.rows).toHaveLength(5);
    expect(second.rows).toHaveLength(5);
    // No overlap between the two pages.
    const firstIds = new Set(first.rows.map((r) => r.id));
    for (const r of second.rows) expect(firstIds.has(r.id)).toBe(false);
  });
});

describe("getUseCaseFacets", () => {
  it("returns distinct NORMALIZED stage / classification / agency-type values", () => {
    const facets = getUseCaseFacets();
    expect(facets.stages.length).toBeGreaterThan(0);
    expect(facets.stages).toContain("deployed");
    expect(facets.stages).toContain("pilot");
    expect(facets.aiClassifications).toContain("Generative AI");
    expect(facets.highImpact).toContain("high_impact");
    expect(facets.agencyTypes).toContain("CFO Act");
  });

  it("returns at least one tag facet bucket", () => {
    const facets = getUseCaseFacets();
    expect(facets.tagEntryTypes).toContain("product_deployment");
    expect(facets.tagDeploymentScopes).toContain("enterprise");
  });
});

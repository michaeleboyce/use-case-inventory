/**
 * Integration tests for `lib/db/stats.ts` — the cross-domain rollups
 * (headline counts, catalog snapshot, command-palette index).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getGlobalStats,
  getProductCatalogStats,
  getCommandPaletteIndex,
} from "@/lib/db/stats";

beforeAll(() => installTestDb());
afterAll(() => uninstallTestDb());

describe("getGlobalStats", () => {
  it("returns headline counts that match the seed", () => {
    const s = getGlobalStats();
    expect(s.total_use_cases).toBe(12);
    expect(s.total_consolidated).toBe(4);
    expect(s.total_agencies).toBe(5);
    expect(s.total_agencies_with_data).toBe(3); // VA, DHS, GSA
    expect(s.total_products).toBe(6);
    expect(s.total_templates).toBe(3);
  });

  it("groups use cases into stage buckets via STAGE_BUCKET_SQL", () => {
    const s = getGlobalStats();
    const sum = Object.values(s.stage_bucket_counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(s.total_use_cases);
    expect(s.stage_bucket_counts.deployed).toBeGreaterThan(0);
    expect(s.stage_bucket_counts.pilot).toBeGreaterThan(0);
    expect(s.stage_bucket_counts.retired).toBe(1);
    expect(s.stage_bucket_counts.pre_deployment).toBeGreaterThanOrEqual(1);
  });

  it("counts coding-tool and generative-AI tag flags", () => {
    const s = getGlobalStats();
    // Seed marks 3 tag rows as is_coding_tool=1 (use_cases 3, 11 plus the
    // consolidated coding-assistants rollup row).
    expect(s.total_coding_entries).toBe(3);
    // 10 of the 12 individual use_case tags are is_generative_ai=1.
    expect(s.total_genai_entries).toBeGreaterThan(0);
  });
});

describe("getProductCatalogStats", () => {
  it("returns commercial / agency-internal counts that sum to products", () => {
    const s = getProductCatalogStats();
    expect(s.canonical_products).toBe(6);
    expect(s.commercial_products).toBe(5);
    expect(s.agency_internal_products).toBe(1);
    expect(s.distinct_vendors).toBeGreaterThan(0);
  });
});

describe("getCommandPaletteIndex", () => {
  it("returns search index entries for agencies, products, templates, and use cases", () => {
    const idx = getCommandPaletteIndex();
    expect(idx.agencies.length).toBeGreaterThan(0);
    expect(idx.products.length).toBe(6);
    expect(idx.templates.length).toBe(3);
    expect(idx.useCases.length).toBeGreaterThan(0);
    // Each use case has agency_abbreviation populated from the join.
    for (const u of idx.useCases) {
      expect(u.agency_abbreviation).toBeTruthy();
    }
  });
});

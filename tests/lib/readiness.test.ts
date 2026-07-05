/**
 * Integration tests for the readiness query layer (`lib/readiness`) and the
 * rubric metadata (`lib/readiness/rubric`) against the seeded fixture DB.
 *
 * Focus (rubric v1.2):
 *   - getHeadlineStats is a pure read of the readiness_headline row.
 *   - getVendorConcentration excludes placeholder vendors and reports both
 *     the attributed-share and all-use-cases-share denominators.
 *   - getFrontierPenetration / getReportingCompleteness carry the real
 *     agency name (not the abbreviation).
 *   - tierFromScore band boundaries + TIER_BANDS descriptions are purely
 *     definitional (no snapshot-dependent prose).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getFrontierPenetration,
  getHeadlineStats,
  getReportingCompleteness,
  getVendorConcentration,
} from "@/lib/readiness";
import { RUBRIC_VERSION, TIER_BANDS, tierFromScore } from "@/lib/readiness/rubric";

let db: BetterSqlite3.Database;

beforeAll(() => {
  db = installTestDb();
  // Seed a placeholder-vendor product LINKED to an already-product-linked use
  // case (VA-001 / id 1, which also names OpenAI). This exercises
  // getVendorConcentration's placeholder exclusion on the products.vendor
  // branch without perturbing the shared fixture's exact product-catalog
  // counts (other db test files build their own DB from the fixtures and
  // never see this row). Use case 1 keeps its OpenAI attribution; the 'N/A'
  // link must be filtered out.
  db.exec(`
    INSERT INTO products
      (canonical_name, vendor, product_type, is_generative_ai, is_frontier_llm, product_origin)
      VALUES ('Placeholder AI Tool', 'N/A', 'LLM', 1, 0, 'commercial');
    INSERT INTO use_case_products (use_case_id, product_id)
      VALUES (1, (SELECT id FROM products WHERE canonical_name = 'Placeholder AI Tool'));
  `);
});
afterAll(() => uninstallTestDb());

describe("getHeadlineStats", () => {
  it("reads the readiness_headline row verbatim (spot-check 5 fields)", () => {
    const raw = db
      .prepare("SELECT * FROM readiness_headline WHERE id = 1")
      .get() as Record<string, number | string>;
    const h = getHeadlineStats();

    // Five spot-checks including purchased_pct and fedramp_floor_pct.
    expect(h.purchased_pct).toBe(raw.purchased_pct);
    expect(h.fedramp_floor_pct).toBe(raw.fedramp_floor_pct);
    expect(h.internal_build_pct).toBe(raw.internal_build_pct);
    expect(h.total_units).toBe(raw.total_units);
    expect(h.rubric_version).toBe(raw.rubric_version);
  });

  it("exposes the full v1.2 field set and the deprecated fedramp alias", () => {
    const h = getHeadlineStats();
    expect(h.fedramp_coverage_pct).toBe(h.fedramp_linked_pct);
    // New v1.2 fields are all present and numeric.
    expect(typeof h.unreported_pct).toBe("number");
    expect(typeof h.production_rate_all_pct).toBe("number");
    expect(typeof h.hi_no_risk_docs_high_impact_pct).toBe("number");
    expect(typeof h.fedramp_link_row_count).toBe("number");
    expect(typeof h.total_use_cases).toBe("number");
    expect(h.computed_at).not.toBeNull();
  });
});

describe("getVendorConcentration", () => {
  it("excludes the placeholder ('N/A') vendor and includes real vendors", () => {
    const vc = getVendorConcentration();
    const names = vc.top_vendors.map((v) => v.vendor.toLowerCase());
    expect(names).not.toContain("n/a");
    // OpenAI is seeded on use cases 1, 10, 12 (three) → attributed vendor.
    const openai = vc.top_vendors.find((v) => v.vendor === "OpenAI");
    expect(openai).toBeDefined();
    expect(openai!.use_case_count).toBe(3);
  });

  it("share_of_all_ucs uses the total use-case count denominator", () => {
    const totalUc = (
      db.prepare("SELECT COUNT(*) AS c FROM use_cases").get() as { c: number }
    ).c;
    const attributedTotal = getVendorConcentration().top_vendors.reduce(
      (sum, v) => sum + v.use_case_count,
      0,
    );
    // The two denominators differ (not every use case names a real vendor),
    // so the two shares must differ for a vendor with >0 use cases.
    expect(attributedTotal).toBeLessThan(totalUc);

    const openai = getVendorConcentration().top_vendors.find(
      (v) => v.vendor === "OpenAI",
    )!;
    expect(openai.share_of_all_ucs).toBeCloseTo(openai.use_case_count / totalUc);
    expect(openai.share_of_attributed).toBeCloseTo(
      openai.use_case_count / attributedTotal,
    );
    expect(openai.share_of_all_ucs).not.toBeCloseTo(openai.share_of_attributed);
  });
});

describe("getFrontierPenetration / getReportingCompleteness agency_name", () => {
  it("frontier rows carry the real agency name, not the abbreviation", () => {
    // VA has 5 use cases (>= 5 threshold); its name differs from its abbr.
    const va = getFrontierPenetration().top_agencies.find(
      (r) => r.agency_abbreviation === "VA",
    );
    expect(va).toBeDefined();
    expect(va!.agency_name).toBe("Department of Veterans Affairs");
    expect(va!.agency_name).not.toBe(va!.agency_abbreviation);
  });

  it("reporting rows carry the real agency name, not the abbreviation", () => {
    const va = getReportingCompleteness().find(
      (r) => r.agency_abbreviation === "VA",
    );
    expect(va).toBeDefined();
    expect(va!.agency_name).toBe("Department of Veterans Affairs");
    expect(va!.agency_name).not.toBe(va!.agency_abbreviation);
  });
});

describe("rubric v1.2 metadata", () => {
  it("is version 1.2", () => {
    expect(RUBRIC_VERSION).toBe("1.2");
  });

  it("tierFromScore honors the 70/55/35/15 band boundaries", () => {
    expect(tierFromScore(100).tier).toBe("A");
    expect(tierFromScore(70).tier).toBe("A");
    expect(tierFromScore(69).tier).toBe("B");
    expect(tierFromScore(55).tier).toBe("B");
    expect(tierFromScore(54).tier).toBe("C");
    expect(tierFromScore(35).tier).toBe("C");
    expect(tierFromScore(34).tier).toBe("D");
    expect(tierFromScore(15).tier).toBe("D");
    expect(tierFromScore(14).tier).toBe("F");
    expect(tierFromScore(0).tier).toBe("F");
  });

  it("TIER_BANDS descriptions are purely definitional (no snapshot prose)", () => {
    for (const band of TIER_BANDS) {
      expect(band.description).not.toMatch(/v1\.1/i);
      expect(band.description).not.toMatch(/snapshot/i);
    }
  });
});

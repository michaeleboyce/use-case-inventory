import { describe, expect, it } from "vitest";
import {
  computeAgencySeatModel,
  computeSeatModel,
} from "@/lib/db/experience/seat-model";
import type {
  AgencySeatModelInput,
  StratumReachInput,
} from "@/lib/experience-shared";

function reach(over: Partial<StratumReachInput>): StratumReachInput {
  return {
    slug: "x",
    stratum: "general",
    family: "ChatGPT",
    band_label: "10,000-50,000",
    band_lower: 10000,
    band_mid: 30000,
    band_upper: 50000,
    unit_counted: "employees",
    confidence: "high",
    audited: true,
    title: "t",
    ...over,
  };
}

function agency(over: Partial<AgencySeatModelInput>): AgencySeatModelInput {
  return {
    agency_id: 1,
    abbreviation: "EPA",
    name: "Environmental Protection Agency",
    eligible: 12800,
    total_headcount: 16000,
    contractor_headcount: null,
    denominator_basis: "federal_employees",
    headcount_as_of: "2025-03",
    headcount_source_url: "https://example.gov",
    ai_eligible_share: 0.8,
    ai_eligible_rationale: null,
    ai_eligible_source_url: null,
    stratum_caps: {},
    reaches: [],
    ...over,
  };
}

describe("within-stratum MAX (same population)", () => {
  it("never sums same-stratum rows", () => {
    const m = computeAgencySeatModel(
      agency({
        reaches: [
          reach({ slug: "a", family: "ChatGPT" }),
          reach({ slug: "b", family: "Microsoft 365" }),
          reach({ slug: "c", family: "Gemini" }),
        ],
      }),
    );
    // Three 30k-mid rows at a 12.8k-eligible agency: central is capped at
    // eligible, not 90k.
    expect(m.central).toBeLessThanOrEqual(12800);
    expect(m.strata).toHaveLength(1);
    expect(m.strata[0].reach).toBe(30000);
    expect(m.strata[0].rows).toBe(3);
  });

  it("winning row is the largest band", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 100000,
        reaches: [
          reach({ slug: "small", band_mid: 550, band_lower: 101, band_upper: 1000 }),
          reach({ slug: "big", family: "Gemini" }),
        ],
      }),
    );
    expect(m.strata[0].winning_slug).toBe("big");
    expect(m.strata[0].winning_family).toBe("Gemini");
  });
});

describe("across-strata independence union", () => {
  it("matches 1-(1-a)(1-b) exactly", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 10000,
        reaches: [
          reach({ band_lower: 5000, band_mid: 5000, band_upper: 5000 }), // 50%
          reach({
            slug: "code",
            stratum: "technical",
            family: "GitHub Copilot",
            band_lower: 2000,
            band_mid: 2000,
            band_upper: 2000,
          }), // 20%
        ],
      }),
    );
    // union = 10000 * (1 - 0.5*0.8) = 6000
    expect(m.central).toBe(6000);
  });

  it("floor is the largest single stratum at band-lower", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 10000,
        reaches: [
          reach({ band_lower: 5001, band_mid: 7500, band_upper: 10000 }),
          reach({
            slug: "code",
            stratum: "technical",
            band_lower: 1001,
            band_mid: 3000,
            band_upper: 5000,
          }),
        ],
      }),
    );
    expect(m.floor).toBe(5001);
  });

  it("ceiling never exceeds eligible", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 8000,
        reaches: [
          reach({}),
          reach({ slug: "l", stratum: "legal", family: "Relativity" }),
        ],
      }),
    );
    expect(m.ceiling).toBe(8000);
  });

  it("bounds are ordered floor <= central <= ceiling", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 40000,
        reaches: [
          reach({}),
          reach({ slug: "t", stratum: "technical", band_lower: 1001, band_mid: 3000, band_upper: 5000 }),
          reach({ slug: "l", stratum: "legal", band_lower: 101, band_mid: 550, band_upper: 1000 }),
        ],
      }),
    );
    expect(m.floor!).toBeLessThanOrEqual(m.central!);
    expect(m.central!).toBeLessThanOrEqual(m.ceiling!);
  });
});

describe("occupation caps", () => {
  it("caps a role stratum below its filed band", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 50000,
        stratum_caps: { technical: 1200 },
        reaches: [
          reach({
            stratum: "technical",
            family: "GitHub Copilot",
            band_lower: 10000,
            band_mid: 30000,
            band_upper: 50000,
          }),
        ],
      }),
    );
    // 30k filed but only 1,200 IT staff exist.
    expect(m.central).toBe(1200);
    expect(m.strata[0].cap).toBe(1200);
    expect(m.strata[0].saturated).toBe(true);
  });
});

describe("saturation flag", () => {
  it("flags when band-lower >= 95% of the ceiling", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 9000,
        reaches: [reach({})], // lower 10,000 > eligible 9,000
      }),
    );
    expect(m.strata[0].saturated).toBe(true);
  });

  it("does not flag a small pilot", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 9000,
        reaches: [
          reach({ band_lower: 1, band_mid: 50, band_upper: 100 }),
        ],
      }),
    );
    expect(m.strata[0].saturated).toBe(false);
  });
});

describe("scenarios", () => {
  it("dropLowConfidence removes low rows", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 50000,
        reaches: [
          reach({ confidence: "low" }),
          reach({
            slug: "hc",
            confidence: "high",
            band_lower: 101,
            band_mid: 550,
            band_upper: 1000,
          }),
        ],
      }),
      { band: "mid", dropLowConfidence: true, includeClinical: true },
    );
    expect(m.strata[0].reach).toBe(550);
  });

  it("includeClinical=false removes the clinical stratum", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: 50000,
        reaches: [
          reach({}),
          reach({ slug: "c", stratum: "clinical", family: "Abridge" }),
        ],
      }),
      { band: "mid", dropLowConfidence: false, includeClinical: false },
    );
    expect(m.strata.map((s) => s.stratum)).toEqual(["general"]);
  });

  it("band=lower vs band=upper moves the central estimate", () => {
    const base = agency({ eligible: 100000, reaches: [reach({})] });
    const lo = computeAgencySeatModel(base, {
      band: "lower",
      dropLowConfidence: false,
      includeClinical: true,
    });
    const hi = computeAgencySeatModel(base, {
      band: "upper",
      dropLowConfidence: false,
      includeClinical: true,
    });
    expect(lo.central).toBe(10000);
    expect(hi.central).toBe(50000);
  });
});

describe("unmodeled agencies", () => {
  it("no denominator -> modeled=false, raw band range preserved", () => {
    const m = computeAgencySeatModel(
      agency({
        eligible: null,
        total_headcount: null,
        reaches: [reach({}), reach({ slug: "b", stratum: "legal" })],
      }),
    );
    expect(m.modeled).toBe(false);
    expect(m.central).toBeNull();
    expect(m.raw_band_lower).toBe(10000);
    expect(m.raw_band_upper).toBe(100000);
  });
});

describe("totals", () => {
  it("sums only modeled agencies and counts both", () => {
    const { totals } = computeSeatModel([
      agency({ reaches: [reach({})] }),
      agency({
        agency_id: 2,
        abbreviation: "CSOSA",
        eligible: null,
        reaches: [reach({})],
      }),
    ]);
    expect(totals.agencies_total).toBe(2);
    expect(totals.agencies_modeled).toBe(1);
    expect(totals.central).toBeLessThanOrEqual(12800);
    expect(totals.floor).toBeLessThanOrEqual(totals.central);
    expect(totals.central).toBeLessThanOrEqual(totals.ceiling);
  });
});

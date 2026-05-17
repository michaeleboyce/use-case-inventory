/**
 * Integration tests for `lib/db/agencies.ts` against the seeded fixture DB.
 * Coverage focus: lookups + the agency↔maturity left-join behaviour.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getAgencies,
  getAllAgenciesIncludingEmpty,
  getAgencyByAbbr,
  getAgencyMaturity,
  getAgencyOptions,
} from "@/lib/db/agencies";

beforeAll(() => installTestDb());
afterAll(() => uninstallTestDb());

describe("getAgencies", () => {
  it("returns agencies with status FOUND_2025 or FOUND_2024_ONLY", () => {
    const rows = getAgencies();
    const abbrs = rows.map((a) => a.abbreviation).sort();
    // VA, DHS, GSA → FOUND_2025; FOO → FOUND_2024_ONLY; BAR → NOT_FOUND
    expect(abbrs).toEqual(["DHS", "FOO", "GSA", "VA"]);
  });

  it("excludes agencies whose status is NOT_FOUND", () => {
    const rows = getAgencies();
    expect(rows.find((a) => a.abbreviation === "BAR")).toBeUndefined();
  });

  it("returns rows sorted by name (case-insensitive)", () => {
    const names = getAgencies().map((a) => a.name);
    const sorted = [...names].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
    expect(names).toEqual(sorted);
  });
});

describe("getAllAgenciesIncludingEmpty", () => {
  it("includes NOT_FOUND agencies", () => {
    const rows = getAllAgenciesIncludingEmpty();
    expect(rows.find((a) => a.abbreviation === "BAR")).toBeDefined();
    expect(rows).toHaveLength(5);
  });
});

describe("getAgencyByAbbr", () => {
  it("returns the agency with its maturity row when present", () => {
    const agency = getAgencyByAbbr("VA");
    expect(agency).not.toBeNull();
    expect(agency!.abbreviation).toBe("VA");
    expect(agency!.maturity).not.toBeNull();
    expect(agency!.maturity!.maturity_tier).toBe("building");
    expect(agency!.maturity!.total_use_cases).toBe(5);
  });

  it("is case-insensitive on the abbreviation", () => {
    const upper = getAgencyByAbbr("va");
    expect(upper?.abbreviation).toBe("VA");
  });

  it("returns null for an unknown abbreviation", () => {
    expect(getAgencyByAbbr("NOPE")).toBeNull();
  });

  it("returns null maturity for agencies without a rollup", () => {
    const agency = getAgencyByAbbr("FOO");
    expect(agency).not.toBeNull();
    expect(agency!.maturity).toBeNull();
  });
});

describe("getAgencyMaturity", () => {
  it("returns only agencies that have a maturity row, joined together", () => {
    const rows = getAgencyMaturity();
    const abbrs = rows.map((r) => r.abbreviation).sort();
    expect(abbrs).toEqual(["DHS", "GSA", "VA"]);
    for (const r of rows) {
      expect(r.maturity).not.toBeNull();
    }
  });
});

describe("getAgencyOptions", () => {
  it("only lists agencies that appear in the inventory_entries view", () => {
    const opts = getAgencyOptions();
    const abbrs = opts.map((o) => o.abbreviation).sort();
    // FOO and BAR have no use_cases/consolidated rows in the seed.
    expect(abbrs).toEqual(["DHS", "GSA", "VA"]);
  });
});

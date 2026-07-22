import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type BetterSqlite3 from "better-sqlite3";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getContainmentCoverForAgency,
  matchContainmentPattern,
  CONTAINMENT_PATTERNS,
} from "@/lib/db";

/**
 * Tests for the containment-cover refinement on the coverage boards — the
 * "possible cover ≠ confirmed attribution" check (fedramp-provenance-tracing
 * skill, trap #3).
 *
 * Scenario: FR_AZURE is a package whose services-in-scope catalog carries
 * "Azure OpenAI" (the containment channel for OpenAI-family products). VA
 * (inventory agency 1 ↔ fedramp agency 100) holds an ATO on FR_AZURE; DHS
 * (2 ↔ 101) does not. FR_FILES carries no matching service. So VA has a
 * containment cover for its "OpenAI API" mention; DHS does not.
 */
describe("lib/db/fedramp — containment cover", () => {
  let db: BetterSqlite3.Database;

  beforeAll(() => {
    db = installTestDb();

    const prod = db.prepare(
      "INSERT INTO fedramp_products (fedramp_id, csp, csp_slug, cso, status, impact_level) VALUES (?, ?, ?, ?, ?, ?)",
    );
    prod.run("FR_AZURE", "Microsoft", "microsoft", "Azure Commercial Cloud", "FedRAMP Authorized", "High");
    prod.run("FR_FILES", "Initech", "initech", "Initech Files", "FedRAMP Authorized", "Moderate");

    const svc = db.prepare(
      "INSERT INTO fedramp_authorized_services (fedramp_id, service, recency) VALUES (?, ?, ?)",
    );
    svc.run("FR_AZURE", "Azure OpenAI", "older");
    svc.run("FR_AZURE", "Azure Sentinel", "older");
    svc.run("FR_FILES", "Plain Backup", "last_90");

    db.prepare("INSERT INTO fedramp_agencies (id, parent_agency, parent_slug) VALUES (?, ?, ?)").run(100, "Department of Veterans Affairs", "va");
    db.prepare("INSERT INTO fedramp_agencies (id, parent_agency, parent_slug) VALUES (?, ?, ?)").run(101, "Department of Homeland Security", "dhs");
    const al = db.prepare(
      "INSERT INTO fedramp_agency_links (inventory_agency_id, fedramp_agency_id, confidence, source) VALUES (?, ?, ?, ?)",
    );
    al.run(1, 100, "manual", "test");
    al.run(2, 101, "manual", "test");

    const ato = db.prepare(
      "INSERT INTO fedramp_authorizations (fedramp_id, agency_id, ato_type, ato_issuance_date) VALUES (?, ?, ?, ?)",
    );
    // VA holds Azure; DHS holds only the unrelated file package.
    ato.run("FR_AZURE", 100, "Initial", "2024-05-01");
    ato.run("FR_FILES", 101, "Initial", "2023-01-01");
  });
  afterAll(() => uninstallTestDb());

  it("matches product families to service patterns (first match wins)", () => {
    expect(matchContainmentPattern("OpenAI API")?.servicePattern).toBe("%OpenAI%");
    expect(matchContainmentPattern("ChatGPT")?.servicePattern).toBe("%OpenAI%");
    // "Microsoft 365 Copilot" hits the M365 family before the Copilot family.
    expect(matchContainmentPattern("Microsoft 365 Copilot")?.servicePattern).toBe("%Microsoft 365%");
    expect(matchContainmentPattern("Microsoft Copilot for Security")?.servicePattern).toBe("%Copilot%");
    // No containment channel curated for these.
    expect(matchContainmentPattern("Westlaw AI")).toBeNull();
    expect(matchContainmentPattern("GitHub Copilot")).toBeNull();
  });

  it("seeds the required product families", () => {
    const patterns = CONTAINMENT_PATTERNS.map((p) => p.servicePattern);
    for (const p of ["%OpenAI%", "%Gemini%", "%Sentinel%", "%Databricks%", "%Claude%", "%Microsoft 365%", "%Copilot%", "%Slack%"]) {
      expect(patterns).toContain(p);
    }
  });

  it("returns a cover for an agency holding a package with the matching service", () => {
    const rows = getContainmentCoverForAgency(1); // VA holds FR_AZURE
    const openai = rows.filter((r) => r.service_pattern === "%OpenAI%");
    expect(openai).toHaveLength(1);
    expect(openai[0].host_fedramp_id).toBe("FR_AZURE");
    expect(openai[0].service).toBe("Azure OpenAI");
    expect(openai[0].impact_level).toBe("High");
    // The Sentinel service in the same package is also in reach.
    expect(rows.some((r) => r.service_pattern === "%Sentinel%")).toBe(true);
  });

  it("returns empty for an agency without the covering package", () => {
    // DHS holds only FR_FILES, whose sole service matches no pattern.
    expect(getContainmentCoverForAgency(2)).toEqual([]);
    // An unmapped agency has no covering package either.
    expect(getContainmentCoverForAgency(999)).toEqual([]);
  });

  it("degrades to empty when the services table is absent", () => {
    db.exec("DROP TABLE fedramp_authorized_services");
    expect(getContainmentCoverForAgency(1)).toEqual([]);
  });
});

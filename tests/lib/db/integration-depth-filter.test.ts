/**
 * Integration-depth facet ↔ filter coherence (IFP-adjudicated 2026-07).
 *
 * The subtle bit is the `not_assessed` sentinel: it is NOT a DB enum value —
 * it must resolve to `integration_depth IS NULL` and, because the tag join is
 * a LEFT JOIN, catch individual rows whose tag row has no depth. This guards
 * both the labeled-value round-trip and the NULL-sentinel semantics.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import { getUseCaseFacets } from "@/lib/db/use-cases/facet-counts";
import { getUseCasesFiltered as searchUseCases } from "@/lib/db/use-cases/refined-search";

beforeAll(() => installTestDb());
afterAll(() => uninstallTestDb());

describe("integration-depth facet + filter", () => {
  it("facet lists only the labeled snake_case values present (no NULL)", () => {
    const { tagIntegrationDepths } = getUseCaseFacets();
    expect(tagIntegrationDepths).toContain("standalone_chat");
    expect(tagIntegrationDepths).toContain("workflow_embedded");
    expect(tagIntegrationDepths).toContain("system_integrated");
    expect(tagIntegrationDepths).toContain("agentic_workflow");
    for (const v of tagIntegrationDepths) expect(v).toMatch(/^[a-z_]+$/);
    // "not_assessed" is a UI-only sentinel, never a DB-distinct value.
    expect(tagIntegrationDepths).not.toContain("not_assessed");
  });

  it("every labeled facet value round-trips to >= 1 individual row", () => {
    const { tagIntegrationDepths } = getUseCaseFacets();
    for (const depth of tagIntegrationDepths) {
      const { total } = searchUseCases({
        integrationDepths: [depth],
        entryKind: "use_case",
      });
      expect(
        total,
        `integration_depth facet value ${JSON.stringify(depth)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("the not_assessed sentinel matches the NULL (unlabeled) individual rows", () => {
    const all = searchUseCases({ entryKind: "use_case" }).total;
    const notAssessed = searchUseCases({
      integrationDepths: ["not_assessed"],
      entryKind: "use_case",
    }).total;
    // Five seeded rows carry a depth; the rest are NULL / not assessed.
    const labeled = searchUseCases({
      integrationDepths: [
        "standalone_chat",
        "workflow_embedded",
        "system_integrated",
        "agentic_workflow",
      ],
      entryKind: "use_case",
    }).total;

    expect(labeled).toBe(5);
    expect(notAssessed).toBeGreaterThan(0);
    // Partition: labeled + not-assessed = every individual row, no overlap.
    expect(labeled + notAssessed).toBe(all);
  });

  it("a labeled value OR'd with not_assessed unions the two sets", () => {
    const embedded = searchUseCases({
      integrationDepths: ["workflow_embedded"],
      entryKind: "use_case",
    }).total;
    const notAssessed = searchUseCases({
      integrationDepths: ["not_assessed"],
      entryKind: "use_case",
    }).total;
    const union = searchUseCases({
      integrationDepths: ["workflow_embedded", "not_assessed"],
      entryKind: "use_case",
    }).total;
    expect(union).toBe(embedded + notAssessed);
  });
});

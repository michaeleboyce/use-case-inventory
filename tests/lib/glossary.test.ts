/**
 * Integrity checks for the site glossary (lib/definitions.ts GLOSSARY):
 * anchor slugs must be unique site-wide (they're #fragment ids on
 * /glossary), and every glossarySlug referenced by a TermDefinition
 * must resolve to a real glossary entry so popover "Full definition →"
 * links never 404-fragment.
 */
import { describe, it, expect } from "vitest";
import {
  GLOSSARY,
  MATURITY_TIER_DEFS,
  READINESS_TIER_DEFS,
  LINEAGE_STATUS_DEFS,
  termDefinition,
} from "@/lib/definitions";

const allSlugs = GLOSSARY.flatMap((g) => g.entries.map((e) => e.slug));

describe("GLOSSARY", () => {
  it("has globally unique anchor slugs", () => {
    expect(new Set(allSlugs).size).toBe(allSlugs.length);
  });

  it("every entry has a term and a definition", () => {
    for (const group of GLOSSARY) {
      for (const entry of group.entries) {
        expect(entry.term.length).toBeGreaterThan(0);
        expect(entry.definition.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("glossarySlug back-references", () => {
  const slugSet = new Set(allSlugs);

  it("tier/lineage definition slugs resolve to glossary entries", () => {
    const defs = [
      ...Object.values(MATURITY_TIER_DEFS),
      ...Object.values(READINESS_TIER_DEFS),
      ...Object.values(LINEAGE_STATUS_DEFS),
    ];
    for (const def of defs) {
      if (def.glossarySlug) {
        expect(slugSet.has(def.glossarySlug), def.glossarySlug).toBe(true);
      }
    }
  });

  it("per-value term definitions resolve to glossary entries", () => {
    for (const [dimension, value] of [
      ["sophistication", "general_llm"],
      ["entry_type", "custom_system"],
      ["scope", "enterprise_wide"],
    ] as const) {
      const def = termDefinition(dimension, value);
      expect(def.glossarySlug).toBe(value);
      expect(slugSet.has(value), `${dimension}:${value}`).toBe(true);
    }
  });
});

/**
 * /stories — view-model.
 *
 * The page's narrative content and statistics are deliberately static: every
 * number is tied to a cited source (the June 2026 article fact sheet and the
 * footnoted press/oversight record), so live queries would let the figures
 * drift away from their citations. The only DB work here is resolving the
 * volatile numeric ids (agencies, products) that deep links need — per
 * AGENTS.md, numeric ids must never be hard-coded in source.
 */

import { getDb } from "@/lib/db/shared/init";
import { getEnterpriseTierRollup } from "@/lib/db";
import type { EnterpriseTierRollupRow } from "@/lib/experience-shared";

/** Agency abbreviations the story cards deep-link to. */
const STORY_AGENCY_ABBRS = [
  "DHS",
  "State",
  "VA",
  "SSA",
  "HHS",
  "DOE",
  "USDA",
  "Treasury",
  "OPM",
  "GSA",
  "DOJ",
  "HUD",
  "SBA",
] as const;

export type StoryAgencyAbbr = (typeof STORY_AGENCY_ABBRS)[number];

/** Products the coda links to by detail page. */
const STORY_PRODUCT_NAMES = ["GitHub Copilot", "Claude Code"] as const;

export type StoryProductName = (typeof STORY_PRODUCT_NAMES)[number];

export interface StoriesViewModel {
  /** abbreviation → live agencies.id (undefined if the abbr is missing). */
  agencyIds: Partial<Record<StoryAgencyAbbr, number>>;
  /** canonical_name → live products.id (undefined if unmatched). */
  productIds: Partial<Record<StoryProductName, number>>;
  /** Delivery-tier rollup for the 2024→2025 flip chart (may be empty
   *  immediately after a `make fix`; the page hides the chart then). */
  tierRollup: EnterpriseTierRollupRow[];
}

export async function buildStoriesViewModel(): Promise<StoriesViewModel> {
  const db = getDb();

  const agencyRows = db
    .prepare<string[], { id: number; abbreviation: string }>(
      `SELECT id, abbreviation FROM agencies
       WHERE abbreviation IN (${STORY_AGENCY_ABBRS.map(() => "?").join(",")})`,
    )
    .all(...STORY_AGENCY_ABBRS);

  const agencyIds: Partial<Record<StoryAgencyAbbr, number>> = {};
  for (const row of agencyRows) {
    agencyIds[row.abbreviation as StoryAgencyAbbr] = row.id;
  }

  const productRows = db
    .prepare<string[], { id: number; canonical_name: string }>(
      `SELECT id, canonical_name FROM products
       WHERE canonical_name IN (${STORY_PRODUCT_NAMES.map(() => "?").join(",")})`,
    )
    .all(...STORY_PRODUCT_NAMES);

  const productIds: Partial<Record<StoryProductName, number>> = {};
  for (const row of productRows) {
    productIds[row.canonical_name as StoryProductName] = row.id;
  }

  return {
    agencyIds,
    productIds,
    tierRollup: getEnterpriseTierRollup(),
  };
}

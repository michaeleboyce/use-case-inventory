/**
 * Client-safe shapes and label maps for the sleeping-services route.
 *
 * Deliberately free of lib/db imports: the client sections (board table,
 * frontier grid, timing chart) import from HERE, while _view-model.ts —
 * which touches better-sqlite3 — is server-only. Importing _view-model
 * from a "use client" file drags the native driver into the browser
 * bundle and breaks the build.
 */
import type {
  CapabilityCategory,
  SleepingCellState,
  SleepingServicePairRow,
  SleepingTimingBucket,
} from "@/lib/types";

export const CAPABILITY_LABELS: Record<CapabilityCategory, string> = {
  genai_platform: "Gen-AI platform",
  assistant: "Assistant / copilot",
  ml_lowcode: "Low-code ML",
  ml_platform: "ML platform",
  doc_processing: "Document processing",
  speech: "Speech",
  translation: "Translation",
  vision: "Vision",
  nlp: "Text analytics",
  search: "Search",
  chatbot: "Chatbot / virtual agent",
};

export const TIMING_LABELS: Record<SleepingTimingBucket, string> = {
  "2022_or_earlier": "2022 or earlier",
  "2023_24": "2023–24",
  "2025h1": "2025 H1",
  "2025h2": "2025 H2",
  post_cutoff: "Post-cutoff (2026)",
  unknown: "No usable date",
};

export interface SleepingPair extends SleepingServicePairRow {
  timing_bucket: SleepingTimingBucket;
  /** Sleeping row whose first host ATO postdates the inventory cutoff —
   *  excluded from headline counts, rendered grayed. */
  timing_excluded: boolean;
}

export interface BoardAgencyDetail {
  agency_id: number;
  agency_abbr: string;
  agency_name: string;
  first_ato_date: string | null;
  timing_bucket: SleepingTimingBucket;
  timing_excluded: boolean;
  recency_last90: boolean;
  similar_deployed: boolean;
  similar_products: string[];
  host_packages: string[];
}

export interface BoardRow {
  product: string;
  slug: string;
  services: string[];
  capability_category: CapabilityCategory;
  gen_ai: boolean;
  confidence: "strong" | "inferred";
  evidence_tier: "named_offering" | "catalog";
  leads: BoardAgencyDetail[];
  sleeping: BoardAgencyDetail[];
  /** Headline sleeping count (timing-excluded rows not counted). */
  sleeping_count: number;
  void_count: number;
  timing_excluded_count: number;
}

export interface GridCell {
  state: SleepingCellState;
  detail: BoardAgencyDetail | null;
}

export interface GridColumn {
  product: string;
  slug: string;
  lead_count: number;
  reach_count: number;
}

export interface GridRow {
  agency_id: number;
  agency_abbr: string;
  agency_name: string;
  cells: GridCell[]; // parallel to columns
  sleeping_count: number;
  void_count: number;
}

export interface MatrixRow {
  agency_abbr: string;
  agency_name: string;
  cells: Array<"reports" | "sleeping_similar" | "sleeping_void" | "none">;
  void_count: number;
}

export interface Funnel {
  reach_pairs: number;
  sleeping: number;
  nothing_similar: number;
  genai_void: number;
  timing_excluded: number;
}

export interface BoardFilters {
  genai: boolean;
  voidOnly: boolean;
  tier: "named_offering" | "catalog" | null;
  capability: CapabilityCategory | null;
  hideTiming: boolean;
}

export function productSlug(product: string): string {
  return product.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

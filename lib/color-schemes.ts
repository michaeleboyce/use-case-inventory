/**
 * Shared vendor → hex color palette for charts.
 *
 * `VENDOR_PALETTE` + `vendorColor()` are the single source for coloring
 * arbitrary vendor strings (heuristic name-variant matching included).
 * The LLM-vendor donut layers curated overrides for its synthetic buckets
 * ("Agency platform", "Vendor unspecified", …) on top — see
 * `LLM_VENDOR_COLOR_OVERRIDES`.
 *
 * Pure module — importable from client chart components.
 */

export const VENDOR_PALETTE: Record<string, string> = {
  Microsoft: "#2563eb", // blue-600
  OpenAI: "#10b981", // emerald-500
  Anthropic: "#f59e0b", // amber-500
  Google: "#ef4444", // red-500
  Amazon: "#f97316", // orange-500
  AWS: "#f97316",
  Meta: "#8b5cf6", // violet-500
  GitHub: "#0ea5e9", // sky-500
};

const FALLBACK = "#64748b"; // slate-500

/** Color for an arbitrary vendor string, with heuristics for name variants
 *  ("Azure" → Microsoft, "Claude" → Anthropic, …). */
export function vendorColor(v: string): string {
  if (VENDOR_PALETTE[v]) return VENDOR_PALETTE[v];
  const lower = v.toLowerCase();
  if (lower.includes("microsoft") || lower.includes("azure"))
    return VENDOR_PALETTE.Microsoft!;
  if (lower.includes("openai")) return VENDOR_PALETTE.OpenAI!;
  if (lower.includes("anthropic") || lower.includes("claude"))
    return VENDOR_PALETTE.Anthropic!;
  if (lower.includes("google") || lower.includes("gemini"))
    return VENDOR_PALETTE.Google!;
  if (lower.includes("amazon") || lower.includes("aws"))
    return VENDOR_PALETTE.Amazon!;
  if (lower.includes("github")) return VENDOR_PALETTE.GitHub!;
  return FALLBACK;
}

/**
 * Curated additions/overrides for the general-LLM vendor donut: smaller
 * commercial vendors plus the donut's synthetic buckets. Spread AFTER
 * `VENDOR_PALETTE` so its Meta override (blue-700, reads better as a
 * slice) wins there without changing the vendor-share bars.
 */
export const LLM_VENDOR_COLOR_OVERRIDES: Record<string, string> = {
  Perplexity: "#0ea5e9", // sky-500
  Palantir: "#6366f1", // indigo-500
  ServiceNow: "#22c55e", // green-500
  Databricks: "#eab308", // yellow-500
  xAI: "#475569", // slate-600
  Meta: "#1d4ed8", // blue-700
  "In-house": "#8b5cf6", // violet-500
  // Agency-built LLM platforms wrapping commercial models (EDAV, VA GPT,
  // ELSA, USAi, LibreChat, etc.). Distinct color so the editorial pattern
  // — "agencies are quietly standing up their own LLM frontends" — reads
  // visually distinct from the commercial-vendor slices.
  "Agency platform": "#a3e635", // lime-400
  "Other named": "#64748b", // slate-500
  // "Vendor unspecified" — agency reports general-LLM access without
  // naming the tool. Distinct from "Other named" (a real vendor, just
  // not in our color map). Render muted so it visually recedes.
  "Vendor unspecified": "#cbd5e1", // slate-300
  Other: "#94a3b8", // slate-400 (legacy fallback)
};

/**
 * Maturity-tier accents — the ONE color vocabulary for the four IFP
 * maturity tiers, expressed in design-system tokens (not raw Tailwind
 * palette classes). Consumed by MaturityTierCard and any tier badge.
 */
export const TIER_ACCENTS: Record<string, string> = {
  leading: "var(--verified)",
  progressing: "var(--ink)",
  early: "var(--highlight)",
  minimal: "oklch(0.7 0.01 60)",
};

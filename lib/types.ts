/**
 * Compatibility barrel for dashboard domain types.
 *
 * Keep importing from "@/lib/types" in application code; domain-specific
 * modules live under "@/lib/types/*" for maintainability.
 */
export * from "./types/inventory";
export * from "./types/hierarchy";
export * from "./types/analytics";
export * from "./types/fedramp";
export * from "./types/discrepancies";
export * from "./types/year-comparison";

/**
 * Public compatibility barrel for analytics query helpers.
 *
 * The implementation is split under `lib/db/analytics/` into agency
 * breakdowns, full-corpus rollups, and cross-cut browse analytics. Keep
 * exporting from this file so `@/lib/db` remains stable.
 */

export * from "./analytics/index";

/**
 * Public compatibility barrel for use-case query helpers.
 *
 * The implementation is split by responsibility under `lib/db/use-cases/`:
 * details, explorer filtering, facets, product lookups, evidence, and related
 * rows. Keep exporting from this file so `@/lib/db` remains stable.
 */

export * from "./use-cases/index";

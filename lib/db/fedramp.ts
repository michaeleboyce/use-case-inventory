/**
 * Public compatibility barrel for FedRAMP query helpers.
 *
 * The implementation is split under `lib/db/fedramp/` into marketplace,
 * inventory-link/coverage-state, coverage dashboard, and curation-queue
 * modules. Keep exporting from this file so `@/lib/db` remains stable.
 */

export * from "./fedramp/index";

/**
 * Public compatibility barrel for the /experience query helpers.
 *
 * The implementation is split under `lib/db/experience/` by domain
 * (headlines, timeline, seats, tool-matrix, year-compare, capability).
 * Keep re-exporting from this file so `@/lib/db` and the one direct
 * `@/lib/db/experience` importer (components/experience/capability-ladder.tsx)
 * remain stable.
 */

export * from "./experience/index";

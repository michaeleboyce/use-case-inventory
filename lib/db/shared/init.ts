/**
 * SQLite connection singleton for the dashboard's read-only query layer.
 *
 * Opened once per Node process in read-only mode and kept warm across hot
 * reloads via a `globalThis` cache. Domain modules under `lib/db/` import
 * `getDb()` (or use the `query()` helpers in `./query`) — they should not
 * open their own connections.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Prefer an in-project copy of the DB so the file travels with the Next.js
// bundle on Vercel (where `process.cwd()` is the function root, not the repo
// root). Fall back to the parent-directory layout used during local ETL
// iteration where the dashboard lives next to the data/ folder.
const DB_PATH = (() => {
  const inProject = path.join(process.cwd(), "data", "federal_ai_inventory_2025.db");
  const parent = path.join(process.cwd(), "..", "data", "federal_ai_inventory_2025.db");
  if (fs.existsSync(inProject)) return inProject;
  if (fs.existsSync(parent)) return parent;
  // Final fallback: let better-sqlite3 raise the familiar "not found" error
  // against the in-project path so messages point at the right place.
  return inProject;
})();

declare global {
  // eslint-disable-next-line no-var
  var __aiInventoryDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (!globalThis.__aiInventoryDb) {
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("cache_size = -32000"); // ~32 MB page cache
    globalThis.__aiInventoryDb = db;
  }
  return globalThis.__aiInventoryDb;
}

/** Expose a raw handle for ad-hoc scripts. Do not use from React trees. */
export function rawDb(): Database.Database {
  return getDb();
}

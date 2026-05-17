/**
 * Test harness for the dashboard's `lib/db/*` query layer.
 *
 * Builds a fresh in-memory SQLite from `tests/fixtures/{schema,seed}.sql` and
 * installs it as the `getDb()` override (see `lib/db/shared/init.ts`). The
 * schema file is generated once from the real DB via:
 *
 *   sqlite3 data/federal_ai_inventory_2025.db .schema > tests/fixtures/schema.sql
 *
 * Re-run that command whenever schema changes. The seed is hand-curated and
 * intentionally minimal — see its file header for row conventions.
 *
 * Usage in a test file:
 *
 *   import { beforeAll, afterAll } from "vitest";
 *   import { installTestDb, uninstallTestDb } from "@/tests/setup";
 *
 *   beforeAll(() => installTestDb());
 *   afterAll(() => uninstallTestDb());
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { setDbOverride } from "@/lib/db/shared/init";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");

let _activeDb: Database.Database | null = null;

function runSql(db: Database.Database, sqlText: string): void {
  // `Database.exec` runs a multi-statement SQL string. (better-sqlite3 API —
  // not `child_process.exec`, despite the name collision.)
  db.exec(sqlText);
}

/** Open a fresh in-memory DB seeded from the fixture SQL files. */
export function getTestDb(): Database.Database {
  const db = new Database(":memory:");
  const rawSchema = fs.readFileSync(
    path.join(FIXTURES_DIR, "schema.sql"),
    "utf8",
  );
  // `.schema` dumps include `CREATE TABLE sqlite_sequence(...)` which SQLite
  // rejects as a reserved name when re-executed — strip it. Autoincrement
  // tables recreate the row themselves on first insert.
  const schema = rawSchema
    .split("\n")
    .filter((line) => !line.startsWith("CREATE TABLE sqlite_sequence"))
    .join("\n");
  const seed = fs.readFileSync(path.join(FIXTURES_DIR, "seed.sql"), "utf8");
  runSql(db, schema);
  runSql(db, seed);
  return db;
}

/**
 * Install a fresh seeded test DB as the override returned by `getDb()`.
 * Pair with `uninstallTestDb()` in an `afterAll` hook.
 */
export function installTestDb(): Database.Database {
  if (_activeDb) _activeDb.close();
  _activeDb = getTestDb();
  setDbOverride(_activeDb);
  return _activeDb;
}

/** Tear down the override and close the in-memory DB. */
export function uninstallTestDb(): void {
  setDbOverride(null);
  if (_activeDb) {
    _activeDb.close();
    _activeDb = null;
  }
}

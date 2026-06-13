// Copy the ETL-built SQLite DB into the dashboard's data/ directory before
// build, so Vercel bundles the current snapshot. The dashboard ships the DB
// inside its own git repo (see AGENTS.md "Multi-agent safety: DB and
// deploy"); this script keeps the committed copy in sync with the ETL repo's
// build output when both checkouts are present locally.
//
// No-op when the source isn't present (e.g. on Vercel, where only the
// committed copy exists) — the build then uses whatever is committed.

import { copyFileSync, existsSync } from "node:fs";

const SRC = "../data/federal_ai_inventory_2025.db";
const DEST = "data/federal_ai_inventory_2025.db";

if (existsSync(SRC)) {
  copyFileSync(SRC, DEST);
  console.log(`[sync-db] copied ${SRC} → ${DEST}`);
} else {
  console.log(`[sync-db] source ${SRC} not present — using committed ${DEST}`);
}

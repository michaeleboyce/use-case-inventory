/**
 * Resolution overlay for /discrepancies.
 *
 * Persists human triage decisions (e.g., "OMB-side typo, ignored",
 * "Will ingest in next round") in `data/discrepancy_resolutions.json`,
 * keyed by (agency, use_case_name) so the data survives ETL re-runs
 * (which DELETE+INSERT omb_match_audit and regenerate the surrogate id
 * column).
 *
 * Persistence model:
 *   - The JSON file is checked into the dashboard repo.
 *   - In local dev (npm run dev), the server action writes to it directly.
 *   - On Vercel, writes are blocked (the filesystem is ephemeral, so a
 *     write would silently disappear). The UI surfaces this with a
 *     "local-only" notice and disables the Mark/Unmark buttons.
 *   - To deploy resolutions, commit the JSON file and push.
 */
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "discrepancy_resolutions.json");

export interface Resolution {
  /** `${agency_abbreviation}::${use_case_name}` — see buildResolutionKey. */
  key: string;
  /** ISO-8601 UTC timestamp when the resolution was recorded. */
  resolved_at: string;
  /** Free-text triage note. Kept short; for paragraphs use a linked doc. */
  note: string;
}

interface ResolutionsFile {
  resolutions: Resolution[];
}

export function buildResolutionKey(
  agency: string | null,
  name: string | null,
): string {
  return `${(agency ?? "").trim()}::${(name ?? "").trim()}`;
}

/** Read all resolutions. Returns an empty array if the file is missing. */
export function readResolutions(): Resolution[] {
  if (!fs.existsSync(FILE)) return [];
  try {
    const text = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(text) as ResolutionsFile;
    return Array.isArray(parsed.resolutions) ? parsed.resolutions : [];
  } catch {
    return [];
  }
}

/**
 * Returns true if writes will persist (local dev). False on Vercel.
 *
 * Vercel sets `VERCEL=1` in every server runtime; this is the canonical
 * signal. We treat any other environment as "local dev OK to write."
 */
export function canWriteResolutions(): boolean {
  return process.env.VERCEL !== "1";
}

/**
 * Writes a resolution by key. If a record with the same key exists, it's
 * replaced (keeps the file at most one row per key). Throws when writes
 * are blocked.
 */
export function upsertResolution(key: string, note: string): Resolution {
  if (!canWriteResolutions()) {
    throw new Error(
      "Production filesystem is read-only — resolution writes are local-dev only.",
    );
  }
  const all = readResolutions().filter((r) => r.key !== key);
  const fresh: Resolution = {
    key,
    resolved_at: new Date().toISOString(),
    note: note.trim(),
  };
  all.push(fresh);
  // Sort by resolved_at desc so the file stays scannable in PRs.
  all.sort((a, b) => (a.resolved_at < b.resolved_at ? 1 : -1));
  const out = {
    _about:
      "Human-curated triage decisions for /discrepancies. Keyed by (agency::use_case_name) — stable across ETL re-runs even though omb_match_audit.id is regenerated on each load. Edit only via the dashboard's Mark/Unmark buttons in local dev (npm run dev), then commit + push to deploy. Writes are blocked in production (Vercel filesystems are ephemeral).",
    resolutions: all,
  };
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
  return fresh;
}

/** Remove the resolution for a key. No-op if absent. */
export function deleteResolution(key: string): void {
  if (!canWriteResolutions()) {
    throw new Error(
      "Production filesystem is read-only — resolution writes are local-dev only.",
    );
  }
  const all = readResolutions();
  const filtered = all.filter((r) => r.key !== key);
  if (filtered.length === all.length) return;
  const out = {
    _about:
      "Human-curated triage decisions for /discrepancies. Keyed by (agency::use_case_name) — stable across ETL re-runs even though omb_match_audit.id is regenerated on each load. Edit only via the dashboard's Mark/Unmark buttons in local dev (npm run dev), then commit + push to deploy. Writes are blocked in production (Vercel filesystems are ephemeral).",
    resolutions: filtered,
  };
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
}

/** Build a Map<key, Resolution> for O(1) overlay onto query results. */
export function getResolutionMap(): Map<string, Resolution> {
  const map = new Map<string, Resolution>();
  for (const r of readResolutions()) map.set(r.key, r);
  return map;
}

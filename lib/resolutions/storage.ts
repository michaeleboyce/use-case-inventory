import fs from "node:fs";
import path from "node:path";

import type { ResolutionReason } from "../types";

export interface StoredResolution {
  key: string;
  resolved_at: string;
  note: string;
  reason?: ResolutionReason | null;
}

interface ResolutionsFile {
  resolutions: StoredResolution[];
}

const RESOLUTION_FILE = path.join(
  process.cwd(),
  "data",
  "discrepancy_resolutions.json",
);

const RESOLUTION_FILE_ABOUT =
  "Human-curated triage decisions for /discrepancies. Keyed by (agency::use_case_name) — stable across ETL re-runs even though omb_match_audit.id is regenerated on each load. Edit only via the dashboard's Mark/Unmark buttons in local dev (npm run dev), then commit + push to deploy. Writes are blocked in production (Vercel filesystems are ephemeral).";

export function canWriteResolutionStorage(): boolean {
  return process.env.VERCEL !== "1";
}

export function readResolutionFile(): StoredResolution[] {
  if (!fs.existsSync(RESOLUTION_FILE)) return [];
  try {
    const text = fs.readFileSync(RESOLUTION_FILE, "utf8");
    const parsed = JSON.parse(text) as ResolutionsFile;
    if (!Array.isArray(parsed.resolutions)) return [];
    return parsed.resolutions;
  } catch {
    return [];
  }
}

export function writeResolutionFile(resolutions: StoredResolution[]): void {
  const out = {
    _about: RESOLUTION_FILE_ABOUT,
    resolutions,
  };
  fs.writeFileSync(
    RESOLUTION_FILE,
    JSON.stringify(out, null, 2) + "\n",
    "utf8",
  );
}

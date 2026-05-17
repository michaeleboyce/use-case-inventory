"use server";

/**
 * Server actions for /discrepancies resolution UI.
 *
 * Mutates `data/discrepancy_resolutions.json` and revalidates the
 * affected pages. Writes are blocked when running on Vercel (filesystem
 * is ephemeral); the UI surfaces this state and disables the buttons.
 *
 * The intended workflow:
 *   1. Run `npm run dev` locally.
 *   2. Open /discrepancies, mark / unmark cases as you triage.
 *   3. `git add data/discrepancy_resolutions.json && git commit && git push`.
 *   4. Vercel rebuilds; production now reflects the resolutions.
 */
import { revalidatePath } from "next/cache";

import { rawDb } from "@/lib/db";
import {
  buildResolutionKey,
  canWriteResolutions,
  deleteResolution,
  getResolution,
  upsertResolution,
} from "@/lib/resolutions";
import {
  RESOLUTION_REASON_LABELS,
  type ResolutionReason,
} from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** When a bulk action partially succeeds, the number of records updated. */
  count?: number;
}

function isResolutionReason(
  v: string | null | undefined,
): v is ResolutionReason {
  if (v == null) return false;
  return Object.prototype.hasOwnProperty.call(RESOLUTION_REASON_LABELS, v);
}

/**
 * Form-action variant: pulls audit id, agency, name, reason, and note out
 * of FormData. The reason field MUST be a known `ResolutionReason` key —
 * invalid input returns `{ ok: false, error: 'invalid reason' }`.
 */
export async function markResolved(formData: FormData): Promise<ActionResult> {
  if (!canWriteResolutions()) {
    return {
      ok: false,
      error:
        "Production filesystem is read-only. Mark resolutions in local dev (npm run dev), then commit + push.",
    };
  }
  const agency = (formData.get("agency") as string | null) ?? "";
  const name = (formData.get("name") as string | null) ?? "";
  const note = ((formData.get("note") as string | null) ?? "").trim();
  const auditId = (formData.get("auditId") as string | null) ?? "";
  const reasonRaw = formData.get("reason") as string | null;

  if (!agency || !name) {
    return { ok: false, error: "Missing agency or use case name." };
  }
  if (!isResolutionReason(reasonRaw)) {
    return { ok: false, error: "invalid reason" };
  }
  try {
    upsertResolution(buildResolutionKey(agency, name), note, reasonRaw);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  revalidatePath("/discrepancies");
  if (auditId) revalidatePath(`/discrepancies/${auditId}`);
  return { ok: true };
}

/**
 * Programmatic variant used by keyboard handlers and other non-form callers.
 * Resolves the audit row's agency + use_case_name from the DB by id, then
 * writes the resolution. Validates `reason` against `RESOLUTION_REASON_LABELS`.
 */
export async function markResolvedById(
  auditId: number,
  reason: ResolutionReason,
  note?: string,
): Promise<ActionResult> {
  if (!canWriteResolutions()) {
    return {
      ok: false,
      error: "Production filesystem is read-only.",
    };
  }
  if (!isResolutionReason(reason)) {
    return { ok: false, error: "invalid reason" };
  }
  const db = rawDb();
  const row = db
    .prepare<
      [number],
      { agency_abbreviation: string | null; use_case_name: string | null }
    >(
      "SELECT agency_abbreviation, use_case_name FROM omb_match_audit WHERE id = ?",
    )
    .get(auditId);
  if (!row || !row.agency_abbreviation || !row.use_case_name) {
    return { ok: false, error: "Audit row not found." };
  }
  try {
    upsertResolution(
      buildResolutionKey(row.agency_abbreviation, row.use_case_name),
      (note ?? "").trim(),
      reason,
    );
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  revalidatePath("/discrepancies");
  revalidatePath(`/discrepancies/${auditId}`);
  return { ok: true };
}

/**
 * Bulk-resolve a list of audit ids with a single reason. Loops the
 * single-mark logic for each id; partial failures are reported via
 * `count` (number applied) — first error short-circuits.
 *
 * Local-only — gated by `canWriteResolutions()`. On Vercel the bulk
 * action bar should not be rendered at all, but we double-check here.
 */
export async function markManyResolved(
  auditIds: number[],
  reason: ResolutionReason,
  note?: string,
): Promise<{ ok: boolean; resolved: number; skipped: number; message?: string }> {
  if (!canWriteResolutions()) {
    return {
      ok: false,
      resolved: 0,
      skipped: 0,
      message: "Production filesystem is read-only.",
    };
  }
  if (!isResolutionReason(reason)) {
    return { ok: false, resolved: 0, skipped: 0, message: "invalid reason" };
  }
  if (!Array.isArray(auditIds) || auditIds.length === 0) {
    return { ok: false, resolved: 0, skipped: 0, message: "No audit ids supplied." };
  }
  const db = rawDb();
  const stmt = db.prepare<
    [number],
    { agency_abbreviation: string | null; use_case_name: string | null }
  >(
    "SELECT agency_abbreviation, use_case_name FROM omb_match_audit WHERE id = ?",
  );
  let resolved = 0;
  let skipped = 0;
  const trimmedNote = (note ?? "").trim();
  for (const id of auditIds) {
    const row = stmt.get(id);
    if (!row || !row.agency_abbreviation || !row.use_case_name) {
      skipped += 1;
      continue;
    }
    const key = buildResolutionKey(row.agency_abbreviation, row.use_case_name);
    // Idempotent: skip ids whose key is already resolved.
    if (getResolution(key) != null) {
      skipped += 1;
      continue;
    }
    try {
      upsertResolution(key, trimmedNote, reason);
      resolved += 1;
    } catch (err) {
      return {
        ok: false,
        resolved,
        skipped,
        message: (err as Error).message,
      };
    }
  }
  revalidatePath("/discrepancies");
  return { ok: true, resolved, skipped };
}

export async function unmarkResolved(
  formData: FormData,
): Promise<ActionResult> {
  if (!canWriteResolutions()) {
    return {
      ok: false,
      error:
        "Production filesystem is read-only. Edit resolutions in local dev.",
    };
  }
  const agency = (formData.get("agency") as string | null) ?? "";
  const name = (formData.get("name") as string | null) ?? "";
  const auditId = (formData.get("auditId") as string | null) ?? "";

  if (!agency || !name) {
    return { ok: false, error: "Missing agency or use case name." };
  }
  try {
    deleteResolution(buildResolutionKey(agency, name));
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  revalidatePath("/discrepancies");
  if (auditId) revalidatePath(`/discrepancies/${auditId}`);
  return { ok: true };
}

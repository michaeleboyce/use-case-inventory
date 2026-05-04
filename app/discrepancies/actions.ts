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

import {
  buildResolutionKey,
  canWriteResolutions,
  deleteResolution,
  upsertResolution,
} from "@/lib/resolutions";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

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

  if (!agency || !name) {
    return { ok: false, error: "Missing agency or use case name." };
  }
  try {
    upsertResolution(buildResolutionKey(agency, name), note);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  revalidatePath("/discrepancies");
  if (auditId) revalidatePath(`/discrepancies/${auditId}`);
  return { ok: true };
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

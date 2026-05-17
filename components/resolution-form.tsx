"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markResolved, unmarkResolved } from "@/app/discrepancies/actions";
import {
  RESOLUTION_REASON_LABELS,
  type ResolutionReason,
} from "@/lib/types";

interface Props {
  auditId: number;
  agency: string;
  name: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  resolutionReason: ResolutionReason | null;
  /** When false, the form renders read-only with a "production is local-only" notice. */
  canWrite: boolean;
  /** Prefetched, ordered list of all unresolved audit ids — used by the
   *  detail page's "submit + advance" flow so we don't refetch on every
   *  keypress. May be empty if the page didn't supply it. */
  orderedAuditIds?: number[];
}

const REASON_KEYS = Object.keys(RESOLUTION_REASON_LABELS) as ResolutionReason[];

export function ResolutionForm({
  auditId,
  agency,
  name,
  resolvedAt,
  resolutionNote,
  resolutionReason,
  canWrite,
  orderedAuditIds = [],
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState<ResolutionReason | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (resolvedAt) {
    return (
      <div className="space-y-3 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-800">
              Resolved
            </p>
            <p className="font-mono text-xs text-emerald-900/70">
              {new Date(resolvedAt).toLocaleString()}
            </p>
          </div>
          {canWrite ? (
            <form
              action={(fd) => {
                fd.set("auditId", String(auditId));
                fd.set("agency", agency);
                fd.set("name", name);
                startTransition(async () => {
                  const r = await unmarkResolved(fd);
                  if (!r.ok) setError(r.error ?? "Unknown error");
                });
              }}
            >
              <button
                type="submit"
                disabled={pending}
                className="rounded border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
              >
                {pending ? "Working…" : "Unresolve"}
              </button>
            </form>
          ) : null}
        </div>
        {resolutionReason ? (
          <span className="font-display text-sm text-stone-900">
            Reason: {RESOLUTION_REASON_LABELS[resolutionReason]}
          </span>
        ) : null}
        {resolutionNote ? (
          <p className="whitespace-pre-wrap text-emerald-950">
            {resolutionNote}
          </p>
        ) : (
          <p className="italic text-emerald-900/60">No note left.</p>
        )}
        {!canWrite ? (
          <p className="text-xs text-emerald-900/70">
            Editing is local-dev only. To change a resolution, run{" "}
            <code className="font-mono">npm run dev</code> and update there.
          </p>
        ) : null}
        {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="rounded border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
        <p className="font-medium">Resolutions are local-dev only.</p>
        <p className="mt-1 text-stone-600">
          Vercel serverless filesystems are ephemeral, so this surface
          can&rsquo;t persist edits. To triage:
        </p>
        <ol className="mt-2 list-decimal pl-5 text-stone-600">
          <li>
            Pull the dashboard repo and run{" "}
            <code className="font-mono">npm run dev</code>.
          </li>
          <li>Open this page locally and click Mark resolved.</li>
          <li>
            <code className="font-mono">git commit</code>{" "}
            <code className="font-mono">data/discrepancy_resolutions.json</code>{" "}
            and push.
          </li>
        </ol>
      </div>
    );
  }

  const canSubmit = reason !== "" && !pending;

  return (
    <form
      action={(fd) => {
        if (reason === "") return;
        fd.set("auditId", String(auditId));
        fd.set("agency", agency);
        fd.set("name", name);
        fd.set("reason", reason);
        startTransition(async () => {
          const r = await markResolved(fd);
          if (!r.ok) {
            setError(r.error ?? "Unknown error");
            return;
          }
          setNote("");
          setReason("");
          setError(null);
          // Auto-advance: if the user gave us an ordered list and there's a
          // next unresolved id, route there. Otherwise just refresh the
          // current page so the "resolved" state renders.
          const idx = orderedAuditIds.indexOf(auditId);
          const nextId =
            idx >= 0 && idx + 1 < orderedAuditIds.length
              ? orderedAuditIds[idx + 1]
              : null;
          if (nextId != null) {
            router.push(`/discrepancies/${nextId}`);
          } else {
            router.refresh();
          }
        });
      }}
      className="space-y-3 rounded border border-stone-200 p-4"
    >
      <label className="block text-xs uppercase tracking-wider text-stone-500">
        Resolution reason
        <select
          id="resolution-reason"
          name="reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value as ResolutionReason)}
          className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm font-normal normal-case tracking-normal text-stone-900"
        >
          <option value="" disabled>
            Select reason…
          </option>
          {REASON_KEYS.map((key) => (
            <option key={key} value={key}>
              {RESOLUTION_REASON_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs uppercase tracking-wider text-stone-500">
        Note (optional)
        <textarea
          name="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., 'OMB-side typo, ignored' or 'Verified ID DHS-2577'"
          className="mt-1 block w-full rounded border border-stone-300 px-2 py-1 text-sm font-normal normal-case tracking-normal text-stone-900"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Mark resolved"}
        </button>
        {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      </div>
    </form>
  );
}

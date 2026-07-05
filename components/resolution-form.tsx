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
      <div className="space-y-3 border border-[var(--verified)]/30 bg-[var(--verified)]/10 p-4 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--verified)]">
              Resolved
            </p>
            <p className="font-mono text-xs text-[var(--verified)]/70">
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
                className="border border-[var(--verified)]/40 bg-background px-3 py-1 text-xs font-medium text-[var(--verified)] hover:bg-[var(--verified)]/10 disabled:opacity-50"
              >
                {pending ? "Working…" : "Unresolve"}
              </button>
            </form>
          ) : null}
        </div>
        {resolutionReason ? (
          <span className="font-display text-sm text-foreground">
            Reason: {RESOLUTION_REASON_LABELS[resolutionReason]}
          </span>
        ) : null}
        {resolutionNote ? (
          <p className="whitespace-pre-wrap text-foreground">
            {resolutionNote}
          </p>
        ) : (
          <p className="italic text-muted-foreground">No note left.</p>
        )}
        {!canWrite ? (
          <p className="text-xs text-[var(--verified)]/70">
            Editing is local-dev only. To change a resolution, run{" "}
            <code className="font-mono">npm run dev</code> and update there.
          </p>
        ) : null}
        {error ? <p className="text-xs text-[var(--stamp)]">{error}</p> : null}
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="border border-border bg-muted/20 p-4 text-sm text-foreground">
        <p className="font-medium">Resolutions are local-dev only.</p>
        <p className="mt-1 text-muted-foreground">
          Vercel serverless filesystems are ephemeral, so this surface
          can&rsquo;t persist edits. To triage:
        </p>
        <ol className="mt-2 list-decimal pl-5 text-muted-foreground">
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
      className="space-y-3 border border-border p-4"
    >
      <label className="block text-xs uppercase tracking-wider text-muted-foreground">
        Resolution reason
        <select
          id="resolution-reason"
          name="reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value as ResolutionReason)}
          className="mt-1 block w-full border border-border bg-background px-2 py-1 text-sm font-normal normal-case tracking-normal text-foreground"
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
      <label className="block text-xs uppercase tracking-wider text-muted-foreground">
        Note (optional)
        <textarea
          name="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., 'OMB-side typo, ignored' or 'Verified ID DHS-2577'"
          className="mt-1 block w-full border border-border px-2 py-1 text-sm font-normal normal-case tracking-normal text-foreground"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Mark resolved"}
        </button>
        {error ? <p className="text-xs text-[var(--stamp)]">{error}</p> : null}
      </div>
    </form>
  );
}

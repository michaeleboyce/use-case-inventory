"use client";

/**
 * Bulk-resolve dialog (local-mode only).
 *
 * Triggered by a top-of-page "Bulk action" button. The user pastes or
 * types a list of audit ids (comma- or whitespace-separated, or hyphen
 * ranges like 1200-1215), picks a reason, optionally adds a note, and
 * hits "Resolve all". Calls `markManyResolved`.
 *
 * We chose a dialog-based UX (rather than per-row checkboxes) so this
 * file doesn't conflict with Agent A's `discrepancy-table.tsx` changes.
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { markManyResolved } from "@/app/discrepancies/actions";
import {
  RESOLUTION_REASON_LABELS,
  type ResolutionReason,
} from "@/lib/types";

const REASON_KEYS = Object.keys(RESOLUTION_REASON_LABELS) as ResolutionReason[];

function parseIds(input: string): number[] {
  const out = new Set<number>();
  // Split on commas / whitespace, then walk each chunk. Hyphen ranges
  // expand inline.
  for (const chunk of input.split(/[\s,]+/)) {
    if (!chunk) continue;
    const rangeMatch = chunk.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const lo = Math.min(Number(rangeMatch[1]), Number(rangeMatch[2]));
      const hi = Math.max(Number(rangeMatch[1]), Number(rangeMatch[2]));
      for (let i = lo; i <= hi; i++) out.add(i);
      continue;
    }
    const n = Number(chunk);
    if (Number.isFinite(n) && n > 0) out.add(n);
  }
  return Array.from(out);
}

export function BulkResolveBar() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [idsText, setIdsText] = useState("");
  const [reason, setReason] = useState<ResolutionReason | "">("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsedIds = parseIds(idsText);
  const canSubmit = parsedIds.length > 0 && reason !== "" && !pending;

  function open() {
    setResult(null);
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason === "" || parsedIds.length === 0) return;
    startTransition(async () => {
      const r = await markManyResolved(parsedIds, reason, note);
      if (!r.ok) {
        setError(r.message ?? "Unknown error");
        return;
      }
      setError(null);
      setResult(`Resolved ${r.resolved}, skipped ${r.skipped}.`);
      setIdsText("");
      setNote("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1 border border-stone-300 bg-white px-3 py-1.5 font-display text-sm text-stone-900 hover:bg-stone-100"
      >
        Bulk resolve…
      </button>

      <dialog
        ref={dialogRef}
        className="border border-stone-300 bg-white p-6 backdrop:bg-stone-900/30"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <form onSubmit={onSubmit} className="min-w-[28rem] max-w-xl space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg text-stone-900">
              Bulk resolve discrepancies
            </h2>
            <button
              type="button"
              onClick={close}
              className="text-sm text-stone-500 hover:text-stone-900"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <label className="block text-xs uppercase tracking-wider text-stone-500">
            Audit IDs
            <textarea
              value={idsText}
              onChange={(e) => setIdsText(e.target.value)}
              rows={4}
              placeholder="Paste audit IDs, separated by commas, spaces, or newlines. Hyphen ranges OK (e.g., 1200-1215)."
              className="mt-1 block w-full rounded border border-stone-300 px-2 py-1 font-mono text-sm font-normal normal-case tracking-normal text-stone-900"
            />
            <span className="mt-1 block text-xs text-stone-500">
              Parsed: {parsedIds.length} id{parsedIds.length === 1 ? "" : "s"}
            </span>
          </label>

          <label className="block text-xs uppercase tracking-wider text-stone-500">
            Reason
            <select
              value={reason}
              required
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
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block w-full rounded border border-stone-300 px-2 py-1 text-sm font-normal normal-case tracking-normal text-stone-900"
            />
          </label>

          {error ? <p className="text-xs text-rose-700">{error}</p> : null}
          {result ? <p className="text-xs text-emerald-700">{result}</p> : null}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Resolving…" : `Resolve ${parsedIds.length}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setIdsText("");
                setNote("");
                setReason("");
                setResult(null);
                setError(null);
              }}
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              Clear
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

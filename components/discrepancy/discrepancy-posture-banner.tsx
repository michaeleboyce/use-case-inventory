/**
 * Posture banner for /discrepancies.
 *
 * Detects deployment context via `process.env.VERCEL` (server-only) and
 * tells the reader whether they're on the published audit log (Vercel,
 * read-only) or the local triage workbench (writes to JSON).
 */
export function DiscrepancyPostureBanner() {
  const isVercel = process.env.VERCEL === "1";

  if (isVercel) {
    return (
      <aside className="border-l-4 border-stone-400 bg-stone-50 px-4 py-2 text-sm text-stone-700">
        Published audit log — read-only. To triage, open this page in a local{" "}
        <code className="font-mono">npm run dev</code> session.
      </aside>
    );
  }

  return (
    <aside className="border-l-4 border-amber-700 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      Triage workbench — resolutions write to{" "}
      <code className="font-mono">data/discrepancy_resolutions.json</code>.
      Commit and push to publish.
    </aside>
  );
}

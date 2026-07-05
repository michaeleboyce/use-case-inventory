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
      <aside className="border-l-4 border-border bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
        Published audit log — read-only. To triage, open this page in a local{" "}
        <code className="font-mono">npm run dev</code> session.
      </aside>
    );
  }

  return (
    <aside className="border-l-4 border-[var(--highlight)] bg-[var(--highlight)]/10 px-4 py-2 text-sm text-foreground">
      Triage workbench — resolutions write to{" "}
      <code className="font-mono">data/discrepancy_resolutions.json</code>.
      Commit and push to publish.
    </aside>
  );
}

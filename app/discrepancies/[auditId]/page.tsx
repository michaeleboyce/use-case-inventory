/**
 * /discrepancies/[auditId] — drill-down for a single OMB↔DB match attempt.
 *
 * Renders the audit row metadata + a side-by-side diff over the 10
 * canonical fields. Drift fields are tinted; matched fields are quiet.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDiscrepancyDetail, getDiscrepancyRows } from "@/lib/discrepancies";
import { canWriteResolutions } from "@/lib/resolutions";
import { Section, MonoChip } from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { DiscrepancySideBySide } from "@/components/discrepancy/discrepancy-side-by-side";
import { KeyboardShortcutHost } from "@/components/keyboard-shortcut-host";
import { ResolutionForm } from "@/components/resolution-form";
import { SessionCounterPill } from "@/components/session-counter-pill";

const STATUS_LABEL: Record<string, string> = {
  matched_exact: "Exact match",
  matched_fuzzy: "Fuzzy match",
  suggested_rename: "Suggested rename",
  omb_only: "OMB only (new in OMB)",
  db_only: "DB only (vanished from OMB)",
  duplicate_in_omb: "Duplicate in OMB",
  consolidated_upstream: "Consolidated upstream by OMB",
};

export default async function DiscrepancyDetailPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const id = Number(auditId);
  if (!Number.isFinite(id) || id <= 0) return notFound();

  const detail = getDiscrepancyDetail(id);
  if (!detail) return notFound();

  const { audit, drift } = detail;
  const statusLabel = STATUS_LABEL[audit.match_status] ?? audit.match_status;
  const canWrite = canWriteResolutions();
  // Server-prefetched ordered list of unresolved audit ids — drives both
  // the resolution form's auto-advance and the j/k keyboard handlers.
  const orderedAuditIds = canWrite
    ? getDiscrepancyRows({ unresolvedOnly: true }).map((r) => r.audit_id)
    : [];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link
          href="/discrepancies"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All discrepancies
        </Link>
        {canWrite ? (
          <SessionCounterPill totalUnresolved={orderedAuditIds.length} />
        ) : null}
      </div>

      <PageMasthead
        kicker={`§ ${statusLabel}`}
        title={audit.use_case_name ?? "(unnamed use case)"}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {audit.agency_abbreviation ? (
              <MonoChip
                size="sm"
                tone="stamp"
                href={`/agencies/${audit.agency_abbreviation}`}
              >
                {audit.agency_abbreviation}
              </MonoChip>
            ) : null}
            <span>·</span>
            <span>
              IFP ID:{" "}
              <span className="font-mono">
                {audit.db_use_case_id_text ?? "—"}
              </span>
            </span>
            <span>·</span>
            <span>
              OMB ID:{" "}
              <span className="font-mono">{audit.omb_use_case_id ?? "—"}</span>
            </span>
            {audit.match_score != null ? (
              <>
                <span>·</span>
                <span>match score {audit.match_score.toFixed(2)}</span>
              </>
            ) : null}
            {audit.db_use_case_slug ? (
              <>
                <span>·</span>
                <Link
                  href={`/use-cases/${audit.db_use_case_slug}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Open use case →
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      <Section
        number="I"
        title="DB vs OMB — field-by-field"
        source="omb-derived"
        lede={
          drift.length === 0
            ? "No drift detected on the 10 compared fields."
            : `${drift.length} field${drift.length === 1 ? "" : "s"} differ between the agency-as-filed DB row and OMB's consolidated entry.`
        }
      >
        <DiscrepancySideBySide detail={detail} />

        {detail.consolidated_into_omb_id != null ? (
          <aside className="border-l-4 border-[var(--highlight)] bg-[var(--highlight)]/10 px-4 py-3 mt-6">
            <p className="text-sm text-foreground">
              <strong className="font-display">
                OMB rolled this into a generic category row.
              </strong>{" "}
              This DB row appears to have been consolidated upstream into{" "}
              <span className="font-mono">#{detail.consolidated_into_omb_id}</span>
              {' "'}
              {detail.consolidated_into_omb_name}
              {'"'}
              {detail.consolidated_into_omb_bureau ? (
                <>
                  {" "}in the <em>{detail.consolidated_into_omb_bureau}</em> bureau
                </>
              ) : null}
              .{" "}If you accept this explanation, mark resolved with reason
              {' "Consolidated upstream by OMB"'}.
            </p>
          </aside>
        ) : null}

        {(detail.db_source_file || detail.omb_source_file) ? (
          <footer className="mt-6 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground leading-relaxed">
            {detail.db_source_file ? (
              <div>
                IFP DB row · source:{" "}
                <span className="text-foreground">{detail.db_source_file}</span>
                {detail.db_ingested_at ? (
                  <>
                    {" "}· ingested{" "}
                    {detail.db_ingested_at.slice(0, 19).replace("T", " ")}
                  </>
                ) : null}
              </div>
            ) : null}
            {detail.omb_source_file ? (
              <div>
                OMB row · source:{" "}
                <span className="text-foreground">{detail.omb_source_file}</span>
                {detail.omb_source_row ? (
                  <> · row {detail.omb_source_row}</>
                ) : null}
                {detail.omb_ingested_at ? (
                  <>
                    {" "}· ingested{" "}
                    {detail.omb_ingested_at.slice(0, 19).replace("T", " ")}
                  </>
                ) : null}
              </div>
            ) : null}
          </footer>
        ) : null}
      </Section>

      <Section
        number="II"
        title="Triage"
        source="derived"
        lede="Mark this discrepancy resolved once a human has decided what to do. Resolutions are persisted in data/discrepancy_resolutions.json keyed by (agency, use case name) so they survive ETL re-runs."
      >
        <ResolutionForm
          auditId={audit.audit_id}
          agency={audit.agency_abbreviation ?? ""}
          name={audit.use_case_name ?? ""}
          resolvedAt={audit.resolved_at}
          resolutionNote={detail.resolution_note}
          resolutionReason={detail.resolution_reason}
          canWrite={canWrite}
          orderedAuditIds={orderedAuditIds}
        />
      </Section>

      {canWrite ? (
        <KeyboardShortcutHost
          auditId={audit.audit_id}
          agency={audit.agency_abbreviation ?? ""}
          name={audit.use_case_name ?? ""}
          resolved={audit.resolved_at != null}
          orderedAuditIds={orderedAuditIds}
        />
      ) : null}
    </div>
  );
}

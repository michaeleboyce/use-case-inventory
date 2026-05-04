/**
 * /discrepancies/[auditId] — drill-down for a single OMB↔DB match attempt.
 *
 * Renders the audit row metadata + a side-by-side diff over the 10
 * canonical fields. Drift fields are tinted; matched fields are quiet.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDiscrepancyDetail } from "@/lib/discrepancies";
import { Section, MonoChip } from "@/components/editorial";
import { DiscrepancySideBySide } from "@/components/discrepancy-side-by-side";

const STATUS_LABEL: Record<string, string> = {
  matched_exact: "Exact match",
  matched_fuzzy: "Fuzzy match",
  suggested_rename: "Suggested rename",
  omb_only: "OMB only (new in OMB)",
  db_only: "DB only (vanished from OMB)",
  duplicate_in_omb: "Duplicate in OMB",
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <Link
        href="/discrepancies"
        className="text-sm text-stone-600 hover:text-stone-900"
      >
        ← All discrepancies
      </Link>

      <header className="space-y-2">
        <p className="eyebrow !text-[var(--stamp)]">§ {statusLabel}</p>
        <h1 className="font-serif text-3xl font-medium leading-tight">
          {audit.use_case_name ?? "(unnamed use case)"}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
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
                className="text-stone-700 underline-offset-4 hover:underline"
              >
                Open use case →
              </Link>
            </>
          ) : null}
        </div>
      </header>

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
      </Section>
    </div>
  );
}

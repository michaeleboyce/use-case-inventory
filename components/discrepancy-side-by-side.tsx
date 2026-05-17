/**
 * Renders DB vs OMB values across the 10 canonical fields for one audit row.
 *
 * - Drift rows are tinted amber (existing behavior).
 * - For drifted text fields with content on both sides, word-level
 *   highlighting is layered into each cell: the DB cell shows deletions
 *   inline (the words OMB removed); the OMB cell shows insertions inline
 *   (the words OMB added).
 * - For short enum / boolean drifts (≤30 chars and ≤3 words on both sides),
 *   the diff collapses to a single "old → new" indicator that spans both
 *   value cells.
 * - A client-side toggle hides non-drifted rows when ≥3 fields drift.
 */
import type { DiscrepancyDetail } from "@/lib/types";
import { diffWords, type DiffSegment } from "@/lib/diff-words";
import { DriftToggleWrapper } from "./discrepancy-side-by-side-toggle";

const FIELD_LABEL: Record<string, string> = {
  stage_of_development: "Stage of development",
  is_high_impact: "High-impact?",
  is_withheld: "Withheld?",
  topic_area: "Topic area",
  ai_classification: "AI classification",
  vendor_name: "Vendor(s)",
  have_ato: "Has ATO?",
  has_pii: "Has PII?",
  has_custom_code: "Custom code?",
  bureau_component: "Bureau / component",
};

const FIELD_ORDER = [
  "stage_of_development",
  "is_high_impact",
  "is_withheld",
  "topic_area",
  "ai_classification",
  "vendor_name",
  "have_ato",
  "has_pii",
  "has_custom_code",
  "bureau_component",
];

function isShortEnum(s: string): boolean {
  if (s.length > 30) return false;
  const words = s.trim().split(/\s+/).filter(Boolean);
  return words.length <= 3;
}

function renderDeleteSide(segs: DiffSegment[]) {
  return segs.map((seg, i) => {
    if (seg.type === "insert") return null;
    if (seg.type === "delete") {
      return (
        <del
          key={i}
          className="bg-rose-50 text-rose-900 line-through decoration-rose-600/40"
        >
          {seg.text}
        </del>
      );
    }
    return <span key={i}>{seg.text}</span>;
  });
}

function renderInsertSide(segs: DiffSegment[]) {
  return segs.map((seg, i) => {
    if (seg.type === "delete") return null;
    if (seg.type === "insert") {
      return (
        <ins key={i} className="bg-emerald-50 text-emerald-900 no-underline">
          {seg.text}
        </ins>
      );
    }
    return <span key={i}>{seg.text}</span>;
  });
}

export function DiscrepancySideBySide({ detail }: { detail: DiscrepancyDetail }) {
  const driftFields = new Set(detail.drift.map((d) => d.field));
  const { db_row, omb_row } = detail;

  const rendered = FIELD_ORDER.map((f) => {
    const dbV = db_row?.[f] ?? null;
    const ombV = omb_row?.[f] ?? null;
    const drifted = driftFields.has(f);

    const bothHaveContent =
      typeof dbV === "string" && dbV.length > 0 && typeof ombV === "string" && ombV.length > 0;
    const enumDrift =
      drifted && bothHaveContent && isShortEnum(dbV) && isShortEnum(ombV);
    const wordDiff =
      drifted && bothHaveContent && !enumDrift ? diffWords(dbV, ombV) : null;

    const labelCell = (
      <td className="px-3 py-2 align-top text-stone-700">
        {FIELD_LABEL[f] ?? f}
        {drifted ? (
          <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900">
            drift
          </span>
        ) : null}
      </td>
    );

    return (
      <tr key={f} data-drift={drifted ? "1" : "0"} className={drifted ? "bg-amber-50" : ""}>
        {labelCell}
        {enumDrift ? (
          <td
            colSpan={2}
            className="whitespace-pre-wrap px-3 py-2 align-top text-sm"
          >
            <span className="text-rose-900 line-through decoration-rose-600/40">
              {dbV}
            </span>
            <span className="mx-2 text-stone-400">→</span>
            <span className="text-emerald-900">{ombV}</span>
          </td>
        ) : (
          <>
            <td className="whitespace-pre-wrap px-3 py-2 align-top">
              {wordDiff ? (
                renderDeleteSide(wordDiff)
              ) : dbV != null && dbV.length > 0 ? (
                dbV
              ) : (
                <span className="text-stone-400">(empty)</span>
              )}
            </td>
            <td className="whitespace-pre-wrap px-3 py-2 align-top">
              {wordDiff ? (
                renderInsertSide(wordDiff)
              ) : ombV != null && ombV.length > 0 ? (
                ombV
              ) : (
                <span className="text-stone-400">(empty)</span>
              )}
            </td>
          </>
        )}
      </tr>
    );
  });

  const driftCount = detail.drift.length;
  const nonDriftCount = FIELD_ORDER.length - driftFields.size;
  const defaultDriftOnly = driftCount >= 3;

  const scopeClass = `drift-toggle-scope${defaultDriftOnly ? " drift-only" : ""}`;

  return (
    <div className={`overflow-x-auto rounded border border-stone-200 ${scopeClass}`}>
      <style>{`
        .drift-toggle-scope.drift-only tr[data-drift="0"] { display: none; }
      `}</style>
      <table className="min-w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
          <tr>
            <th className="w-1/4 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span>Field</span>
                {nonDriftCount > 0 && driftCount > 0 ? (
                  <DriftToggleWrapper
                    defaultDriftOnly={defaultDriftOnly}
                    nonDriftCount={nonDriftCount}
                  />
                ) : null}
              </div>
            </th>
            <th className="w-3/8 px-3 py-2">DB (IFP)</th>
            <th className="w-3/8 px-3 py-2">OMB consolidated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rendered}
          {db_row == null && omb_row == null ? (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-stone-500">
                No row data available for this discrepancy.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

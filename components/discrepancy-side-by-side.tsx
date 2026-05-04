/**
 * Server component: renders DB vs OMB values across the 10 canonical fields
 * for one audit row. Drift rows are tinted amber so they're scannable at a
 * glance.
 */
import type { DiscrepancyDetail } from "@/lib/types";

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

export function DiscrepancySideBySide({ detail }: { detail: DiscrepancyDetail }) {
  const driftFields = new Set(detail.drift.map((d) => d.field));
  const { db_row, omb_row } = detail;

  return (
    <div className="overflow-x-auto rounded border border-stone-200">
      <table className="min-w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
          <tr>
            <th className="w-1/4 px-3 py-2">Field</th>
            <th className="w-3/8 px-3 py-2">DB (IFP)</th>
            <th className="w-3/8 px-3 py-2">OMB consolidated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {FIELD_ORDER.map((f) => {
            const dbV = db_row?.[f] ?? null;
            const ombV = omb_row?.[f] ?? null;
            const drifted = driftFields.has(f);
            return (
              <tr key={f} className={drifted ? "bg-amber-50" : ""}>
                <td className="px-3 py-2 align-top text-stone-700">
                  {FIELD_LABEL[f] ?? f}
                  {drifted ? (
                    <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900">
                      drift
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-pre-wrap px-3 py-2 align-top">
                  {dbV ?? <span className="text-stone-400">(empty)</span>}
                </td>
                <td className="whitespace-pre-wrap px-3 py-2 align-top">
                  {ombV ?? <span className="text-stone-400">(empty)</span>}
                </td>
              </tr>
            );
          })}
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

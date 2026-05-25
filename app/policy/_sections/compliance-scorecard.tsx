// app/policy/_sections/compliance-scorecard.tsx
// Compliance scorecard table — one row per agency, ✓ / — per artifact.
// Server component. The optional type filter is implemented via search params
// on the parent page if/when needed; v1 renders all agencies.

import type { AgencyCompliance } from "@/lib/types/policy";

interface Props {
  rows: AgencyCompliance[];
}

function yearCell(year: number | null): string {
  return year !== null ? String(year) : "—";
}

function caioCell(status: string | null): string {
  if (!status) return "—";
  if (status.startsWith("Named:")) {
    const name = status.split("Named:", 2)[1].split(";")[0].split("(")[0].trim();
    return name.length > 24 ? "designated" : name;
  }
  if (status.startsWith("Designated")) return "designated";
  return status.length > 24 ? "—" : status;
}

export function ComplianceScorecard({ rows }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Agency
            </th>
            <th className="py-1.5 px-1 text-center font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              M-25-21 Strategy
            </th>
            <th className="py-1.5 px-1 text-center font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              M-25-21 Plan
            </th>
            <th className="py-1.5 px-1 text-center font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Gen-AI
            </th>
            <th className="py-1.5 pl-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              CAIO
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.agency_abbr} className="border-b border-border/60">
              <td className="py-1 pr-3">
                <span className="font-mono text-[11px] font-bold">
                  {r.agency_abbr}
                </span>
                <span className="ml-2 text-foreground/55">{r.agency_name}</span>
              </td>
              <td className="py-1 px-1 text-center font-mono">
                {yearCell(r.ai_strategy_year)}
              </td>
              <td className="py-1 px-1 text-center font-mono">
                {yearCell(r.compliance_plan_year)}
              </td>
              <td className="py-1 px-1 text-center font-mono text-foreground/70">
                {yearCell(r.genai_policy_year)}
              </td>
              <td className="py-1 pl-3 text-foreground/70">{caioCell(r.caio_status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

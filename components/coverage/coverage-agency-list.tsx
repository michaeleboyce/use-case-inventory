/**
 * Server-rendered list of AgencyAtoRow items shown inside the expanded
 * panel on /fedramp/coverage/products. Each row represents an agency
 * that holds a FedRAMP authorization for this product but reports zero
 * AI use cases for it — the inverse drill of CoverageUseCaseList.
 */

import { MonoChip } from "@/components/editorial";
import type { AgencyAtoRow } from "@/lib/types";

export function CoverageAgencyList({
  rows,
  heading,
  emptyMessage = "No agencies with this authorization in our scope.",
}: {
  rows: AgencyAtoRow[];
  heading?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {heading ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {heading}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-2 pl-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li
            key={r.inventory_agency_id}
            className="border-l border-[var(--rule)] pl-3"
          >
            <div className="flex items-baseline gap-2">
              <MonoChip
                tone="ink"
                size="xs"
                href={`/agencies/${r.agency_abbreviation}`}
              >
                {r.agency_abbreviation}
              </MonoChip>
              <span className="font-display text-[0.95rem] italic leading-tight text-foreground">
                {r.agency_name}
              </span>
            </div>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {r.authorization_type ?? "ATO"}
              {r.ato_issuance_date ? (
                <> · issued {r.ato_issuance_date}</>
              ) : null}
              {" · "}<span className="text-foreground">0 use cases reported</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

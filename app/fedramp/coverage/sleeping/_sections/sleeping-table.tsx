"use client";

/**
 * Sleeping-authorizations table for /fedramp/coverage/sleeping. Each row
 * is a FedRAMP product with at least one lead user and at least one
 * sleeping authorizer; expand to see both groups side by side.
 *
 * The expansion content is pre-fetched server-side and threaded in via the
 * `_detail` field of each row, mirroring the pattern used by
 * `/fedramp/coverage/products` (where `_agencies` carries the row's
 * authorizing-non-user list).
 */

import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";
import { ExpandableCoverageTable } from "@/components/coverage/expandable-coverage-table";
import type {
  SleepingAuthorizationDetail,
  SleepingAuthorizationRow,
} from "@/lib/types";

export type SleepingTableRow = SleepingAuthorizationRow & {
  _detail: SleepingAuthorizationDetail;
};

function impactTone(level: string | null): "stamp" | "verified" | "ink" | "muted" {
  const v = (level ?? "").toLowerCase();
  if (v === "high") return "verified";
  if (v === "moderate") return "stamp";
  if (v === "low" || v === "li-saas") return "muted";
  return "ink";
}

const columnHelper = createColumnHelper<SleepingTableRow>();

export function SleepingTable({ rows }: { rows: SleepingTableRow[] }) {
  const columns = [
    columnHelper.display({
      id: "product",
      header: "FedRAMP offering",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <MonoChip
              href={`/fedramp/marketplace/products/${r.fedramp_id}`}
              tone="stamp"
              size="xs"
              title={`${r.csp} · ${r.cso}`}
            >
              {r.fedramp_id}
            </MonoChip>
            <span className="ml-2 text-[0.95rem] text-foreground">{r.cso}</span>
            <span className="ml-2 text-[0.85rem] text-muted-foreground">
              {r.csp}
            </span>
          </span>
        );
      },
    }),
    columnHelper.accessor("impact_level", {
      id: "impact",
      header: "Impact",
      cell: (info) => {
        const v = info.getValue();
        if (!v) {
          return (
            <span className="font-mono text-[10.5px] text-muted-foreground">
              —
            </span>
          );
        }
        return (
          <MonoChip tone={impactTone(v)} size="xs">
            {v}
          </MonoChip>
        );
      },
    }),
    columnHelper.accessor("lead_user_count", {
      id: "leads",
      header: "Lead users",
      cell: (info) => formatNumber(info.getValue()),
    }),
    columnHelper.accessor("sleeping_count", {
      id: "sleeping",
      header: "Sleeping",
      cell: (info) => (
        <span className="font-display italic text-foreground">
          {formatNumber(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("total_ato_count", {
      id: "atos",
      header: "Total ATOs",
      cell: (info) => formatNumber(info.getValue()),
    }),
  ] as Parameters<typeof ExpandableCoverageTable<SleepingTableRow>>[0]["columns"];

  return (
    <ExpandableCoverageTable<SleepingTableRow>
      rows={rows}
      columns={columns}
      getRowKey={(r) => r.fedramp_id}
      numericColumnIds={["leads", "sleeping", "atos"]}
      emptyMessage="No products match the current filter."
      renderExpanded={(r) => <ExpansionPanel detail={r._detail} cso={r.cso} />}
    />
  );
}

function ExpansionPanel({
  detail,
  cso,
}: {
  detail: SleepingAuthorizationDetail;
  cso: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)]">
          Lead users · using {cso} for AI
        </p>
        {detail.leadUsers.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            No lead users (shouldn&rsquo;t happen — every row should have ≥1).
          </p>
        ) : (
          <ul className="space-y-2 pl-4">
            {detail.leadUsers.map((u) => (
              <li
                key={u.inventory_agency_id}
                className="border-l border-[var(--rule)] pl-3"
              >
                <div className="flex items-baseline gap-2">
                  <MonoChip
                    tone="ink"
                    size="xs"
                    href={`/agencies/${u.agency_abbreviation}`}
                  >
                    {u.agency_abbreviation}
                  </MonoChip>
                  <span className="font-display text-[0.95rem] italic leading-tight text-foreground">
                    {u.agency_name}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {formatNumber(u.use_case_count)} use case
                  {u.use_case_count === 1 ? "" : "s"} reported
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Sleeping authorizers · ATO held, no AI use of {cso} reported
        </p>
        {detail.sleepingAuthorizers.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            None — every authorizer is a lead user.
          </p>
        ) : (
          <ul className="space-y-2 pl-4">
            {detail.sleepingAuthorizers.map((s) => (
              <li
                key={s.inventory_agency_id}
                className="border-l border-[var(--rule)] pl-3"
              >
                <div className="flex items-baseline gap-2">
                  <MonoChip
                    tone="ink"
                    size="xs"
                    href={`/agencies/${s.agency_abbreviation}`}
                  >
                    {s.agency_abbreviation}
                  </MonoChip>
                  <span className="font-display text-[0.95rem] italic leading-tight text-foreground">
                    {s.agency_name}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {s.authorization_type ?? "ATO"}
                  {s.ato_issuance_date ? <> · issued {s.ato_issuance_date}</> : null}
                  {s.maturity_tier ? (
                    <>
                      {" · "}
                      <span className="text-foreground">{s.maturity_tier}</span>
                    </>
                  ) : null}
                  {" · "}
                  <span className="text-foreground">
                    {formatNumber(s.total_ai_use_cases)} total AI use case
                    {s.total_ai_use_cases === 1 ? "" : "s"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

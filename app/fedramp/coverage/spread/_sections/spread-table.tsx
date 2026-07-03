"use client";

/**
 * Table for /fedramp/coverage/spread. One row per FedRAMP-Authorized core-AI
 * product with its spread signals: distinct ATO-holding agencies, the
 * marketplace reuse tally, and whether any inventory agency reports using it.
 * Expansion shows the ATO-holding agencies, mirroring the unlinked-AI table.
 */

import { createColumnHelper } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { formatNumber, formatDate } from "@/lib/formatting";
import { ExpandableCoverageTable } from "@/components/coverage/expandable-coverage-table";
import type { CoreAiSpreadRow, UnlinkedAiAtoAgencyRow } from "@/lib/types";

export type SpreadTableRow = CoreAiSpreadRow & {
  _agencies: UnlinkedAiAtoAgencyRow[];
};

const columnHelper = createColumnHelper<SpreadTableRow>();

export function SpreadTable({ rows }: { rows: SpreadTableRow[] }) {
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
            <span className="ml-2 text-[0.85rem] text-muted-foreground">{r.csp}</span>
          </span>
        );
      },
    }),
    columnHelper.accessor("auth_date", {
      id: "auth_date",
      header: "Authorized",
      cell: (info) => {
        const v = info.getValue();
        return (
          <span className="font-mono text-[11px] text-muted-foreground">
            {v ? formatDate(v) : "—"}
          </span>
        );
      },
    }),
    columnHelper.accessor("ato_count", {
      id: "atos",
      header: "Agencies w/ ATO",
      cell: (info) => (
        <span className="font-display italic tabular-nums text-foreground">
          {formatNumber(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("reuse_count", {
      id: "reuse",
      header: "Reuses",
      cell: (info) => {
        const v = info.getValue();
        return (
          <span
            className={`font-display italic tabular-nums ${v === 0 ? "text-muted-foreground" : "text-foreground"}`}
          >
            {formatNumber(v)}
          </span>
        );
      },
    }),
    columnHelper.accessor("reporting_agency_count", {
      id: "reported",
      header: "Agencies reporting use",
      cell: ({ row }) => {
        const r = row.original;
        if (!r.linked_to_inventory) {
          return (
            <MonoChip tone="muted" size="xs" title="Not linked to any curated inventory product">
              not in inventory
            </MonoChip>
          );
        }
        return (
          <span className="font-display italic tabular-nums text-foreground">
            {formatNumber(r.reporting_agency_count)}
          </span>
        );
      },
    }),
  ] as Parameters<typeof ExpandableCoverageTable<SpreadTableRow>>[0]["columns"];

  return (
    <ExpandableCoverageTable<SpreadTableRow>
      rows={rows}
      columns={columns}
      getRowKey={(r) => r.fedramp_id}
      numericColumnIds={["atos", "reuse", "reported"]}
      initialSorting={[{ id: "atos", desc: true }]}
      emptyMessage="No authorized core-AI products in this build."
      renderExpanded={(r) => <ExpansionPanel row={r} />}
    />
  );
}

function ExpansionPanel({ row }: { row: SpreadTableRow }) {
  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Agencies holding an ATO
      </p>
      {row._agencies.length === 0 ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          No agency ATO recorded on the marketplace ledger.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 pl-1 md:grid-cols-2">
          {row._agencies.map((a, i) => (
            <li
              key={`${a.inventory_agency_id ?? a.agency_name}-${i}`}
              className="border-l border-[var(--rule)] pl-3"
            >
              <div className="flex items-baseline gap-2">
                {a.agency_abbreviation ? (
                  <MonoChip tone="ink" size="xs" href={`/agencies/${a.agency_abbreviation}`}>
                    {a.agency_abbreviation}
                  </MonoChip>
                ) : null}
                <span className="font-display text-[0.95rem] italic leading-tight text-foreground">
                  {a.agency_name}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {a.authorization_type ?? "ATO"}
                {a.ato_issuance_date ? <> · issued {formatDate(a.ato_issuance_date)}</> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

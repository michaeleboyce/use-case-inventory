"use client";

/**
 * "Shelf inside the shelf" table for /fedramp/coverage/spread. One row per
 * (core-AI service × host package): the AI capability already in scope of
 * FedRAMP packages agencies hold ATOs for. Expansion shows the label
 * reasoning (with QC provenance) and the host package's ATO-holding
 * agencies. Copy guardrail: a service is "in scope of a package the agency
 * holds an ATO for" — never "enabled" or "available to staff".
 */

import { createColumnHelper } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { formatNumber, formatDate } from "@/lib/formatting";
import { ExpandableCoverageTable } from "@/components/coverage/expandable-coverage-table";
import type { AiServiceInScopeRow, UnlinkedAiAtoAgencyRow } from "@/lib/types";

export type ServiceInScopeTableRow = AiServiceInScopeRow & {
  _agencies: UnlinkedAiAtoAgencyRow[];
};

function impactTone(level: string | null): "stamp" | "verified" | "ink" | "muted" {
  const v = (level ?? "").toLowerCase();
  if (v === "high") return "verified";
  if (v === "moderate") return "stamp";
  if (v === "low" || v === "li-saas") return "muted";
  return "ink";
}

/** QC-provenance chip: frontier-reviewed labels read strong, raw llm recedes. */
function SourceChip({ source }: { source: string }) {
  const reviewed = source !== "llm";
  const label =
    source === "qc_confirmed"
      ? "QC confirmed"
      : source === "qc_corrected"
        ? "QC corrected"
        : source === "adjudicated"
          ? "Adjudicated"
          : source === "manual_override"
            ? "Manual"
            : "LLM";
  return (
    <MonoChip
      tone={reviewed ? "verified" : "muted"}
      size="xs"
      title={`Label provenance: ${source}`}
    >
      {label}
    </MonoChip>
  );
}

const columnHelper = createColumnHelper<ServiceInScopeTableRow>();

export function ServicesInScopeTable({ rows }: { rows: ServiceInScopeTableRow[] }) {
  const columns = [
    columnHelper.accessor("service", {
      id: "service",
      header: "Core-AI service in scope",
      cell: (info) => (
        <span className="text-[0.95rem] font-medium text-foreground">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: "host",
      header: "Host package",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <MonoChip
              href={`/fedramp/marketplace/products/${r.host_fedramp_id}`}
              tone="stamp"
              size="xs"
              title={`${r.csp} · ${r.cso}`}
            >
              {r.host_fedramp_id}
            </MonoChip>
            <span className="ml-2 text-[0.85rem] text-muted-foreground">{r.cso}</span>
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
          return <span className="font-mono text-[10.5px] text-muted-foreground">—</span>;
        }
        return (
          <MonoChip tone={impactTone(v)} size="xs">
            {v}
          </MonoChip>
        );
      },
    }),
    columnHelper.accessor("source", {
      id: "source",
      header: "Label",
      cell: (info) => <SourceChip source={info.getValue()} />,
    }),
    columnHelper.accessor("agencies_with_host_ato", {
      id: "agencies",
      header: "Agencies w/ host ATO",
      cell: (info) => (
        <span className="font-display italic tabular-nums text-foreground">
          {formatNumber(info.getValue())}
        </span>
      ),
    }),
  ] as Parameters<typeof ExpandableCoverageTable<ServiceInScopeTableRow>>[0]["columns"];

  return (
    <ExpandableCoverageTable<ServiceInScopeTableRow>
      rows={rows}
      columns={columns}
      getRowKey={(r) => `${r.service}::${r.host_fedramp_id}`}
      numericColumnIds={["agencies"]}
      initialSorting={[{ id: "agencies", desc: true }]}
      emptyMessage="No core-AI services in scope in this build."
      renderExpanded={(r) => <ExpansionPanel row={r} />}
    />
  );
}

function ExpansionPanel({ row }: { row: ServiceInScopeTableRow }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)]">
          Why it&rsquo;s classified core AI
        </p>
        <p className="max-w-prose text-[0.92rem] leading-[1.5] text-foreground/85">
          {row.reasoning}
        </p>
        <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
          Confidence {row.confidence} · scope recency: {row.recency === "last_90" ? "authorized within 90 days of snapshot" : "established"}
        </p>
      </div>

      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Agencies holding an ATO on the host package
        </p>
        {row._agencies.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            No mapped authorizing agencies.
          </p>
        ) : (
          <ul className="space-y-2 pl-1">
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
        <p className="mt-3 max-w-prose text-[0.8rem] italic leading-snug text-muted-foreground">
          Holding the host package&rsquo;s ATO means this service is in scope
          of an authorization the agency already has — it does not mean the
          agency has enabled it or made it available to staff.
        </p>
      </div>
    </div>
  );
}

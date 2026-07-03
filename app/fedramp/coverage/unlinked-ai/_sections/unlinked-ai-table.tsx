"use client";

/**
 * Table for /fedramp/coverage/unlinked-ai. Each row is a FedRAMP product an
 * independent LLM review judged to be an AI/ML offering, with NO link to any
 * curated inventory product — marketplace AI (authorized or in the pipeline;
 * see the Status column) absent from every agency use-case inventory.
 * Expand to read the classification reasoning, the
 * verbatim evidence signals, and the agencies that hold an ATO for it.
 *
 * Row-expansion detail (the ATO-holding agencies) is pre-fetched server-side
 * and threaded in via the `_agencies` field, mirroring the sleeping-table
 * pattern in /fedramp/coverage/sleeping.
 */

import { createColumnHelper } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { formatNumber, formatDate } from "@/lib/formatting";
import { ExpandableCoverageTable } from "@/components/coverage/expandable-coverage-table";
import type { UnlinkedAiAtoAgencyRow, UnlinkedAiProductRow } from "@/lib/types";

export type UnlinkedAiTableRow = UnlinkedAiProductRow & {
  _agencies: UnlinkedAiAtoAgencyRow[];
};

function impactTone(level: string | null): "stamp" | "verified" | "ink" | "muted" {
  const v = (level ?? "").toLowerCase();
  if (v === "high") return "verified";
  if (v === "moderate") return "stamp";
  if (v === "low" || v === "li-saas") return "muted";
  return "ink";
}

/** Compact status chip — Authorized reads strong, pipeline states recede. */
function StatusChip({ status }: { status: string }) {
  const authorized = status === "FedRAMP Authorized";
  const label = authorized
    ? "Authorized"
    : status === "FedRAMP Ready"
      ? "Ready"
      : "In Process";
  return (
    <MonoChip tone={authorized ? "verified" : "muted"} size="xs" title={status}>
      {label}
    </MonoChip>
  );
}

function CategoryChip({ category }: { category: UnlinkedAiProductRow["category"] }) {
  if (category === "core_ai") {
    return (
      <MonoChip tone="stamp" size="xs" title="Primary purpose is AI/ML">
        Core AI
      </MonoChip>
    );
  }
  return (
    <MonoChip tone="ink" size="xs" title="Ships material AI/ML capability as a feature">
      AI-featured
    </MonoChip>
  );
}

const columnHelper = createColumnHelper<UnlinkedAiTableRow>();

export function UnlinkedAiTable({ rows }: { rows: UnlinkedAiTableRow[] }) {
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
    columnHelper.accessor("category", {
      id: "category",
      header: "AI class",
      cell: (info) => <CategoryChip category={info.getValue()} />,
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: "Status",
      cell: (info) => <StatusChip status={info.getValue()} />,
    }),
    columnHelper.accessor("confidence", {
      id: "confidence",
      header: "Conf.",
      cell: (info) => (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          {info.getValue()}
        </span>
      ),
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
    columnHelper.accessor("ato_count", {
      id: "atos",
      header: "Agencies w/ ATO",
      cell: (info) => (
        <span className="font-display italic text-foreground">
          {formatNumber(info.getValue())}
        </span>
      ),
    }),
  ] as Parameters<typeof ExpandableCoverageTable<UnlinkedAiTableRow>>[0]["columns"];

  return (
    <ExpandableCoverageTable<UnlinkedAiTableRow>
      rows={rows}
      columns={columns}
      getRowKey={(r) => r.fedramp_id}
      numericColumnIds={["atos"]}
      initialSorting={[{ id: "atos", desc: true }]}
      emptyMessage="No unlinked AI products match the current filter."
      renderExpanded={(r) => <ExpansionPanel row={r} />}
    />
  );
}

function ExpansionPanel({ row }: { row: UnlinkedAiTableRow }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)]">
          Why it&rsquo;s classified AI
        </p>
        <p className="max-w-prose text-[0.92rem] leading-[1.5] text-foreground/85">
          {row.reasoning}
        </p>
        {row.signals.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Evidence · verbatim from the FedRAMP listing
            </p>
            <ul className="space-y-1">
              {row.signals.map((s, i) => (
                <li
                  key={i}
                  className="border-l border-[var(--rule)] pl-3 text-[12px] italic leading-snug text-foreground/80"
                >
                  &ldquo;{s}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Agencies holding an ATO · none report using it for AI
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
                    <MonoChip
                      tone="ink"
                      size="xs"
                      href={`/agencies/${a.agency_abbreviation}`}
                    >
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
    </div>
  );
}

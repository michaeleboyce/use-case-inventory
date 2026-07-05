"use client";

/**
 * V3 — the sleeping-services board. One row per mapped product, named
 * offerings before hyperscaler-catalog rows; expand for the per-agency
 * detail (lead users left, sleeping holders right, each sleeping holder
 * with its timing bucket + similar-deployed evidence).
 *
 * Rows carry stable anchors (#board-<slug>) so the frontier grid and the
 * funnel can deep-link into the table.
 */

import { createColumnHelper } from "@tanstack/react-table";
import { MonoChip } from "@/components/editorial";
import { formatDate, formatNumber } from "@/lib/formatting";
import { ExpandableCoverageTable } from "@/components/coverage/expandable-coverage-table";
import type { BoardRow, BoardAgencyDetail } from "../_shared";
import { CAPABILITY_LABELS, TIMING_LABELS } from "../_shared";

const columnHelper = createColumnHelper<BoardRow>();

export function SleepingServicesBoard({ rows }: { rows: BoardRow[] }) {
  const columns = [
    columnHelper.accessor("product", {
      id: "product",
      header: "Product / service",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span id={`board-${r.slug}`} className="scroll-mt-28">
            <span className="font-medium text-foreground">{r.product}</span>
            <span className="mt-0.5 block max-w-[26rem] truncate font-mono text-[10px] text-muted-foreground">
              {r.services.join(" · ")}
            </span>
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "capability",
      header: "Capability",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="inline-flex flex-wrap gap-1">
            <MonoChip tone={r.gen_ai ? "stamp" : "ink"} size="xs">
              {CAPABILITY_LABELS[r.capability_category]}
            </MonoChip>
            {r.confidence === "inferred" ? (
              <MonoChip tone="muted" size="xs" title="Service→product link is inferred (family/feature match), not exact">
                inferred
              </MonoChip>
            ) : null}
          </span>
        );
      },
    }),
    columnHelper.accessor((r) => r.leads.length, {
      id: "leads",
      header: "Lead users",
      cell: ({ row }) => {
        const leads = row.original.leads;
        const shown = leads.slice(0, 4);
        return (
          <span className="inline-flex flex-wrap items-center gap-1">
            {shown.map((d) => (
              <MonoChip key={d.agency_id} tone="verified" size="xs" title={d.agency_name}>
                {d.agency_abbr}
              </MonoChip>
            ))}
            {leads.length > shown.length ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                +{leads.length - shown.length}
              </span>
            ) : null}
          </span>
        );
      },
    }),
    columnHelper.accessor("sleeping_count", {
      id: "sleeping",
      header: "Sleeping",
      cell: ({ row }) => (
        <span className="font-display italic tabular-nums text-[1.05rem]">
          {formatNumber(row.original.sleeping_count)}
        </span>
      ),
    }),
    columnHelper.accessor("void_count", {
      id: "void",
      header: "Nothing similar",
      cell: ({ row }) => (
        <span className="font-mono tabular-nums text-[11px] text-[var(--stamp)]">
          {formatNumber(row.original.void_count)}
        </span>
      ),
    }),
    columnHelper.display({
      id: "split",
      header: "Lead / sleep / excluded",
      cell: ({ row }) => <SplitBar row={row.original} />,
    }),
  ] as Parameters<typeof ExpandableCoverageTable<BoardRow>>[0]["columns"];

  return (
    <ExpandableCoverageTable
      rows={rows}
      columns={columns}
      getRowKey={(r) => r.slug}
      numericColumnIds={["leads", "sleeping", "void"]}
      initialSorting={[]}
      renderExpanded={(r) => <ExpansionPanel row={r} />}
      emptyMessage="No services match the current filters."
    />
  );
}

/** One compact stacked bar per row: leads (ink) / sleeping (stamp) /
 *  timing-excluded (hatched gray), normalized to the row's own total so
 *  rows are comparable by proportion at a glance. */
function SplitBar({ row }: { row: BoardRow }) {
  const total = row.leads.length + row.sleeping_count + row.timing_excluded_count;
  if (total === 0) return null;
  const w = (n: number) => `${Math.max((n / total) * 100, n > 0 ? 4 : 0)}%`;
  return (
    <span className="flex h-2.5 w-28 overflow-hidden bg-muted/40" title={
      `${row.leads.length} lead · ${row.sleeping_count} sleeping · ${row.timing_excluded_count} timing-excluded`
    }>
      <span className="h-full bg-foreground/70" style={{ width: w(row.leads.length) }} />
      <span className="h-full bg-[var(--stamp)]/70" style={{ width: w(row.sleeping_count) }} />
      <span
        className="h-full bg-[repeating-linear-gradient(45deg,var(--border),var(--border)_2px,transparent_2px,transparent_4px)]"
        style={{ width: w(row.timing_excluded_count) }}
      />
    </span>
  );
}

function ExpansionPanel({ row }: { row: BoardRow }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--verified)]">
          Lead users ({row.leads.length})
        </p>
        <ul className="space-y-1.5">
          {row.leads.map((d) => (
            <li key={d.agency_id} className="border-l border-[var(--rule)] pl-2.5">
              <MonoChip href={`/fedramp/coverage/agencies/${d.agency_abbr}`} tone="ink" size="xs">
                {d.agency_abbr}
              </MonoChip>
              <span className="ml-2 font-display text-[0.92rem] italic text-foreground/85">
                {d.agency_name}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Sleeping holders ({row.sleeping.length})
        </p>
        <ul className="space-y-2">
          {row.sleeping.map((d) => (
            <SleepingHolder key={d.agency_id} d={d} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function SleepingHolder({ d }: { d: BoardAgencyDetail }) {
  return (
    <li
      className={`border-l border-[var(--rule)] pl-2.5 ${d.timing_excluded ? "opacity-45" : ""}`}
    >
      <MonoChip href={`/fedramp/coverage/agencies/${d.agency_abbr}`} tone="ink" size="xs">
        {d.agency_abbr}
      </MonoChip>
      <span className="ml-2 font-display text-[0.92rem] italic text-foreground/85">
        {d.agency_name}
      </span>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        first host ATO{" "}
        {d.first_ato_date ? formatDate(d.first_ato_date) : "unknown"} ·{" "}
        {TIMING_LABELS[d.timing_bucket]}
        {d.recency_last90 ? " · scope <90d" : ""}
        {d.timing_excluded ? " · excluded from counts" : ""}
      </p>
      <p className="mt-0.5 text-[0.8rem] leading-snug">
        {d.similar_deployed ? (
          <span className="text-muted-foreground">
            similar deployed: {d.similar_products.join(", ") || "yes"}
          </span>
        ) : (
          <span className="font-medium text-[var(--stamp)]">
            nothing similar deployed
          </span>
        )}
      </p>
    </li>
  );
}

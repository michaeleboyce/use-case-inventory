/**
 * Read-only browser for the FedRAMP link curation queue.
 *
 * The page lists pending queue rows grouped by vendor / reason / agency, with
 * a "Download CSV" button per group that calls the streaming export route.
 * The expected workflow is: download a vendor CSV, edit `decision` /
 * `decision_notes`, run `python scripts/import_fedramp_link_decisions.py
 * decisions.csv --apply`, re-link.
 *
 * Server Component. No client JS — the active group tab is a `?group=` search
 * param and switching is plain `<Link>` navigation. Not linked from the main
 * nav (deliberate; access via /fedramp/curate).
 */

import Link from "next/link";
import { getLinkQueueGroups } from "@/lib/db";
import { Section, MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";

export const metadata = {
  title: "FedRAMP curation queue · Federal AI Use Case Inventory",
  description:
    "Adjudicate ambiguous and unmatched inventory ↔ FedRAMP product / agency links. CSV in, CSV out — round-trip with the importer script.",
};

const GROUPS: Array<{
  key: "vendor" | "reason" | "agency";
  label: string;
  blurb: string;
}> = [
  {
    key: "vendor",
    label: "By vendor",
    blurb: "Product queue grouped by inventory vendor.",
  },
  {
    key: "reason",
    label: "By reason",
    blurb:
      "All pending rows grouped by why they were queued (multi_candidate / no_alias).",
  },
  {
    key: "agency",
    label: "By agency",
    blurb: "Agency-link queue, grouped by inventory abbreviation.",
  },
];

function isGroup(v: string | undefined): v is "vendor" | "reason" | "agency" {
  return v === "vendor" || v === "reason" || v === "agency";
}

function safeGroups(group: "vendor" | "reason" | "agency"): {
  rows: ReturnType<typeof getLinkQueueGroups>;
  error: string | null;
} {
  try {
    return { rows: getLinkQueueGroups(group), error: null };
  } catch (err) {
    return {
      rows: [],
      error:
        err instanceof Error
          ? err.message
          : "Unknown error reading the link-queue table.",
    };
  }
}

export default async function FedrampCuratePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const params = await searchParams;
  const group: "vendor" | "reason" | "agency" = isGroup(params.group)
    ? params.group
    : "vendor";

  const { rows, error } = safeGroups(group);
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const blurb = GROUPS.find((g) => g.key === group)?.blurb ?? "";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-12 md:px-8 md:py-16">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-10">
        <aside className="col-span-12 mb-6 md:col-span-3 md:mb-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--stamp)]">
            VII · Curation queue
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.4rem] leading-[0.95] tracking-[-0.02em] md:text-[3.2rem]">
            Adjudicate the link queue.
          </h1>
          <p className="mt-4 max-w-prose text-base text-muted-foreground md:text-lg">
            Pending inventory ↔ FedRAMP candidate matches that the heuristic
            seed couldn’t resolve unambiguously. Download a CSV per group, edit
            the <MonoChip size="xs">decision</MonoChip> column, and re-import
            with the script below.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <MonoChip size="xs" tone="stamp">
              {formatNumber(total)} pending
            </MonoChip>
            <span>·</span>
            <MonoChip size="xs">{rows.length} groups</MonoChip>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- */}
      {/* Group tabs                                                      */}
      {/* -------------------------------------------------------------- */}
      <nav
        aria-label="Group queue rows by"
        className="mt-10 flex flex-wrap items-center gap-2 border-b border-border"
      >
        {GROUPS.map((g) => {
          const active = g.key === group;
          return (
            <Link
              key={g.key}
              href={`/fedramp/curate?group=${g.key}`}
              aria-current={active ? "page" : undefined}
              className={
                "border-b-2 px-3 py-2 font-mono text-[12px] uppercase tracking-[0.06em] transition-colors " +
                (active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {g.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-3 text-sm text-muted-foreground">{blurb}</p>

      {/* -------------------------------------------------------------- */}
      {/* Groups table                                                    */}
      {/* -------------------------------------------------------------- */}
      <Section
        number="VII.1"
        title="Pending groups"
        lede="Each row is a downloadable adjudication batch. Total counts include only rows with status='pending'."
        className="mt-14"
      >
        {error ? (
          <div className="border border-border bg-background p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--stamp)]">
              Queue unavailable
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Run <MonoChip size="xs">make fedramp</MonoChip> in the inventory
              repo to populate the queue.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-border bg-background p-6">
            <p className="text-sm text-muted-foreground">
              No pending rows in this grouping. Either the queue is empty or
              every row has been resolved.
            </p>
          </div>
        ) : (
          <div className="border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    {group === "reason" ? "Reason" : group === "agency" ? "Agency" : "Vendor"}
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Pending rows
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    CSV
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const href = `/api/fedramp-queue-export?group=${encodeURIComponent(
                    group,
                  )}&value=${encodeURIComponent(r.key)}`;
                  return (
                    <tr key={r.key} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 align-top">
                        <span className="font-medium">{r.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right align-top font-mono">
                        {formatNumber(r.count)}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <a
                          href={href}
                          className="inline-flex items-center border border-border bg-background px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-foreground hover:border-foreground"
                        >
                          Download CSV
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* -------------------------------------------------------------- */}
      {/* Round-trip workflow                                             */}
      {/* -------------------------------------------------------------- */}
      <Section
        number="VII.2"
        title="Round-trip workflow"
        lede="The CSV the dashboard streams here and the CSV the Python exporter writes are byte-compatible — edit either and feed it back through the importer."
        className="mt-16"
      >
        <ol className="list-decimal space-y-3 pl-6 text-sm text-muted-foreground marker:text-foreground">
          <li>
            Click <strong className="text-foreground">Download CSV</strong> for
            a vendor / reason / agency group above. Save it locally.
          </li>
          <li>
            For each row, fill the{" "}
            <MonoChip size="xs">decision</MonoChip> column with one of:{" "}
            <MonoChip size="xs">accept_1</MonoChip> …{" "}
            <MonoChip size="xs">accept_5</MonoChip>,{" "}
            <MonoChip size="xs">reject</MonoChip>, or{" "}
            <MonoChip size="xs">custom:&lt;fedramp_id&gt;</MonoChip>. Blank
            rows are skipped.
          </li>
          <li>
            Run the importer (defaults to dry-run; pass{" "}
            <MonoChip size="xs">--apply</MonoChip> to write):
          </li>
        </ol>
        <pre className="mt-6 overflow-x-auto border border-border bg-muted/30 p-4 font-mono text-[12px] leading-relaxed">
          {`# from 2025-aia-use-case-inventory/
python scripts/import_fedramp_link_decisions.py path/to/decisions.csv
python scripts/import_fedramp_link_decisions.py path/to/decisions.csv --apply
`}
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          Imports run inside a single transaction — any malformed row rolls the
          whole batch back. Manual decisions are written with{" "}
          <MonoChip size="xs">source=manual_csv</MonoChip> and survive future
          re-runs of <MonoChip size="xs">link_fedramp.py</MonoChip>.
        </p>
      </Section>
    </div>
  );
}

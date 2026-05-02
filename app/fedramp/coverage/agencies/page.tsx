import Link from "next/link";
import {
  getCoverageAgencyRows,
  getFedrampSnapshot,
} from "@/lib/db";
import type { CoverageAgencyRow, FedrampSnapshot } from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section, MonoChip } from "@/components/editorial";

export const metadata = {
  title: "Agency gap analysis · FedRAMP × AI Inventory",
  description:
    "Per-agency view of authorized FedRAMP products vs. what each agency reports in its 2025 inventory. Sorted by largest gap.",
};

function safeRows(): { rows: CoverageAgencyRow[]; error: string | null } {
  try {
    return { rows: getCoverageAgencyRows(), error: null };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

function safeSnapshot(): FedrampSnapshot | null {
  try {
    return getFedrampSnapshot();
  } catch {
    return null;
  }
}

export default function FedrampCoverageAgenciesPage() {
  const { rows, error } = safeRows();
  const snapshot = safeSnapshot();

  // Sort by gap (authorized_but_unreported) desc; secondary sort on
  // authorized_count desc.
  const ranked = rows
    .slice()
    .sort((a, b) => {
      if (b.authorized_but_unreported !== a.authorized_but_unreported) {
        return b.authorized_but_unreported - a.authorized_but_unreported;
      }
      return b.fedramp_authorized_count - a.fedramp_authorized_count;
    });

  const agenciesWithGap = ranked.filter((r) => r.authorized_but_unreported > 0).length;
  const totalGap = ranked.reduce((acc, r) => acc + r.authorized_but_unreported, 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">Panel 3</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Agency gaps
            </div>
            <Link
              href="/fedramp/coverage"
              className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
            >
              ← Coverage hub
            </Link>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            Are agencies sitting on{" "}
            <em className="italic">authorized AI tools</em> they aren&rsquo;t
            reporting?
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            <span className="font-medium text-foreground">
              {formatNumber(agenciesWithGap)}
            </span>{" "}
            agencies hold FedRAMP ATOs for AI-linked products (the subset of
            FedRAMP marketplace listings tied to a curated AI use-case) that
            never surface in their 2025 inventory submission — a combined{" "}
            <span className="font-medium">
              {formatNumber(totalGap)}
            </span>{" "}
            authorization-without-mention pairs. AI scope is defined by{" "}
            <code className="font-mono text-[12px]">fedramp_product_links</code>;
            an agency&rsquo;s broader ATO portfolio is intentionally not
            counted here. Click any row to drill into specifics.
          </p>
        </div>
      </header>

      {error ? (
        <Section number="I" title="No data" lede="The FedRAMP tables aren&rsquo;t loaded.">
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Run <code className="font-mono text-foreground">make fedramp</code>{" "}
            to seed the FedRAMP tables. Detail:{" "}
            <span className="font-mono text-[11px]">{error}</span>
          </p>
        </Section>
      ) : ranked.length === 0 ? (
        <Section
          number="I"
          title="No agencies"
          lede="No reporting agencies returned in the dataset."
        >
          <p className="border-t-2 border-foreground pt-4 text-sm text-muted-foreground">
            The agency rollup query returned an empty result.
          </p>
        </Section>
      ) : (
        <Section
          number="I"
          title="Per-agency rollup"
          lede="Sorted by largest authorized-but-unreported gap. Use cases include both individual and consolidated entries."
        >
          <div className="overflow-x-auto border-t-2 border-foreground">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th>#</Th>
                  <Th>Agency</Th>
                  <Th align="left">Name</Th>
                  <Th align="right">Use cases</Th>
                  <Th align="right">AI products in ATO scope</Th>
                  <Th align="right">Reported (matched)</Th>
                  <Th align="right">Gap</Th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, i) => {
                  const href = `/fedramp/coverage/agencies/${row.agency_abbreviation}`;
                  const isGap = row.authorized_but_unreported > 0;
                  return (
                    <tr
                      key={row.inventory_agency_id}
                      className="border-b border-border/60 hover:bg-muted/30"
                    >
                      <td className="px-2 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-2 py-2">
                        <MonoChip href={href} tone="stamp" size="xs">
                          {row.agency_abbreviation}
                        </MonoChip>
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={href}
                          className="text-foreground hover:text-[var(--stamp)]"
                        >
                          {row.agency_name}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatNumber(row.use_case_count)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {row.fedramp_authorized_count > 0
                          ? formatNumber(row.fedramp_authorized_count)
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {row.fedramp_used_count > 0
                          ? formatNumber(row.fedramp_used_count)
                          : "—"}
                      </td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums ${
                          isGap
                            ? "font-medium text-[var(--stamp)]"
                            : "text-muted-foreground"
                        }`}
                      >
                        {isGap ? formatNumber(row.authorized_but_unreported) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Source: <span className="text-foreground">agencies</span> ⨝{" "}
            <span className="text-foreground">fedramp_agency_links</span> ⨝{" "}
            <span className="text-foreground">fedramp_authorizations</span>.
            &ldquo;Gap&rdquo; is{" "}
            <span className="text-foreground">authorized − reported</span>{" "}
            (clamped at zero).
          </p>
        </Section>
      )}

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function SnapshotFooter({ snapshot }: { snapshot: FedrampSnapshot | null }) {
  if (!snapshot) {
    return (
      <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        FedRAMP snapshot · unavailable
      </p>
    );
  }
  return (
    <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      FedRAMP snapshot ·{" "}
      {snapshot.snapshot_date
        ? `data as of ${formatDate(snapshot.snapshot_date)}`
        : "date unknown"}{" "}
      · {formatNumber(snapshot.agency_count)} agencies ·{" "}
      {formatNumber(snapshot.ato_event_count)} authorizations
    </p>
  );
}

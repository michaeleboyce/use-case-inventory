import Link from "next/link";
import {
  getCoverageHubStats,
  getFedrampSnapshot,
} from "@/lib/db";
import type { CoverageStat, FedrampSnapshot } from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section } from "@/components/editorial";

export const metadata = {
  title: "FedRAMP coverage · Federal AI Use Case Inventory",
  description:
    "Cross-reference between the federal AI use-case inventory and the FedRAMP marketplace: vendor coverage, authorization fit, agency gaps, and unused authorized products.",
};

// Defensive wrapper — the FedRAMP tables may not yet have been loaded into
// the inventory DB by `make fedramp`. Keep the hub renderable even if the
// underlying queries throw.
function safeStats(): { stats: CoverageStat[]; error: string | null } {
  try {
    return { stats: getCoverageHubStats(), error: null };
  } catch (err) {
    return {
      stats: [],
      error:
        err instanceof Error
          ? err.message
          : "Unknown error reading FedRAMP coverage tables.",
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

const PANEL_HREF: Record<string, string> = {
  matched: "/fedramp/coverage/vendors",
  mismatched: "/fedramp/coverage/fit",
  agencies_with_gaps: "/fedramp/coverage/agencies",
  unused_products: "/fedramp/coverage/products",
};

export default function FedrampCoverageHubPage() {
  const { stats, error } = safeStats();
  const snapshot = safeSnapshot();

  // Pull the real stat cards (snapshot_date is metadata, not a card).
  const cards = stats.filter((s) => s.key !== "snapshot_date");

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      {/* ------------------------------------------------------------ */}
      {/* HERO                                                          */}
      {/* ------------------------------------------------------------ */}
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-4">
            <div>
              <div className="eyebrow mb-1.5 !text-[var(--stamp)]">
                Cross-Reference
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Inventory × FedRAMP
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Coverage analysis
              </div>
            </div>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            <em className="inline font-normal italic">Where</em> the use-case
            inventory and the FedRAMP marketplace
            <br />
            <span className="relative inline-block">
              <span
                aria-hidden
                className="absolute inset-x-[-0.06em] bottom-[0.16em] h-[0.34em] bg-[var(--highlight)]/90"
              />
              <span className="relative">agree, and where they don&rsquo;t.</span>
            </span>
          </h1>

          <p className="mt-8 max-w-prose text-[1.05rem] leading-[1.55] text-foreground/85">
            Four policy questions structure this view:{" "}
            <span className="font-medium text-foreground">
              what share of commercial AI products in the inventory carry a
              FedRAMP authorization
            </span>
            ; when matched, whether the impact level fits the rights- and
            safety-impacting use the agency reports; how concentrated the
            high-impact authorizations are; and whether agencies are sitting on
            FedRAMP-authorized AI tools they aren&rsquo;t reporting in their
            inventories at all.
          </p>
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      {/* § I — STAT CARDS                                              */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="I"
        title="The four panels"
        lede="Each card opens a drill-down. All counts are computed from the most recent FedRAMP snapshot joined against the 2025 inventory."
      >
        {error ? (
          <div className="border-t-2 border-foreground pt-4">
            <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--stamp)]">
              FedRAMP data not yet loaded
            </p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
              The FedRAMP marketplace tables aren&rsquo;t present in this
              build of the inventory database. Run{" "}
              <code className="font-mono text-foreground">make fedramp</code>{" "}
              to seed them. Detail:{" "}
              <span className="font-mono text-[11px]">{error}</span>
            </p>
          </div>
        ) : cards.length === 0 ? (
          <p className="border-t-2 border-foreground pt-4 text-sm text-muted-foreground">
            No coverage statistics available.
          </p>
        ) : (
          <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
            {cards.map((s) => (
              <StatCard
                key={s.key}
                stat={s}
                href={PANEL_HREF[s.key] ?? "/fedramp/coverage"}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § II — METHOD                                                 */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="II"
        title="How matches are made"
        lede="A heuristic seed plus manually curated decisions; never an LLM in V1."
      >
        <div className="space-y-4 max-w-prose text-[0.95rem] leading-[1.55] text-foreground/85">
          <p>
            The inventory&rsquo;s 138 curated AI products are matched against
            FedRAMP&rsquo;s product catalog by normalizing each side&rsquo;s
            vendor and offering names, then cross-referencing the
            inventory&rsquo;s 285-row alias table. Strong (vendor + offering)
            matches resolve directly. Ambiguous matches land in a review queue
            adjudicated externally and re-imported. Agency matches use the same
            machinery against FedRAMP&rsquo;s authorizing-agency list.
          </p>
          <p className="text-muted-foreground">
            This page reads no FedRAMP data not present in the inventory
            database; the FedRAMP marketplace ETL pipeline is upstream and
            denormalizes into a single SQLite file at build time.
          </p>
        </div>
      </Section>

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatCard({ stat, href }: { stat: CoverageStat; href: string }) {
  const denom = stat.denominator ?? null;
  const valueText = formatNumber(stat.value);
  const denomText = denom != null ? `of ${formatNumber(denom)}` : null;

  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-2 border-t-2 border-foreground pt-3 transition-colors hover:bg-muted/30"
    >
      <div className="eyebrow">{stat.label}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[2.6rem] italic leading-[0.95] tracking-[-0.02em] tabular-nums text-foreground transition-colors group-hover:text-[var(--stamp)]">
          {valueText}
        </span>
        {denomText ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {denomText}
          </span>
        ) : null}
      </div>
      {stat.description ? (
        <p className="max-w-[36ch] text-[0.9rem] leading-snug text-muted-foreground">
          {stat.description}
        </p>
      ) : null}
      <span className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--stamp)] opacity-0 transition-opacity group-hover:opacity-100">
        Open drill-down →
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------

function SnapshotFooter({ snapshot }: { snapshot: FedrampSnapshot | null }) {
  if (!snapshot) {
    return (
      <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        FedRAMP snapshot · unavailable
      </p>
    );
  }
  const parts = [
    snapshot.snapshot_date
      ? `data as of ${formatDate(snapshot.snapshot_date)}`
      : null,
    snapshot.product_count
      ? `${formatNumber(snapshot.product_count)} products`
      : null,
    snapshot.ato_event_count
      ? `${formatNumber(snapshot.ato_event_count)} authorizations`
      : null,
    snapshot.agency_count
      ? `${formatNumber(snapshot.agency_count)} agencies`
      : null,
    snapshot.csp_count
      ? `${formatNumber(snapshot.csp_count)} CSPs`
      : null,
  ].filter(Boolean);
  return (
    <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      FedRAMP snapshot · {parts.join(" · ")}
    </p>
  );
}

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
    "Two boards. AI → FedRAMP: which AI products in the inventory carry a FedRAMP authorization, and where impact-level fit looks off. FedRAMP → AI: which FedRAMP-authorized products appear in zero inventory use cases.",
};

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

/** Map raw stat key → which board the card belongs to. */
const BOARD_OF: Record<string, "ai_to_fedramp" | "fedramp_to_ai" | "agencies"> = {
  matched: "ai_to_fedramp",
  mismatched: "ai_to_fedramp",
  unused_products: "fedramp_to_ai",
  sleeping_authorizations: "fedramp_to_ai",
  unlinked_ai: "fedramp_to_ai",
  agencies_with_gaps: "agencies",
};

const PANEL_HREF: Record<string, string> = {
  matched: "/fedramp/coverage/vendors",
  mismatched: "/fedramp/coverage/fit",
  agencies_with_gaps: "/fedramp/coverage/agencies",
  unused_products: "/fedramp/coverage/products",
  sleeping_authorizations: "/fedramp/coverage/sleeping",
  unlinked_ai: "/fedramp/coverage/unlinked-ai",
};

const PANEL_LABEL_OVERRIDE: Record<string, string> = {
  matched: "AI products matched to FedRAMP",
  mismatched: "Use cases on questionable impact level",
  unused_products: "FedRAMP products with zero inventory mentions",
  agencies_with_gaps: "Agencies with a FedRAMP × inventory delta",
  unlinked_ai: "FedRAMP AI products absent from the inventory",
};

// The four drill-down panels reachable from this hub. Mirrored in the
// FedRAMP top-nav dropdown so users can jump to a panel from anywhere; the
// strip below the page header keeps them visible the moment you land here
// (without relying on a stat-card click). When a new panel is added under
// `app/fedramp/coverage/`, add it to both this list and the FEDRAMP_SECTIONS
// array in components/navigation.tsx — see AGENTS.md "Navigation
// discoverability".
const COVERAGE_PANELS: Array<{ href: string; label: string }> = [
  { href: "/fedramp/coverage/vendors", label: "Vendor coverage" },
  { href: "/fedramp/coverage/products", label: "Unused authorizations" },
  { href: "/fedramp/coverage/sleeping", label: "Sleeping authorizations" },
  { href: "/fedramp/coverage/unlinked-ai", label: "Unlinked AI products" },
  { href: "/fedramp/coverage/fit", label: "Authorization fit" },
  { href: "/fedramp/coverage/agencies", label: "Agency gaps" },
];

export default function FedrampCoverageHubPage() {
  const { stats, error } = safeStats();
  const snapshot = safeSnapshot();

  const cards = stats.filter((s) => s.key !== "snapshot_date");
  const aiToFedramp = cards.filter((s) => BOARD_OF[s.key] === "ai_to_fedramp");
  const fedrampToAi = cards.filter((s) => BOARD_OF[s.key] === "fedramp_to_ai");
  const agencyCards = cards.filter((s) => BOARD_OF[s.key] === "agencies");

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
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
            Two boards. The first asks{" "}
            <span className="font-medium text-foreground">
              which AI products in the inventory carry a FedRAMP authorization
            </span>
            , and when matched, whether the impact level fits the rights- or
            safety-impacting use the agency reports. The second flips the
            question:{" "}
            <span className="font-medium text-foreground">
              which FedRAMP-authorized AI products appear in zero inventory
              use cases
            </span>{" "}
            — agencies sitting on capability they aren&rsquo;t reporting, or a
            curation gap. Every card opens a drill-down where rows expand to
            show the actual use cases (or agencies) involved.
          </p>
        </div>
      </header>

      <nav
        aria-label="Coverage panels"
        className="mt-8 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-border pb-3 text-[11px]"
      >
        <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground/70">
          Panels ·
        </span>
        {COVERAGE_PANELS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="font-mono uppercase tracking-[0.12em] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <Section
          number="I"
          title="FedRAMP data not yet loaded"
          lede="Without the FedRAMP tables in the inventory DB, no coverage views can render."
        >
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Run <code className="font-mono text-foreground">make fedramp</code>{" "}
            to seed the FedRAMP marketplace tables. Detail:{" "}
            <span className="font-mono text-[11px]">{error}</span>
          </p>
        </Section>
      ) : cards.length === 0 ? (
        <Section number="I" title="Empty" lede="No coverage statistics available.">
          <p className="border-t-2 border-foreground pt-4 text-sm text-muted-foreground">
            The hub query returned no cards.
          </p>
        </Section>
      ) : (
        <>
          <Section
            number="I"
            title="AI → FedRAMP"
            lede="The inventory side of the question: of the AI products agencies report using, which carry a FedRAMP authorization, and at what impact level."
          >
            <div className="border-t-2 border-foreground pt-4 grid gap-x-6 gap-y-6 md:grid-cols-2">
              {aiToFedramp.map((s) => (
                <StatCard
                  key={s.key}
                  stat={s}
                  href={PANEL_HREF[s.key] ?? "/fedramp/coverage"}
                  labelOverride={PANEL_LABEL_OVERRIDE[s.key]}
                />
              ))}
            </div>
          </Section>

          <Section
            number="II"
            title="FedRAMP → AI"
            lede="The marketplace side: of the FedRAMP-authorized AI products our catalog can map, which appear in zero 2025 use cases."
          >
            <div className="border-t-2 border-foreground pt-4 grid gap-x-6 gap-y-6 md:grid-cols-2">
              {fedrampToAi.map((s) => (
                <StatCard
                  key={s.key}
                  stat={s}
                  href={PANEL_HREF[s.key] ?? "/fedramp/coverage"}
                  labelOverride={PANEL_LABEL_OVERRIDE[s.key]}
                />
              ))}
            </div>
          </Section>

          {agencyCards.length > 0 ? (
            <Section
              number="III"
              title="Per-agency rollup"
              lede="Both directions, one row per agency. Click an agency for its specific authorized-but-unreported list and its mentioned-without-ATO list, each row expandable to the actual use cases."
            >
              <div className="border-t-2 border-foreground pt-4 grid gap-x-6 gap-y-6 md:grid-cols-2">
                {agencyCards.map((s) => (
                  <StatCard
                    key={s.key}
                    stat={s}
                    href={PANEL_HREF[s.key] ?? "/fedramp/coverage"}
                    labelOverride={PANEL_LABEL_OVERRIDE[s.key]}
                  />
                ))}
              </div>
            </Section>
          ) : null}

          <Section
            number="IV"
            title="How matches are made"
            lede="Heuristic seed plus manually curated decisions; never an LLM in V1."
          >
            <div className="space-y-4 max-w-prose text-[0.95rem] leading-[1.55] text-foreground/85">
              <p>
                The inventory&rsquo;s curated AI products are matched against
                FedRAMP&rsquo;s product catalog by normalizing each side&rsquo;s
                vendor and offering names, then cross-referencing the
                inventory&rsquo;s alias table. Strong (vendor + offering)
                matches resolve directly. Ambiguous matches land in a review
                queue adjudicated externally and re-imported. Agency matches
                use the same machinery against FedRAMP&rsquo;s authorizing-
                agency list.
              </p>
              <p className="text-muted-foreground">
                This page reads no FedRAMP data not present in the inventory
                database; the FedRAMP marketplace ETL pipeline is upstream and
                denormalizes into a single SQLite file at build time.
              </p>
            </div>
          </Section>
        </>
      )}

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function StatCard({
  stat,
  href,
  labelOverride,
}: {
  stat: CoverageStat;
  href: string;
  labelOverride?: string;
}) {
  const denom = stat.denominator ?? null;
  const valueText = formatNumber(stat.value);
  const denomText = denom != null ? `of ${formatNumber(denom)}` : null;
  const label = labelOverride ?? stat.label;

  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-2 border-t-2 border-foreground pt-3 transition-colors hover:bg-muted/30"
    >
      <div className="eyebrow">{label}</div>
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

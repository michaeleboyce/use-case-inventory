import Link from "next/link";
import {
  getCoverageAgencyRows,
  getFedrampSnapshot,
  getFrontierReachByAgency,
  getAgencyAccessTiers,
  type AgencyAccessTier,
} from "@/lib/db";
import type {
  CoverageAgencyRow,
  FedrampSnapshot,
  FrontierReachAgencyRow,
} from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section, MonoChip } from "@/components/editorial";
import { EmptyState } from "@/components/empty-state";
import { AgenciesCoverageTable } from "./_sections/agencies-table";

// Availability tiers, least-available first — the sort puts high-reach /
// low-access agencies (the article's laggard cases) at the top.
const TIER_ORDER: Record<string, number> = {
  none: 0,
  latent: 1,
  unknown: 2,
  pilot: 3,
  partial: 4,
  most: 5,
  all: 6,
};

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
          <EmptyState
            variant="boxed"
            message="The agency rollup query returned an empty result."
          />
        </Section>
      ) : (
        <Section
          number="I"
          title="Per-agency rollup"
          lede="Sorted by largest authorized-but-unreported gap. Use cases include both individual and consolidated entries. Search to narrow."
        >
          <AgenciesCoverageTable rows={ranked} />
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

      <FrontierReachSection />

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

/**
 * § II — the reach-vs-access cross-reference. One row per agency holding an
 * ATO on at least one package whose scope catalog contains a core-AI service
 * (Bedrock, Azure OpenAI, …), joined to IFP's web-corroborated estimate of
 * how widely staff can actually use a general-purpose AI tool. The gap
 * between the two columns is article beat 4: frontier capability was legally
 * in reach at agencies where employees have little or nothing.
 */
function FrontierReachSection() {
  let reach: FrontierReachAgencyRow[] = [];
  let tiers: Record<string, AgencyAccessTier> = {};
  try {
    reach = getFrontierReachByAgency();
    tiers = getAgencyAccessTiers();
  } catch {
    return null;
  }
  if (reach.length === 0) return null;

  const rows = reach
    .map((r) => ({ ...r, _access: tiers[r.agency_abbreviation] ?? null }))
    .sort((a, b) => {
      if (b.core_ai_services_in_reach !== a.core_ai_services_in_reach) {
        return b.core_ai_services_in_reach - a.core_ai_services_in_reach;
      }
      const ta = a._access ? (TIER_ORDER[a._access.tier] ?? 2) : 2;
      const tb = b._access ? (TIER_ORDER[b._access.tier] ?? 2) : 2;
      return ta - tb;
    });

  return (
    <Section
      number="II"
      title="Frontier capability in reach vs. staff access"
      source="mixed"
      lede="Agencies holding an ATO on at least one package whose scope catalog contains a core-AI service, against IFP's estimate of how widely staff can actually use a general-purpose AI tool. In scope of an authorization the agency already holds — not evidence the agency enabled anything. IFP access estimates are web-corroborated assessments, not OMB data."
    >
      <table className="w-full border-t-2 border-foreground text-sm">
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="py-2 pr-4">Agency</th>
            <th className="py-2 pr-4 text-right">Core-AI services in reach</th>
            <th className="py-2 pr-4 text-right">Host packages</th>
            <th className="py-2">IFP staff-access estimate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((r) => (
            <tr key={r.inventory_agency_id} className="hover:bg-muted/30">
              <td className="py-2.5 pr-4">
                <MonoChip
                  href={`/fedramp/coverage/agencies/${r.agency_abbreviation}`}
                  tone="ink"
                  size="xs"
                >
                  {r.agency_abbreviation}
                </MonoChip>
                <span className="ml-2 text-[0.9rem] text-foreground">
                  {r.agency_name}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-right font-display italic tabular-nums text-foreground">
                {formatNumber(r.core_ai_services_in_reach)}
              </td>
              <td className="py-2.5 pr-4 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatNumber(r.host_packages)}
              </td>
              <td className="py-2.5">
                {r._access ? (
                  <span className="text-foreground/85">
                    <span
                      className={`font-medium ${
                        (TIER_ORDER[r._access.tier] ?? 2) <= 1
                          ? "text-[var(--stamp)]"
                          : "text-foreground"
                      }`}
                    >
                      {r._access.tier}
                    </span>
                    {r._access.share != null ? (
                      <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                        ~{Math.round(r._access.share * 100)}% of eligible staff
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    no assessment
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 max-w-prose font-mono text-[11px] text-muted-foreground">
        Reach: services-in-scope catalogs ⨝ per-service AI classification
        (frontier-QC&rsquo;d) ⨝ agency ATO holdings. Access: IFP
        web-corroborated availability tier (best across tools), share shown
        where a corroborated estimate exists. Full service detail:{" "}
        <Link
          href="/fedramp/coverage/spread#services"
          className="text-foreground hover:text-[var(--stamp)] underline-offset-2 hover:underline"
        >
          the shelf inside the shelf
        </Link>
        .
      </p>
    </Section>
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

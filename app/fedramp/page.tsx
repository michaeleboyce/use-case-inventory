/**
 * §VII landing. Leads with the AI story — how much of the FedRAMP marketplace
 * is AI, and how much of that AI is authorized but absent from agency
 * inventories — then the two sub-area nav cards (Marketplace / Coverage).
 *
 * The AI band is gated on hasAiClassification() so a DB build predating the
 * classification pass degrades to just the nav cards.
 */

import Link from "next/link";
import { Eyebrow, Section, Figure, MonoChip } from "@/components/editorial";
import {
  getFedrampSnapshot,
  hasAiClassification,
  getAiClassificationCounts,
  getAiClassificationByImpactLevel,
  getUnlinkedAiByAgency,
} from "@/lib/db";
import { formatNumber } from "@/lib/formatting";
import { DonutChart } from "@/components/charts/donut-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";

export const metadata = {
  title: "FedRAMP · Federal AI Use Case Inventory",
};

const COMPOSITION_COLORS: Record<string, string> = {
  core_ai: "#10b981",
  ai_featured: "#3b82f6",
  not_ai: "#cbd5e1",
};
const COMPOSITION_LABELS: Record<string, string> = {
  core_ai: "Core AI",
  ai_featured: "AI-featured",
  not_ai: "Not AI",
};
const IMPACT_COLORS: Record<string, string> = {
  High: "#10b981",
  Moderate: "#3b82f6",
  Low: "#64748b",
  "Li-SaaS": "#94a3b8",
  Unspecified: "#cbd5e1",
};

export default function FedrampLandingPage() {
  const snapshot = getFedrampSnapshot();
  const hasAi = hasAiClassification();
  const counts = hasAi ? getAiClassificationCounts() : null;
  const byAgency = hasAi ? getUnlinkedAiByAgency(10) : [];
  const byImpact = hasAi ? getAiClassificationByImpactLevel() : [];

  const totalAi = counts ? counts.core_ai + counts.ai_featured : 0;
  const maxAgency = byAgency.reduce((m, a) => Math.max(m, a.unlinked_ai_ato_count), 0);

  return (
    <section className="ink-in">
      {counts && totalAi > 0 ? (
        <div className="mb-12">
          <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-border pb-2">
            <Eyebrow color="stamp">The AI picture</Eyebrow>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              {snapshot?.snapshot_date
                ? `Snapshot ${snapshot.snapshot_date}`
                : "Marketplace snapshot"}
            </div>
          </div>

          <h1 className="font-display text-[clamp(2rem,5vw,3.4rem)] leading-[0.97] tracking-[-0.03em] text-foreground">
            <span className="font-display italic">{formatNumber(totalAi)}</span>{" "}
            FedRAMP products are AI tools.{" "}
            <span className="relative inline-block">
              <span
                aria-hidden
                className="absolute inset-x-[-0.06em] bottom-[0.12em] h-[0.34em] bg-[var(--highlight)]/90"
              />
              <span className="relative">
                <span className="font-display italic">
                  {formatNumber(counts.ai_unlinked)}
                </span>{" "}
                are authorized but absent from agency inventories.
              </span>
            </span>
          </h1>
          <p className="mt-5 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            An independent LLM review classifies every FedRAMP cloud offering by
            whether it is itself an AI/ML product. Of the{" "}
            {formatNumber(totalAi)} judged AI,{" "}
            <span className="font-medium text-foreground">
              {formatNumber(counts.ai_linked)}
            </span>{" "}
            are linked into the AI use-case inventory and{" "}
            <span className="font-medium text-foreground">
              {formatNumber(counts.ai_unlinked)}
            </span>{" "}
            are not — every one of those authorized by at least one agency that
            reports no use of it.{" "}
            <Link
              href="/fedramp/coverage/unlinked-ai"
              className="text-foreground underline decoration-[var(--stamp)] underline-offset-2 hover:text-[var(--stamp)]"
            >
              See the gap board →
            </Link>
          </p>

          <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
            <Figure
              eyebrow="Marketplace composition"
              caption={`All ${formatNumber(snapshot?.product_count ?? 0)} FedRAMP offerings, by AI classification.`}
            >
              <DonutChart
                data={[
                  { label: "core_ai", count: counts.core_ai },
                  { label: "ai_featured", count: counts.ai_featured },
                  { label: "not_ai", count: counts.not_ai },
                ]}
                colorMap={COMPOSITION_COLORS}
                labelMap={COMPOSITION_LABELS}
                centerLabel={formatNumber(snapshot?.product_count ?? 0)}
                centerSubLabel="products"
                height={240}
              />
            </Figure>

            <Figure
              eyebrow="The coverage gap"
              caption={`Of ${formatNumber(totalAi)} AI products: ${formatNumber(counts.ai_linked)} linked into the inventory, ${formatNumber(counts.ai_unlinked)} absent.`}
            >
              <GapBar
                linked={counts.ai_linked}
                absent={counts.ai_unlinked}
              />
            </Figure>

            <Figure
              eyebrow="AI products by impact level"
              caption="FedRAMP authorization impact level of the classified-AI offerings."
            >
              <HorizontalBarChart
                data={byImpact.map((r) => ({ label: r.impact_level, count: r.count }))}
                colorMap={IMPACT_COLORS}
                labelMap={Object.fromEntries(byImpact.map((r) => [r.impact_level, r.impact_level]))}
                height={200}
                labelWidth={90}
              />
            </Figure>

            <Figure
              eyebrow="Agencies sitting on absent AI"
              caption="Agencies holding the most ATOs for AI products their own inventory never names."
            >
              {byAgency.length === 0 ? (
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  No data.
                </p>
              ) : (
                <ul className="space-y-1.5 pt-1">
                  {byAgency.map((a) => (
                    <li key={a.inventory_agency_id} className="flex items-center gap-3">
                      <Link
                        href={`/agencies/${a.agency_abbreviation}`}
                        className="w-20 shrink-0 truncate font-mono text-[11px] uppercase tracking-[0.1em] text-foreground hover:text-[var(--stamp)]"
                        title={a.agency_name}
                      >
                        {a.agency_abbreviation}
                      </Link>
                      <div className="relative h-3.5 flex-1 bg-muted/40">
                        <div
                          className="absolute inset-y-0 left-0 bg-[var(--stamp)]/80"
                          style={{
                            width: `${maxAgency > 0 ? (a.unlinked_ai_ato_count / maxAgency) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-7 shrink-0 text-right font-display italic tabular-nums text-foreground">
                        {formatNumber(a.unlinked_ai_ato_count)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Figure>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-border pb-2">
        <Eyebrow color="stamp">Choose a view</Eyebrow>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Two sub-areas
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/fedramp/marketplace"
          className="group block border border-border p-6 transition-colors hover:border-foreground"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground group-hover:text-foreground">
              Marketplace
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Open →
            </span>
          </div>
          <h2 className="mt-3 font-display italic text-[1.8rem] leading-[1] tracking-[-0.02em] text-foreground group-hover:text-[var(--stamp)] md:text-[2.2rem]">
            The FedRAMP ledger.
          </h2>
          <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-foreground/80">
            Every cloud-service offering, every provider, every authorizing
            agency, every 3PAO — sourced live from the marketplace snapshot,
            laid out as an editorial dossier.
          </p>
          {snapshot ? (
            <dl className="mt-5 grid grid-cols-3 gap-3 font-mono text-[11px]">
              <div className="border-t-2 border-foreground pt-1.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  Products
                </dt>
                <dd className="font-display italic text-[1.4rem] leading-[1] tabular-nums text-foreground">
                  {formatNumber(snapshot.product_count)}
                </dd>
              </div>
              <div className="border-t-2 border-foreground pt-1.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  ATOs
                </dt>
                <dd className="font-display italic text-[1.4rem] leading-[1] tabular-nums text-foreground">
                  {formatNumber(snapshot.ato_event_count)}
                </dd>
              </div>
              <div className="border-t-2 border-foreground pt-1.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  Agencies
                </dt>
                <dd className="font-display italic text-[1.4rem] leading-[1] tabular-nums text-foreground">
                  {formatNumber(snapshot.agency_count)}
                </dd>
              </div>
            </dl>
          ) : null}
          <div aria-hidden className="mt-5 h-1.5 bg-[var(--ink)]" />
        </Link>

        <Link
          href="/fedramp/coverage"
          className="group block border border-border p-6 transition-colors hover:border-foreground"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground group-hover:text-foreground">
              Coverage
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Open →
            </span>
          </div>
          <h2 className="mt-3 font-display italic text-[1.8rem] leading-[1] tracking-[-0.02em] text-foreground group-hover:text-[var(--stamp)] md:text-[2.2rem]">
            Inventory × FedRAMP.
          </h2>
          <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-foreground/80">
            Which inventory products are FedRAMP-authorized, which agencies
            are using AI tools without an authorization at the right impact
            level, and which authorized products aren&rsquo;t showing up in
            agency inventories.
          </p>
          <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Vendor coverage · Authorization fit · Agency gaps · Unlinked AI ·
            Authorization vs adoption
          </p>
          <div aria-hidden className="mt-5 h-1.5 bg-[var(--stamp)]" />
        </Link>
      </div>
    </section>
  );
}

/** Two-segment proportional bar: AI products linked into the inventory vs
 *  absent from it. Server-rendered HTML (no Recharts needed). */
function GapBar({ linked, absent }: { linked: number; absent: number }) {
  const total = linked + absent;
  const linkedPct = total === 0 ? 0 : (linked / total) * 100;
  return (
    <div className="pt-2">
      <div className="flex h-8 w-full overflow-hidden border border-foreground">
        <div
          className="flex items-center justify-center bg-[var(--ink)] text-[11px] font-mono text-background"
          style={{ width: `${linkedPct}%` }}
          title={`${linked} linked into the inventory`}
        >
          {linkedPct > 12 ? formatNumber(linked) : null}
        </div>
        <div
          className="flex items-center justify-center bg-[var(--stamp)] text-[11px] font-mono text-background"
          style={{ width: `${100 - linkedPct}%` }}
          title={`${absent} absent from the inventory`}
        >
          {100 - linkedPct > 12 ? formatNumber(absent) : null}
        </div>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-2 w-2 bg-[var(--ink)] align-middle" />
          Linked into inventory
        </span>
        <span>
          Absent from inventory
          <span className="ml-1 inline-block h-2 w-2 bg-[var(--stamp)] align-middle" />
        </span>
      </div>
    </div>
  );
}

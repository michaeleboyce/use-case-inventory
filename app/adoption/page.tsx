// app/adoption/page.tsx — technology-adoption comparison (§ V · Analytics).
//
// The page behind the article's compression claim: prior federal enterprise
// technologies took roughly a decade from policy mandate to majority
// adoption; federal GenAI went from zero to a government-wide access mandate
// in ~2.6 years. Every plotted point is exportable via
// /api/adoption-series.csv and every external series carries a citation.

import { Citation } from "@/components/citation";
import { AdoptionCurveChart } from "@/components/charts/adoption-curve-chart";
import { Figure, Section } from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { StatTile } from "@/components/stat-tile";
import { formatNumber } from "@/lib/formatting";
import { buildAdoptionViewModel } from "./_view-model";
import { GenAiGrowthChart } from "./_sections/genai-growth-chart";
import { BaselinesTable } from "./_sections/baselines-table";

export const metadata = { title: "Technology Adoption Compared" };

export default async function AdoptionPage() {
  const vm = await buildAdoptionViewModel();
  const g2024 = vm.genai.find((c) => c.inventory_year === 2024);
  const g2025 = vm.genai.find((c) => c.inventory_year === 2025);
  const fedramp = vm.series.find((s) => s.id === "fedramp-authorizations");

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <PageMasthead
        kicker="§ V · Analytics · Adoption"
        metaLines={[
          "Federal GenAI vs prior technology rollouts",
          "External baselines verified 2026-07-06",
        ]}
        title={
          <>
            A decade,
            <br />
            compressed.
          </>
        }
        lede={`Prior federal enterprise technologies took roughly a decade from policy mandate to majority adoption. Generative AI went from public release to a government-wide access mandate in about two and a half years — and the inventory's GenAI count nearly doubled (${formatNumber(g2024?.genai_use_cases ?? 0)} → ${formatNumber(g2025?.genai_use_cases ?? 0)}) in the single year the mandate landed.`}
        dropCap
      />

      <Section
        number="I"
        title="The curves"
        lede="Every technology re-based to years since its own starting gun."
        source="mixed"
      >
        <Figure
          eyebrow="Fig. 1 · Adoption, years since mandate or introduction"
          caption={
            <>
              Each series is aligned at x = 0 to its own mandate (federal
              series) or first availability (organic series) and plots its own
              source&apos;s metric — populations differ by series and are
              labeled in the legend; household curves (gray) are context, not
              comparanda. Federal HTTPS and PIV percentages computed by IFP
              from the archived raw scans and OMB reports. Vermilion line:
              the federal LLM-access mandate arrived 2.6 years into the GenAI
              era. Export every point:{" "}
              <a
                href="/api/adoption-series.csv"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
              >
                adoption-series.csv
              </a>
              .
            </>
          }
        >
          <AdoptionCurveChart series={vm.series} />
        </Figure>
        <div className="mt-6 max-w-prose text-[0.95rem] leading-[1.6] text-muted-foreground">
          <p>
            The mandate-driven baselines cut both ways. Federal HTTPS shows a
            mandate <em>can</em>{" "}
            move the enterprise fast: enforcement roughly
            quadrupled in the 18 months after M-15-13. Federal cloud shows a
            mandate often doesn&apos;t: five to seven years after Cloud First,
            cloud was still ~3% of federal IT spend (GAO-19-58), and FedRAMP
            had authorized {fedramp ? formatNumber(fedramp.points[0].value) : "~20"}{" "}
            services by year five. PIV strong authentication drifted for a
            decade after HSPD-12, then jumped 42% → 72% in a single quarter —
            under the 2015 breach-response sprint, not the original mandate.
          </p>
        </div>
      </Section>

      <Section
        number="II"
        title="Federal GenAI"
        lede="The inventory's own growth, in counts — one cycle apart."
        source="omb-derived"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Figure
              eyebrow="Fig. 2 · Individually filed use cases, 2024 vs 2025"
              caption="Individual use cases only (the 900-row consolidated grid has no 2024 counterpart). GenAI per IFP tagging; deployed = stage-normalized deployed. Counts are computed live from the inventory database."
            >
              <GenAiGrowthChart cycles={vm.genai} />
            </Figure>
          </div>
          <div className="flex flex-col gap-5">
            <StatTile
              label="Enterprise-wide GenAI"
              value={`${g2024?.enterprise_genai_agencies ?? 0} → ${g2025?.enterprise_genai_agencies ?? 0}`}
              sublabel="agencies, 2024 → 2025"
              accent="stamp"
            />
            <StatTile
              label="GenAI use cases"
              value={`${formatNumber(g2024?.genai_use_cases ?? 0)} → ${formatNumber(g2025?.genai_use_cases ?? 0)}`}
              sublabel="IFP tag · individual filings"
            />
            <StatTile
              label="Deployed GenAI"
              value={`${formatNumber(g2024?.deployed_genai ?? 0)} → ${formatNumber(g2025?.deployed_genai ?? 0)}`}
              sublabel="in a deployed stage"
            />
          </div>
        </div>
        <div className="mt-6 max-w-prose text-[0.95rem] leading-[1.6] text-muted-foreground">
          <p>
            A caveat the chart already respects: a use-case count measures
            institutional adoption — what agencies report doing — not the
            share of employees using a tool. That is why the counts get their
            own figure instead of a line on Fig. 1&apos;s percentage axis. For
            the workforce-share view, see the{" "}
            <a
              href="/experience"
              className="underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
            >
              employee experience
            </a>{" "}
            section&apos;s LLM-access tiers. External corroboration for the
            speed: Bick, Blandin &amp; Deming find 28% of US workers using
            GenAI at work within two years of ChatGPT — versus roughly 25% PC
            use three years after the IBM PC.
          </p>
        </div>
      </Section>

      <Section
        number="III"
        title="The baselines"
        lede="Every series, its population, metric, driver, and source."
        source="mixed"
        id="baselines"
      >
        <BaselinesTable series={vm.series} />
      </Section>

      <Section
        number="IV"
        title="Method & sources"
        lede="How the curves were built, and what they can't say."
        source="derived"
        id="methodology"
      >
        <div className="max-w-prose space-y-4 text-[0.95rem] leading-[1.6] text-muted-foreground">
          <p>
            <strong className="text-foreground">Alignment.</strong> Each series
            is re-based to years since its own mandate (federal series) or
            first public availability (organic series), so curves compare
            trajectory shape, not calendar dates. Federal HTTPS percentages
            are computed by IFP from GSA&apos;s archived weekly domain scans
            (denominator: live parent .gov domains, ~1,130–1,190 per scan);
            &ldquo;supported&rdquo; and &ldquo;enforced&rdquo; are the archived
            Pulse definitions and are deliberately plotted as separate lines.
          </p>
          <p>
            <strong className="text-foreground">Populations differ.</strong>{" "}
            Federal series count domains, users, or cloud services; the
            workplace series counts employed adults; household context curves
            count households. The comparison is honest about this: it claims
            the <em>historically slower</em> adopter (the federal enterprise)
            moved on GenAI at a pace previously seen only in consumer
            technologies — it does not claim the populations are equivalent.
          </p>
          <p>
            <strong className="text-foreground">
              Counts are not adoption shares.
            </strong>{" "}
            The inventory&apos;s use-case counts (Fig. 2) measure reported
            institutional activity. They never share an axis with the
            percentage curves.
          </p>
          <ul className="space-y-2 border-t border-border pt-4">
            {vm.series
              .filter(
                (s, i, all) =>
                  all.findIndex((t) => t.source.url === s.source.url) === i,
              )
              .map((s) => (
                <li key={s.id}>
                  <Citation
                    url={s.source.url}
                    title={s.source.title}
                    accessed={s.source.accessed}
                  />
                </li>
              ))}
            <li>
              <Citation
                url="https://www.nber.org/system/files/working_papers/w32966/w32966.pdf"
                title="Bick, Blandin & Deming — The Rapid Adoption of Generative AI (NBER WP 32966)"
                accessed="2026-07-06"
              />
            </li>
            <li>
              <Citation
                url="https://www.gao.gov/products/gao-19-58"
                title="GAO-19-58 — Cloud Computing: Agencies Have Increased Usage and Realized Benefits, but Cost and Savings Data Need to Be Better Tracked"
                accessed="2026-07-06"
              />
            </li>
            <li>
              <Citation
                url="https://obamawhitehouse.archives.gov/sites/default/files/omb/assets/egov_docs/federal-cloud-computing-strategy.pdf"
                title="Federal Cloud Computing Strategy (“Cloud First”), Dec 2010"
                accessed="2026-07-06"
              />
            </li>
          </ul>
        </div>
      </Section>
    </main>
  );
}

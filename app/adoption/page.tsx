// app/adoption/page.tsx — technology-adoption comparison (§ V · Analytics).
//
// The page behind the article's compression claim: prior federal enterprise
// technologies took roughly a decade from policy mandate to majority
// adoption; federal GenAI went from zero to a government-wide access mandate
// in ~2.6 years. Every plotted point is exportable via
// /api/adoption-series.csv and every external series carries a citation.

import Link from "next/link";
import { Citation } from "@/components/citation";
import { AdoptionCurveChart } from "@/components/charts/adoption-curve-chart";
import { Figure, Section } from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { StatTile } from "@/components/stat-tile";
import { formatNumber } from "@/lib/formatting";
import { buildAdoptionViewModel } from "./_view-model";
import { GenAiGrowthChart } from "./_sections/genai-growth-chart";
import { BaselinesTable } from "./_sections/baselines-table";
import { AdoptionLineSources } from "./_sections/line-sources";

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
          "External baselines verified 2026-07-06 · DNSSEC 2026-07-26",
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
        lede="Every technology on one kind of clock: when it arrived, and when the mandate came."
        source="mixed"
      >
        <Figure
          eyebrow="Fig. 1 · Adoption on each technology's own clock, mandates marked"
          caption={
            <>
              Default view (apples to apples): each series is aligned at
              x&nbsp;=&nbsp;0 to when its <em>technology</em>{" "}
              entered use, and
              each federal mandate is marked as a colored rule on that same
              clock — M-15-13 at yr 20.6 of HTTPS, HSPD-12 at yr 9.2 of
              smart cards, the FedRAMP memo at yr 5.3 of commercial IaaS,
              M-08-23 at yr 3.5 of DNSSEC, the
              LLM-access mandate at yr 2.6 of ChatGPT. Toggle to the
              mandate clock for the original view (years since each mandate —
              post-mandate response speed). Each curve plots its own
              source&apos;s metric — every line is a federal-enterprise
              population, labeled in the legend, with per-line sources
              documented under Method &amp; sources below. Federal HTTPS, PIV, and DNSSEC
              percentages computed or hand-assembled by IFP from the archived
              raw scans, OMB FISMA reports, and NIST&apos;s live DNSSEC
              monitor. Export every point:{" "}
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
            DNSSEC sits between: roughly 20% of federal .gov domains were
            signed at M-08-23&apos;s own December 2009 deadline, and the climb
            to 74% by FY2012 came only after DHS began scanning every domain
            and a cross-agency Tiger Team published the results — compliance
            followed measurement, not the memo.
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
        title="The lessons"
        lede="What the baselines say about how federal adoption actually moves."
        source="mixed"
        id="lessons"
      >
        <div className="max-w-prose space-y-6 text-[0.95rem] leading-[1.6] text-muted-foreground">
          <div>
            <p>
              <strong className="text-foreground">
                1. The scoreboard is the mechanism.
              </strong>{" "}
              The one mandate that compressed — HTTPS — shipped with a public,
              weekly-updated compliance dashboard: GSA&apos;s Pulse published
              every agency&apos;s HTTPS status for peers, press, and Congress
              to see, and a binding directive (BOD 18-01) later locked the
              gains in. Cloud First and HSPD-12 had no scoreboard and drifted
              for a decade. The use case inventory — and per-agency LLM-access
              reporting — could be GenAI&apos;s Pulse.
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <Citation
                url="https://github.com/18F/pulse"
                title="18F — Pulse: how the federal .gov domain space is doing at best practices"
                accessed="2026-07-06"
              />
              <Citation
                url="https://cyber.dhs.gov/bod/18-01/"
                title="DHS Binding Operational Directive 18-01 — Enhance Email and Web Security (2017)"
                accessed="2026-07-06"
              />
            </div>
          </div>

          <div>
            <p>
              <strong className="text-foreground">
                2. Access compressed; integration didn&apos;t.
              </strong>{" "}
              The inventory&apos;s operating GenAI concentrates in shallow,
              standalone chat, while the deeply-integrated federal AI estate
              remains overwhelmingly pre-GenAI classical ML — and every
              coding-agent filing in the 2025 inventory is still
              pre-deployment. The decade got compressed for access, not for
              integration. See the{" "}
              <Link
                href="/figures/integration-depth"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
              >
                integration-depth analysis
              </Link>{" "}
              (IFP-adjudicated labels, 2026-07 round).
            </p>
          </div>

          <div>
            <p>
              <strong className="text-foreground">
                3. Enterprise access is decided below the department.
              </strong>{" "}
              Within-department divergence is the norm, not the exception:
              every scored HHS operating division independently clears the
              enterprise-LLM bar, DOJ&apos;s bureaus uniformly do not, and DOE
              is bimodal across its labs. A mandate addressed to
              &ldquo;agencies&rdquo; is actually implemented by component
              CIOs — certification and reporting should bind at that level.
              See the{" "}
              <Link
                href="/figures/bureau-divergence"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
              >
                bureau-divergence analysis
              </Link>
              .
            </p>
          </div>

          <div>
            <p>
              <strong className="text-foreground">
                4. Crisis compresses what mandates alone don&apos;t.
              </strong>{" "}
              PIV login use sat at 1.24% six years after HSPD-12 and roughly
              20% at nine — then jumped from 42% to 72% in a single quarter
              during the 2015 Cybersecurity Sprint, after the OPM breach. The
              federal government historically finishes its own mandates only
              under catastrophe; locking in LLM-access certification now is
              how the GenAI mandate avoids needing its own OPM moment.
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <Citation
                url="https://obamawhitehouse.archives.gov/blog/2015/07/31/strengthening-enhancing-federal-cybersecurity-21st-century"
                title="White House — Strengthening & Enhancing Federal Cybersecurity for the 21st Century (Cyber Sprint results, 2015)"
                accessed="2026-07-06"
              />
              <Citation
                url="https://www.route-fifty.com/cybersecurity/2014/05/hspd-12-at-10-years-still-a-long-way-to-go/297300/"
                title="Route Fifty — HSPD-12 at 10 Years: Still a Long Way to Go (2014)"
                accessed="2026-07-06"
              />
            </div>
          </div>

          <div>
            <p>
              <strong className="text-foreground">
                5. GenAI adoption routed around the accountability ledger.
              </strong>{" "}
              ChatGPT Enterprise (authorized 2026-01-09), Gemini for
              Government (2026-01-21), and Perplexity Enterprise (2026-02-01)
              each show a FedRAMP authorization with zero recorded agency
              reuses as of the 2026-07-03 marketplace check — adoption flowed
              through OneGov agreements and GSA&apos;s USAi platform instead
              of the reuse ledger. The compression happened despite the
              procurement stack, not through it. See the{" "}
              <Link
                href="/fedramp"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
              >
                FedRAMP coverage section
              </Link>
              .
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <Citation
                url="https://marketplace.fedramp.gov/"
                title="FedRAMP Marketplace (authorization & reuse records)"
                date="2026-07-03"
                accessed="2026-07-03"
              />
            </div>
          </div>

          <div>
            <p>
              <strong className="text-foreground">
                6. When it moves, the federal enterprise can outrun industry.
              </strong>{" "}
              After the 2015 sprint, 81% of federal civilian users
              authenticated with strong credentials — at a time when only 28%
              of Americans used two-factor authentication anywhere (2017),
              a figure that didn&apos;t reach 79% until 2021. The GenAI moment
              is an opportunity to lead adoption, not merely catch up.
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <Citation
                url="https://duo.com/blog/the-2019-state-of-the-auth-report-has-2fa-hit-mainstream-yet"
                title="Duo Security — State of the Auth 2019 (28% 2FA usage in 2017)"
                accessed="2026-07-06"
              />
              <Citation
                url="https://duo.com/blog/the-2021-state-of-the-auth-report-2fa-climbs-password-managers-biometrics-trend"
                title="Duo Security — State of the Auth 2021 (79% 2FA usage)"
                accessed="2026-07-06"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p>
              <strong className="text-foreground">
                The clock on the instrument itself:
              </strong>{" "}
              the statutory mandate behind these inventories — Advancing
              American AI Act §7225 — sunsets on{" "}
              <strong className="text-foreground">December 23, 2027</strong>.
              After that, whether the federal government keeps measuring its
              own AI adoption is purely OMB&apos;s discretion. Every lesson
              above depends on the measurement continuing.
            </p>
            <div className="mt-2">
              <Citation
                url="https://www.congress.gov/bill/117th-congress/house-bill/7776"
                title="Pub. L. 117-263, Div. G, Title LXXII, Subtitle B — Advancing American AI Act (§7225 use case inventories)"
                accessed="2026-07-06"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        number="IV"
        title="The baselines"
        lede="Every series, its population, metric, driver, and source."
        source="mixed"
        id="baselines"
      >
        <BaselinesTable series={vm.series} />
      </Section>

      <Section
        number="V"
        title="Method & sources"
        lede="How the curves were built, and what they can't say."
        source="derived"
        id="methodology"
      >
        <div className="max-w-prose space-y-4 text-[0.95rem] leading-[1.6] text-muted-foreground">
          <p>
            <strong className="text-foreground">Alignment.</strong> The chart
            offers two clocks. The default re-bases every series to years
            since its <em>technology</em>{" "}
            entered use (commercial availability
            or public release) and marks each federal mandate on that same
            clock, so a technology&apos;s arrival and its mandate are both
            visible per series — the apples-to-apples frame. The alternate
            clock re-bases federal series to their own mandate (organic
            series to first availability), comparing post-mandate response
            speed. Both compare trajectory shape, not calendar dates. Federal
            HTTPS percentages are computed by IFP from GSA&apos;s archived
            weekly domain scans (denominator: live parent .gov domains,
            ~1,130–1,190 per scan); &ldquo;supported&rdquo; and
            &ldquo;enforced&rdquo; are the archived Pulse definitions and are
            deliberately plotted as separate lines. The DNSSEC series mixes
            three measured sources over the same kind of population (federal
            second-level .gov domains) with slightly different denominators:
            press-corroborated coverage of the December 2009 deadline, the
            DHS-scan &ldquo;DNSSEC Implementation&rdquo; percentages from
            OMB&apos;s FY2011–FY2012 FISMA reports, and a 2026 endpoint
            IFP-computed from NIST&apos;s live deployment monitor over
            CISA&apos;s 1,338-domain federal list (84.4% signed; 81.8% also
            valid and chained) — approximate points are flagged in the data.
          </p>
          <p>
            <strong className="text-foreground">Populations differ.</strong>{" "}
            The chart is government-only, but even within the federal
            enterprise the series count different things — .gov domains
            (HTTPS, DNSSEC), civilian users (PIV), CFO Act agencies (cloud),
            AI-eligible workers (LLM access) — so curves compare trajectory
            shape, not a shared denominator. The consumer baselines
            (household computer, internet, smartphone; workplace PC) remain
            in the dataset, the baselines table, and the CSV export, but are
            no longer plotted.
          </p>
          <p>
            <strong className="text-foreground">
              Counts are not adoption shares.
            </strong>{" "}
            The inventory&apos;s use-case counts (Fig. 2) measure reported
            institutional activity. They never share an axis with the
            percentage curves.
          </p>
          <div className="border-t border-border pt-4">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Sources, by line
            </p>
            <AdoptionLineSources />
          </div>
          <ul className="space-y-2 border-t border-border pt-4">
            <li className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Context &amp; corroboration
            </li>
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

/**
 * /stories — "Opening the Laptop"
 *
 * Six archetypes of how the individual federal employee's generative-AI
 * experience changed between the 2024 (M-24-10) and 2025 (M-25-21) inventory
 * cycles, told as fourteen agency portraits. Every external claim carries a
 * numbered footnote to an original source; every card deep-links to the
 * underlying data elsewhere on this site.
 *
 * Statistics are static by design — each is tied to a citation (the June
 * 2026 article fact sheet + the footnoted record), so live queries would let
 * figures drift from their sources. Only volatile numeric ids (agency /
 * product deep links) are resolved from the DB at render time.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  Figure,
  MonoChip,
  Section,
  SourceLegend,
} from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { StatTile } from "@/components/stat-tile";
import { EnterpriseTierChart } from "@/components/experience/enterprise-tier-chart";
import { buildUseCasesUrl } from "@/lib/urls";
import type { UseCaseFilterInput } from "@/lib/types";
import { buildStoriesViewModel, type StoryAgencyAbbr, type StoryProductName } from "./_view-model";
import { StoryCard, EvidenceTag } from "./_sections/story-card";
import { Fn, FootnoteList } from "./_sections/footnotes";

export const metadata: Metadata = {
  title: "Stories: 2024 → 2025 · Federal AI Readiness",
  description:
    "How the individual federal employee's experience of generative AI changed between the 2024 and 2025 inventory cycles — six archetypes, fourteen agencies, every claim sourced.",
};

export default async function StoriesPage() {
  const vm = await buildStoriesViewModel();

  const ucUrl = (
    abbr: StoryAgencyAbbr,
    extra: Partial<UseCaseFilterInput> = {},
  ): string => {
    const id = vm.agencyIds[abbr];
    return id != null
      ? buildUseCasesUrl({ ...extra, agencyIds: [id] })
      : buildUseCasesUrl(extra);
  };

  const productUrl = (name: StoryProductName): string => {
    const id = vm.productIds[name];
    return id != null ? `/products/${id}` : buildUseCasesUrl({ q: name });
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 md:px-8">
      {/* Dateline */}
      <div className="mt-6 flex flex-wrap items-baseline gap-3 border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <MonoChip tone="stamp" size="xs">
          IFP
        </MonoChip>
        <span>Stories · 2024 → 2025</span>
        <span aria-hidden className="text-muted-foreground/50">
          ·
        </span>
        <Link
          href="/experience"
          className="underline-offset-2 hover:text-foreground hover:underline"
        >
          ← AI Experience
        </Link>
      </div>

      {/* Header */}
      <div className="mt-10">
        <PageMasthead
          kicker="§ VI · Features"
          metaLines={["Six archetypes · fourteen agencies · every claim sourced"]}
          title="Opening the laptop"
          lede={
            <>
              How the individual federal employee&rsquo;s experience of generative
              AI changed between the 2024 and 2025 inventory cycles. Numbered
              footnotes cite original external sources; chips deep-link to the
              underlying data on this site. Claims tagged{" "}
              <EvidenceTag>inventory-only</EvidenceTag> rest on an agency&rsquo;s
              filing with no independent press;{" "}
              <EvidenceTag>agency-reported</EvidenceTag> marks self-reported
              performance figures.
            </>
          }
          actions={<SourceLegend />}
        />
      </div>

      {/* Stat strip */}
      <div className="mt-12 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-3 lg:grid-cols-6">
        <div className="bg-card p-4">
          <StatTile variant="rule" label="Use cases filed" value="2,133 → 3,549" sublabel="2024 → 2025; 2025 moved most COTS to a separate 900-row appendix" />
        </div>
        <div className="bg-card p-4">
          <StatTile variant="rule" label="Tagged GenAI" value="527 → 999" sublabel="IFP tags, both years re-audited" />
        </div>
        <div className="bg-card p-4">
          <StatTile variant="rule" label="Enterprise-wide GenAI" value="44 → 242" accent="stamp" sublabel="rows; agencies with any went 21 → 24" />
        </div>
        <div className="bg-card p-4">
          <StatTile variant="rule" label="Operated internal services" value="27% → 69%" accent="stamp" sublabel="share of enterprise GenAI run as an in-house service, not a permission slip" />
        </div>
        <div className="bg-card p-4">
          <StatTile variant="rule" label="Coding filings / enterprise" value="57 / 4" sublabel="individual coding-assistant filings vs. agencies at enterprise breadth" />
        </div>
        <div className="bg-card p-4">
          <StatTile variant="rule" label="Claude Code mentions" value="1" sublabel="in 3,549 use cases — one Interior line item" href={productUrl("Claude Code")} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Source data
        </span>
        <MonoChip href="/compare-years" tone="stamp" size="xs">
          2024 ↔ 2025 comparison
        </MonoChip>
        <MonoChip href="/experience#section-01" tone="stamp" size="xs">
          Delivery tiers
        </MonoChip>
        <MonoChip href="/analytics#coding" tone="stamp" size="xs">
          Coding-tool leaderboard
        </MonoChip>
        <MonoChip href="/readiness/access" tone="stamp" size="xs">
          Access &amp; scale estimates
        </MonoChip>
      </div>

      {/* Tier flip chart */}
      {vm.tierRollup.length > 0 ? (
        <div className="mt-12 max-w-3xl">
          <Figure
            eyebrow="The delivery-mode flip · OMB → IFP"
            caption={
              <>
                Enterprise-wide generative-AI use cases by delivery tier. IFP
                classification of every enterprise-wide GenAI row, rule-based
                with hand-reviewed overrides. 2025 concentration caveat: HHS
                alone accounts for most operated-service rows — pair row
                counts with agency counts.{" "}
                <Link href="/experience#section-01" className="underline underline-offset-2 hover:text-foreground">
                  Full chart &amp; method
                </Link>
              </>
            }
          >
            <EnterpriseTierChart data={vm.tierRollup} />
          </Figure>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <Section
        number="01"
        id="permission-to-product"
        title="Permission → product"
        lede="The binding constraint in 2024 was rarely the model; it was the data boundary. The biggest 2025 unlocks were permission infrastructure: internally operated services approved for the documents actually on the employee's desk."
        source="mixed"
      >
        <StoryCard
          agency="DHS / USCIS"
          persona="the immigration officer"
          coverage="~29%"
          then2024={
            <p>
              DHS conditionally approved commercial ChatGPT, Claude, and
              Copilot for employees — on publicly available information{" "}
              <em>only</em>; the moment work touched a real case file, the AI
              was off-limits.
              <Fn n={1} first /> The one place staff worked <em>inside</em>{" "}
              generative AI was a training pilot: an asylum-interview
              simulator whose designer leaned into the model&rsquo;s flaws —
              &ldquo;I also want them to hallucinate&hellip; because
              you&rsquo;re often, in real life, working with an interpreter
              and there&rsquo;s a lot of confusion.&rdquo;
              <Fn n={2} first />
            </p>
          }
          now2025={
            <p>
              December 2024: Secretary Mayorkas unveiled <strong>DHSChat</strong>{" "}
              for ~19,000 headquarters staff and pilot users across ten
              components — approved for non-public internal information, built
              by the department&rsquo;s new AI Corps.
              <Fn n={3} first />
              <Fn n={4} first /> &ldquo;I wouldn&rsquo;t want to communicate
              hubris&hellip; humility is required,&rdquo; Mayorkas told Axios.
              <Fn n={4} /> Then the counter-move: by May 2025 DHS cut off the
              commercial tools it had blessed a year earlier, consolidating on
              the internal platform.
              <Fn n={5} first />
            </p>
          }
          coda={
            <p>
              The free-range window closed as the secure one opened — the
              employee traded &ldquo;any chatbot, no real data&rdquo; for
              &ldquo;one chatbot, the actual work.&rdquo;{" "}
              <EvidenceTag title="Author disclosure">disclosure</EvidenceTag>{" "}
              DHSChat launched under then-DHS AI Corps director Michael Boyce;
              the asylum-tool quote is his on the record.
              <Fn n={2} />
            </p>
          }
          chips={[
            { label: "DHS agency page", href: "/agencies/dhs" },
            { label: "DHS GenAI use cases", href: ucUrl("DHS", { isGenAI: true }) },
            { label: "Delivery tiers", href: "/experience#section-01" },
          ]}
        />

        <StoryCard
          agency="State"
          persona="the Foreign Service Officer"
          coverage="~95%"
          then2024={
            <p>
              <strong>StateChat</strong> (Palantir + Azure OpenAI) launched in
              August 2024 on the unclassified network, approved for Sensitive
              But Unclassified material across a &gt;75,000-person workforce —
              paste a draft cable, get ALDAC-style tightening back.
              <Fn n={6} first /> The constraint was architectural: classified
              traffic stayed on separate systems, breaking the workflow at the
              moments of highest stakes.
            </p>
          }
          now2025={
            <p>
              StateChat went from launch to infrastructure: roughly 45,000
              active users generating &gt;95% of prompts and 3M+ total
              prompts,
              <Fn n={7} first /> growing to ~58,000 users across 98% of
              State&rsquo;s 270+ missions, with the department estimating
              20,000–30,000 staff-hours saved per week and agentic features on
              the roadmap.
              <Fn n={8} first /> CIO Kelly Fletcher described embassy adoption
              growing &ldquo;by orders of magnitude.&rdquo;
              <Fn n={9} first />
            </p>
          }
          coda={
            <p>
              The largest verifiable enterprise SBU LLM deployment in the
              federal civilian space — and the clearest case of a chatbot
              becoming default infrastructure inside two years.
            </p>
          }
          chips={[
            { label: "State agency page", href: "/agencies/state" },
            { label: "Access & scale estimates", href: "/readiness/access" },
            { label: "Estimated seats", href: "/experience#section-04" },
          ]}
        />
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        number="02"
        id="zero-to-dense"
        title="Zero → dense"
        lede="The compressed adoption curve at its steepest: agencies that filed essentially nothing in 2024 arrived in 2025 with a chatbot for every knowledge bottleneck — the same RAG architecture, replicated bureau by bureau."
        source="mixed"
      >
        <StoryCard
          agency="DOE / Savannah River Site"
          persona="the nuclear operations engineer"
          then2024={
            <p>
              The 2024 inventory shows two rows at the site, neither touching
              the 10,000+ operational workforce; enterprise GenAI, zero.{" "}
              <EvidenceTag>inventory-only</EvidenceTag> The job meant
              navigating hundreds of multi-hundred-page DOE Orders and
              safety-basis documents by bookmark and institutional memory —
              at a site whose own filings name an aging-workforce
              knowledge-loss problem.
            </p>
          }
          now2025={
            <p>
              Twenty-one site-wide use cases, built largely in-house on Azure
              AI Services: <strong>ChatSRS</strong> (on OpenAI models,
              licensed via Microsoft) and <strong>AskHR</strong> announced
              publicly,
              <Fn n={10} first />
              <Fn n={11} first /> plus a RAG fleet disclosed in the inventory
              — DIRECTIVES (queries over DOE/NNSA orders), Ask CAS, Ask Alan
              (qualification training), Report Assistant.{" "}
              <EvidenceTag>inventory-only</EvidenceTag> All 21 filed
              pre-deployment. The contractor has since framed the buildout
              under DOE&rsquo;s Genesis Mission.
              <Fn n={12} first />
            </p>
          }
          coda={
            <p>
              Context for the wider department: DOE stood up the Joulix
              enterprise AI suite for staff and contractors,
              <Fn n={13} first /> while Lawrence Livermore made Claude
              available lab-wide to ~10,000 employees.
              <Fn n={14} first />
            </p>
          }
          chips={[
            { label: "DOE agency page", href: "/agencies/doe" },
            { label: "DOE GenAI use cases", href: ucUrl("DOE", { isGenAI: true }) },
          ]}
        />

        <StoryCard
          agency="USDA"
          persona="the farm-loan officer"
          then2024={
            <p>
              Not merely absence — prohibition. USDA had rated
              ChatGPT&rsquo;s risk &ldquo;high&rdquo; in March 2023, barred
              third-party generative AI on government equipment, and stood up
              a Generative AI Review Board to vet uses case by case.
              <Fn n={15} first /> Four GenAI use cases department-wide; for a
              county loan officer facing a 200-page handbook amendment,
              effectively zero.
            </p>
          }
          now2025={
            <p>
              Roughly 24 GenAI use cases — nearly every bureau spun up a RAG
              chatbot around its worst document pile: an FSA{" "}
              <strong>Farm Loan Programs handbook chatbot</strong> (pilot),
              Forest Service ASKTERRA and NEPA-acceleration tools, food-safety
              inspector assistants. <EvidenceTag>inventory-only</EvidenceTag>{" "}
              The governance gate remains the story: a May 2026 OIG report
              found 73 of 82 operational AI use cases lacked a required
              authority to operate, and no generative-AI policy at all.
              <Fn n={16} first />
            </p>
          }
          coda={
            <p>
              The technology arrived faster than the controls — the
              OIG&rsquo;s finding that USDA &ldquo;prioritized making use of
              the technology over setting up controls&rdquo; is the mirror
              image of the agencies that never started.
              <Fn n={16} />
            </p>
          }
          chips={[
            { label: "USDA agency page", href: "/agencies/usda" },
            { label: "USDA GenAI use cases", href: ucUrl("USDA", { isGenAI: true }) },
            { label: "Policy & compliance", href: "/policy" },
          ]}
        />
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        number="03"
        id="chatbot-to-workflow"
        title="Chatbot → workflow"
        lede="For the few agencies that deployed early, the 2025 change wasn't the chatbot — it was AI leaving the generic side-window and entering the mission workflow: transcription, adjudication scaffolding, literature synthesis."
        source="mixed"
      >
        <StoryCard
          agency="SSA"
          persona="the disability examiner"
          coverage="~50%"
          then2024={
            <p>
              SSA was one of the very few with enterprise GenAI in the 2024
              filing: the <strong>Agency Support Companion</strong>, an
              all-staff chatbot rolled out with a short training video and a
              hard rule — never paste an SSN. It knew nothing about your
              cases; it was generic help, sealed off from claimant data.
              <Fn n={17} first />
            </p>
          }
          now2025={
            <p>
              AI entered the adjudication pipeline itself.{" "}
              <strong>HeaRT</strong> replaced hearing-recording hardware with
              GenAI-transcribed software nationwide by March 17, 2025 —
              roughly 500,000 hearings a year, ~$5M in annual savings.
              <Fn n={18} first /> New filings added a vocational-assessment
              assistant and grounded policy search.{" "}
              <EvidenceTag>inventory-only</EvidenceTag> VAAT has no
              independent press; the figures above are SSA&rsquo;s.{" "}
              <EvidenceTag>agency-reported</EvidenceTag>
            </p>
          }
          chips={[
            { label: "SSA agency page", href: "/agencies/ssa" },
            { label: "SSA GenAI use cases", href: ucUrl("SSA", { isGenAI: true }) },
          ]}
        />

        <StoryCard
          agency="CDC / HHS"
          persona="the epidemiologist"
          coverage="~50%"
          then2024={
            <p>
              CDC was &ldquo;the first federal agency to make ChatGPT
              available for all of its workers back in 2023&rdquo; (acting
              CAIO Travis Hoppe) — the ChatCDC tile was expected
              infrastructure, running inside CDC&rsquo;s own security
              envelope.
              <Fn n={19} first /> Constraints were real: documents in, no live
              surveillance data.
            </p>
          }
          now2025={
            <p>
              The tool graduated (the ChatCDC brand retired into an enterprise
              &ldquo;CDC Chatbot&rdquo;), and CDC reported ~10,000 workers,
              1.2M chats, ~41,000 hours saved, and a 500%+ ROI.{" "}
              <EvidenceTag>agency-reported</EvidenceTag>
              <Fn n={19} /> The ceiling then rose department-wide: HHS rolled
              out ChatGPT to all staff in September 2025
              <Fn n={20} first /> and Claude in December, with the deputy
              secretary telling staff to &ldquo;use either tool or compare
              responses.&rdquo;
              <Fn n={21} first /> Elsewhere in the department: NIH&rsquo;s
              ChIRP
              <Fn n={23} first /> and FDA&rsquo;s Elsa, voluntarily used by
              &gt;70% of FDA staff.
              <Fn n={24} first />
            </p>
          }
          coda={
            <p>
              <EvidenceTag title="Time-sensitive: verify against the latest reporting before citing">
                date-anchored
              </EvidenceTag>{" "}
              In February 2026 HHS banned Claude amid a push for a broader
              federal blacklisting of Anthropic — any HHS-Claude claim needs a
              date stamp.
              <Fn n={22} first />
            </p>
          }
          chips={[
            { label: "HHS agency page", href: "/agencies/hhs" },
            { label: "HHS general-LLM entries", href: ucUrl("HHS", { isGeneralLLMAccess: true }) },
            { label: "Delivery tiers", href: "/experience#section-01" },
          ]}
        />

        <StoryCard
          agency="VA"
          persona="the clinician"
          coverage="~69%"
          then2024={
            <p>
              AI lived in pilot bulletins, not the exam room: clinicians spent
              an estimated 30–50% of clinical time on documentation while the
              ambient-scribe pilot was still &ldquo;initiated, not yet
              yours.&rdquo; The agency filed hundreds of use cases; almost
              none sat on the average clinician&rsquo;s desktop.
            </p>
          }
          now2025={
            <p>
              The scribe became real: an enterprise pilot at ten named VA
              medical centers (Abridge at five, Knowtex at five), with
              veterans reporting the return of eye contact and 2026 expansion
              planned.
              <Fn n={27} first /> Meanwhile <strong>VA GPT</strong> reached
              every employee — &ldquo;all VA employees now have access to a
              secure, generative AI tool,&rdquo; with ~100,000 onboarded by
              early 2026
              <Fn n={25} first /> — and the VA OIG confirmed M365 Copilot
              Chat is provided to all VA staff.
              <Fn n={26} first />
            </p>
          }
          coda={
            <p>
              <EvidenceTag title="Time-sensitive: verify against the latest reporting before citing">
                date-anchored
              </EvidenceTag>{" "}
              The same January 2026 OIG memo found VHA had authorized GenAI
              tools for use with patient health information without
              patient-safety coordination — cite it alongside any VA-positive
              framing.
              <Fn n={26} />
            </p>
          }
          chips={[
            { label: "VA agency page", href: "/agencies/va" },
            { label: "VA GenAI use cases", href: ucUrl("VA", { isGenAI: true }) },
            { label: "Access & scale estimates", href: "/readiness/access" },
          ]}
        />
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        number="04"
        id="procured-not-built"
        title="Procured, not built"
        lede="In August 2025 GSA cut $1-per-agency OneGov deals with OpenAI, Anthropic, and Google. Some agencies got everyone frontier access in a single procurement stroke — no internal platform required."
        source="mixed"
      >
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          The OneGov agreements: OpenAI (Aug. 6),
          <Fn n={30} first /> Anthropic (Aug. 12),
          <Fn n={31} first /> Google (Aug. 21).
          <Fn n={32} first />
        </p>

        <StoryCard
          agency="OPM"
          persona="the HR policy analyst"
          coverage="~100%"
          then2024={
            <p>
              No enterprise chatbot; commercial tools sat outside the fence
              like everywhere else.
            </p>
          }
          now2025={
            <p>
              September 2025: Microsoft 365 Copilot Chat and ChatGPT (GPT-5)
              made available to the entire workforce via the OneGov
              agreements — the fastest zero-to-everyone arc in the dataset,
              and the only 100% coverage estimate in IFP&rsquo;s evidence
              table.
              <Fn n={28} first />
            </p>
          }
          coda={
            <p>
              <EvidenceTag title="Time-sensitive: verify against the latest reporting before citing">
                date-anchored
              </EvidenceTag>{" "}
              Access &ne; every vendor: by March 2026 OPM&rsquo;s disclosures
              dropped Claude while adding Grok and Codex.
              <Fn n={29} first />
            </p>
          }
          chips={[
            { label: "OPM agency page", href: "/agencies/opm" },
            { label: "Access & scale estimates", href: "/readiness/access" },
          ]}
        />

        <StoryCard
          agency="GSA"
          persona="the acquisition specialist"
          coverage="~61%"
          then2024={
            <p>
              No agency-wide assistant; GSAi existed as an internal build
              effort.
            </p>
          }
          now2025={
            <p>
              <strong>GSAi</strong> ramped from ~150 pilot users to 1,500 in
              March 2025
              <Fn n={34} first /> and then to all ~13,000 employees, with the
              deputy administrator reporting &ldquo;nearly half of agency
              employees are using GSAi every day&rdquo; — the best daily-usage
              (not just availability) figure in government.
              <Fn n={33} first /> GSA doubles as supplier: its USAi platform
              served 15 agencies as a free service, moving to paid in FY27.
              <Fn n={35} first />
            </p>
          }
          chips={[
            { label: "GSA agency page", href: "/agencies/gsa" },
            { label: "GSA GenAI use cases", href: ucUrl("GSA", { isGenAI: true }) },
          ]}
        />
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        number="05"
        id="unchanged-employee"
        title="The unchanged employee"
        lede="The mandate's unfinished business. At these agencies, IFP's web-corroborated coverage estimates put actual LLM access near zero — the AI is latent in a license, stuck in a pilot, or paused outright."
        source="derived"
      >
        <StoryCard
          agency="DOJ"
          persona="the line attorney"
          coverage="~1%"
          then2024={
            <p>
              AI features embedded in existing Westlaw and ServiceNow
              licenses; no general-purpose assistant.
            </p>
          }
          now2025={
            <p>
              Rated <em>latent</em> in IFP&rsquo;s evidence table: M365
              Copilot Chat sits inside the department&rsquo;s license
              entitlement with no announced rollout — technically in the
              building, effectively invisible.{" "}
              <EvidenceTag>IFP assessment</EvidenceTag> The inventory lists a
              department-wide Copilot entry still pre-deployment,
              <Fn n={36} first /> and a department-wide GitHub Copilot row
              that no public source corroborates.{" "}
              <EvidenceTag>uncorroborated</EvidenceTag>
            </p>
          }
          chips={[
            { label: "DOJ agency page", href: "/agencies/doj" },
            {
              label: "DOJ coding-tool entries",
              href: ucUrl("DOJ", { isCodingTool: true, entryKind: "all" }),
            },
          ]}
        />

        <StoryCard
          agency="HUD & SBA"
          persona="the program specialist"
          coverage="~0%"
          then2024={
            <p>
              Neither agency offered staff a general-purpose assistant.
            </p>
          }
          now2025={
            <p>
              <strong>HUD</strong>&rsquo;s own AI strategy describes Microsoft
              Copilot at pilot stage only — IFP&rsquo;s coverage estimate
              rounds to zero.
              <Fn n={37} first /> <strong>SBA</strong> paused AI use in March
              2025 with a handful of pilot exceptions and no general chat
              tool, per GAO-based reporting.
              <Fn n={38} first />
            </p>
          }
          coda={
            <p>
              These are the cases the AI Action Plan&rsquo;s
              certification-and-exception machinery exists for: not technical
              blockers, but priorities that never forced the question.
            </p>
          }
          chips={[
            { label: "HUD agency page", href: "/agencies/hud" },
            { label: "SBA agency page", href: "/agencies/sba" },
            { label: "Readiness league table", href: "/readiness#league-table" },
          ]}
        />
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        number="06"
        id="disappearing-act"
        title="The disappearing act"
        lede="What the inventory shows changing is sometimes the filing, not the capability. A transparency story: live 2024 GenAI entries that vanished from the 2025 inventory without a 'Retired' trace."
        source="mixed"
      >
        <StoryCard
          agency="Treasury / IRS"
          persona="the revenue agent"
          then2024={
            <p>
              On paper, a leader: enterprise Copilot pilots across business
              units, a ChatGPT Enterprise pilot at Treasury growing from 150
              to thousands of licenses,
              <Fn n={41} first /> and one of government&rsquo;s largest
              voicebot fleets answering taxpayer calls — which the IRS&rsquo;s
              own advisory committee urged consolidating to reduce taxpayer
              confusion.
              <Fn n={40} first />
            </p>
          }
          now2025={
            <p>
              In the public filing, the enterprise tier vanished: the Copilot
              pilots and granular voicebots returned as retired or
              consolidated rows. Yet GAO counted{" "}
              <strong>126 active IRS AI use cases as of June 2025</strong> (up
              from 10 in 2022; 65 too sensitive or exempt from public
              reporting) — the capability didn&rsquo;t collapse; the reporting
              changed shape.
              <Fn n={39} first />
            </p>
          }
          coda={
            <p>
              Corpus-wide, IFP&rsquo;s year-linkage found ~144 live-in-2024
              GenAI filings absent from 2025 with no Retired marker (~710 use
              cases overall, of which only 110 had been filed as Retired) — an
              agency-compliance finding, and the best single exhibit for what
              inventories do and don&rsquo;t reveal once AI is as common as
              email. <EvidenceTag>IFP assessment</EvidenceTag>
            </p>
          }
          chips={[
            { label: "IRS sub-agency page", href: "/agencies/treasury-irs" },
            { label: "2024 ↔ 2025 comparison", href: "/compare-years" },
            { label: "Silently-dropped entries", href: "/compare-years/silently-dropped" },
          ]}
        />

        <div className="mt-8 border-l-2 border-[var(--stamp)] pl-4 text-[15px] leading-relaxed text-foreground">
          <p>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)]">
              The through-line ·{" "}
            </span>
            In mid-2024 the modal federal employee had permission to use a
            chatbot on nothing that mattered. By late 2025 the modal employee
            at a large agency had a governed, internally operated assistant
            approved for the actual documents on their desk — while colleagues
            at DOJ, HUD, and SBA, and nearly every developer waiting for a
            coding agent, were still living in 2023. The coding gap is the
            next frontier: 57 individual coding-assistant filings, only four
            agencies at enterprise breadth, and a single mention of Claude
            Code in 3,549 use cases — one Interior line item filed alongside
            GitHub Copilot.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <MonoChip href="/analytics#coding" tone="stamp" size="xs">
              Coding-tool leaderboard
            </MonoChip>
            <MonoChip href={productUrl("GitHub Copilot")} tone="stamp" size="xs">
              GitHub Copilot
            </MonoChip>
            <MonoChip href={productUrl("Claude Code")} tone="stamp" size="xs">
              Claude Code
            </MonoChip>
            <MonoChip href="/fedramp/coverage" tone="stamp" size="xs">
              FedRAMP coverage
            </MonoChip>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        number="07"
        id="sources"
        title="Sources"
        lede="One entry per external source, reused across claims. Compiled 2026-07-03; every URL was taken from IFP's evidence tables or verified against the live source."
        source="derived"
      >
        <FootnoteList />

        <div className="mt-10 space-y-3 border-t border-border pt-6 text-[13px] leading-relaxed text-muted-foreground">
          <div className="eyebrow">Method &amp; caveats</div>
          <p>
            &ldquo;Validated&rdquo; here means: inventory rows carry IFP
            analytical tags that were re-audited row-by-row; availability
            claims are backed by an evidence table with verbatim quotes,
            source URLs, and confidence ratings; and coverage percentages are
            IFP estimates of <em>eligible</em> staff with access (headcount ×
            AI-eligible share), not usage. Growth comparisons carry a
            structural caveat: the 2025 cycle moved most commercial
            off-the-shelf tools into a separate ~900-row consolidated appendix
            that 2024 lacked. See{" "}
            <Link href="/readiness/methodology" className="underline underline-offset-2 hover:text-foreground">
              methodology
            </Link>{" "}
            and the{" "}
            <Link href="/about" className="underline underline-offset-2 hover:text-foreground">
              colophon
            </Link>
            .
          </p>
          <p>
            One widely repeated claim was dropped for lack of corroboration:
            testimony that VA developers save ~8 hours/week with GitHub
            Copilot could not be located in any primary or press source.
            Statistics on this page are fixed to the June 2026 article fact
            sheet so each number stays tied to its citation; the linked charts
            and filtered views elsewhere on this site are live and may drift
            slightly as the database is corrected.
          </p>
        </div>
      </Section>
    </main>
  );
}

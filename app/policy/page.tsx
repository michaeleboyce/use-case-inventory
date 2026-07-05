// app/policy/page.tsx — top-level /policy section.

import { Section, Figure } from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { StatTile } from "@/components/stat-tile";
import { formatDate, formatNumber } from "@/lib/formatting";
import { buildPolicyViewModel } from "./_view-model";
import { ComplianceScorecard } from "./_sections/compliance-scorecard";
import { PagesByAgencyChart } from "./_sections/pages-by-agency-chart";
import { DocumentDirectory } from "./_sections/document-directory";
import { GoverningDocsBlock } from "./_sections/governing-docs-block";

export const metadata = { title: "Federal AI Policy" };

export default async function PolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ agency?: string | string[] }>;
}) {
  const vm = await buildPolicyViewModel();
  const sp = await searchParams;
  const rawAgency = Array.isArray(sp.agency) ? sp.agency[0] : sp.agency;
  // Only honor the param if it matches a known agency in the directory, so a
  // bad deep link degrades to the unfiltered table instead of an empty one.
  const initialAgency = vm.documents.some((d) => d.agency_abbr === rawAgency)
    ? rawAgency
    : undefined;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <PageMasthead
        kicker="§ VI · Features · Policy"
        metaLines={[
          "M-25-21 Compliance",
          `Last refreshed ${formatDate(vm.stats.last_refreshed)}`,
        ]}
        title={
          <>
            Federal AI
            <br />
            policy.
          </>
        }
        lede={`What ${vm.stats.total_agencies} agencies have published in response to the executive orders and OMB memoranda governing federal AI — strategies, compliance plans, and the page counts behind them.`}
        dropCap
      />

      <Section
        number="I"
        title="By the numbers"
        lede="Agency-issued AI policy, counted."
        source="derived"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <StatTile
            label="Pages of policy"
            value={formatNumber(vm.stats.total_pages)}
            sublabel="agency-issued only"
            accent="stamp"
          />
          <StatTile
            label="Documents"
            value={vm.stats.total_documents}
            sublabel="agency-issued only"
          />
          <StatTile
            label="M-25-21 strategies"
            value={`${vm.stats.strategies_published} / ${vm.stats.total_agencies}`}
            sublabel="public agency strategy"
            accent="verified"
          />
          <StatTile
            label="M-25-21 compliance plans"
            value={`${vm.stats.plans_published} / ${vm.stats.total_agencies}`}
            sublabel="public agency plan"
          />
        </div>
      </Section>

      <Section
        number="II"
        title="Compliance"
        lede="Who has published what, and how much of it."
        source="derived"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Figure eyebrow="Fig. 1 · Compliance scorecard">
            <ComplianceScorecard rows={vm.compliance} />
          </Figure>
          <Figure eyebrow="Fig. 2 · Pages of policy by agency">
            <PagesByAgencyChart rows={vm.pagesByAgency} />
          </Figure>
        </div>
      </Section>

      <Section
        number="III"
        title="The directory"
        lede="Every located agency-issued AI policy document."
        source="derived"
        id="documents"
      >
        <DocumentDirectory
          documents={vm.documents}
          initialAgency={initialAgency}
        />
      </Section>

      <Section
        number="IV"
        title="Governing documents"
        lede="The White House and OMB foundation agencies respond to."
        source="omb"
      >
        <GoverningDocsBlock governing={vm.governing} />
      </Section>

      <Section
        number="V"
        title="Methodology"
        lede="How the documents were located and counted."
        source="derived"
        id="methodology"
      >
        <div className="max-w-prose text-[0.95rem] leading-[1.6] text-muted-foreground">
          <p>
            Coverage is the {vm.stats.total_agencies} agencies that filed a
            2025 AI use case inventory, plus the Department of Defense
            (inventory-exempt but a major AI-strategy publisher). For each
            agency, parallel research sweeps located the AI landing page,
            identified every formal AI strategy or policy document published
            since 2023, and recorded the publication year, source URL, and
            mapping to the M-24-10 / M-25-21 required-artifact set. PDF page
            counts are exact; web-page documents are estimated at ~500 words
            per page. The full source tracker (CSVs, per-agency research
            notes, and the downloaded originals) lives in the ETL workspace
            under <code>audit/research/ai_strategies/</code>.
          </p>
        </div>
      </Section>
    </main>
  );
}

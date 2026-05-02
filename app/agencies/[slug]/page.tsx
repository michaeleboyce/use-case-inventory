import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import {
  getAgencyByAbbr,
  getAgencyById,
  getAgencyAtoScope,
  getUseCasesForAgency,
  getUseCasesForOrgSubtree,
  getConsolidatedForAgency,
  getProductsForAgency,
  getBureauBreakdown,
  getEntryTypeBreakdown,
  getAISophisticationBreakdown,
  getDeploymentScopeBreakdown,
} from "@/lib/db";
import {
  getOrganizationBySlugOrAbbr,
  getOrganizationBreadcrumbs,
  getChildOrgRollups,
  getMaturityForOrg,
} from "@/lib/hierarchy-db";
import { HierarchyBreadcrumbs } from "@/components/hierarchy";
import type {
  FederalOrganization,
  AgencyWithMaturity,
  OrgWithUseCaseCount,
  UseCaseWithTags,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  formatNumber,
  formatPercent,
  formatYoY,
  formatDate,
  agencyTypeLabel,
  maturityTierLabel,
} from "@/lib/formatting";

import { AgencyHeader } from "@/components/agency-header";
import { CapabilityFlags } from "@/components/capability-flags";
import { ProductGrid } from "@/components/product-grid";
import { BureauBreakdown } from "@/components/bureau-breakdown";
import {
  IndividualUseCasesTable,
  ConsolidatedUseCasesTable,
} from "@/components/agency-use-cases-table";
import { DonutChart } from "@/components/charts/donut-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { MetricTile } from "@/components/metric-tile";

import {
  Section,
  Figure,
  Eyebrow,
  MonoChip,
  ENTRY_TYPE_COLORS,
  ENTRY_TYPE_LABELS,
  SOPHISTICATION_COLORS,
  SOPHISTICATION_LABELS,
  SCOPE_COLORS,
  SCOPE_LABELS,
} from "@/components/editorial";
import { agencyUseCasesUrl } from "@/lib/urls";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = getOrganizationBySlugOrAbbr(slug);
  if (!org) return { title: "Agency not found" };
  return {
    title: `${org.abbreviation ?? org.name} — ${org.name} | Federal AI Inventory`,
    description: `2025 AI use case inventory for ${org.name}`,
  };
}

export default async function AgencyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = getOrganizationBySlugOrAbbr(slug);
  if (!org) notFound();

  // Branch on whether this is a top-level org (department / independent) with
  // a legacy_agency_id pointer, or a sub-agency / office.
  if (org.legacy_agency_id != null) {
    const agency = getAgencyById(org.legacy_agency_id);
    if (!agency) notFound();
    return <TopLevelOrgPage org={org} agency={agency} />;
  }
  return <SubOrgPage org={org} />;
}

// ---------------------------------------------------------------------------
// Top-level org rendering (departments + independent agencies)
// ---------------------------------------------------------------------------

function TopLevelOrgPage({
  org,
  agency,
}: {
  org: FederalOrganization;
  agency: AgencyWithMaturity;
}) {
  const maturity = agency.maturity;
  const individual = getUseCasesForAgency(agency.id);
  const consolidated = getConsolidatedForAgency(agency.id);
  const products = getProductsForAgency(agency.id);
  const bureaus = getBureauBreakdown(agency.id);
  const entryTypeBreakdown = getEntryTypeBreakdown(agency.id);
  const sophisticationBreakdown = getAISophisticationBreakdown(agency.id);
  const scopeBreakdown = getDeploymentScopeBreakdown(agency.id);
  const fedrampScope = getAgencyAtoScope(agency.id);
  const fedrampDistinctCsps = new Set(fedrampScope.map((s) => s.csp_slug)).size;
  const fedrampInInventoryCount = fedrampScope.filter(
    (s) => s.appears_in_inventory === 1,
  ).length;
  const childOrgs = getChildOrgRollups(org.id);
  const breadcrumbs = getOrganizationBreadcrumbs(org.id);

  const totalEntries =
    (maturity?.total_use_cases ?? individual.length) +
    (maturity?.total_consolidated_entries ?? consolidated.length);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      <HierarchyBreadcrumbs breadcrumbs={breadcrumbs} className="mb-6" />
      <AgencyHeader agency={agency} />

      {/* Ledger row */}
      <section className="ink-in mt-10 grid grid-cols-2 gap-4 md:mt-14 md:grid-cols-4 lg:grid-cols-7">
        <MetricTile
          label="Individual use cases"
          value={individual.length}
          href={agencyUseCasesUrl(agency.id)}
        />
        <MetricTile
          label="Consolidated entries"
          value={consolidated.length}
          href={agencyUseCasesUrl(agency.id)}
        />
        <MetricTile
          label="Distinct products"
          value={maturity?.distinct_products_deployed ?? 0}
          href={agencyUseCasesUrl(agency.id)}
        />
        <MetricTile
          label="General LLM"
          value={maturity?.general_llm_count ?? 0}
          href={agencyUseCasesUrl(agency.id, { isGeneralLLMAccess: true })}
        />
        <MetricTile
          label="Coding tools"
          value={maturity?.coding_tool_count ?? 0}
          href={agencyUseCasesUrl(agency.id, { isCodingTool: true })}
        />
        <MetricTile
          label="Agentic AI"
          value={maturity?.agentic_ai_count ?? 0}
          href={agencyUseCasesUrl(agency.id, { aiSophistications: ["agentic"] })}
        />
        <MetricTile
          label="YoY growth"
          value={maturity?.year_over_year_growth ?? 0}
          sublabel={formatYoY(maturity?.year_over_year_growth ?? null)}
        />
      </section>

      {/* § I · Portfolio */}
      <Section
        number="I"
        title="Portfolio"
        lede={`How this agency's ${formatNumber(totalEntries)} reported AI uses break down.`}
      >
        <div className="grid gap-x-6 gap-y-10 md:grid-cols-3">
          <Figure
            eyebrow="Fig. 1 · Entry type"
            caption="Share of entries by structural shape."
          >
            <DonutChart
              data={entryTypeBreakdown}
              colorMap={ENTRY_TYPE_COLORS}
              height={260}
              centerSubLabel="entries"
            />
            <BreakdownChips
              agencyId={agency.id}
              rows={entryTypeBreakdown}
              labels={ENTRY_TYPE_LABELS}
              filterKey="entryTypes"
            />
          </Figure>
          <Figure
            eyebrow="Fig. 2 · AI sophistication"
            caption="Share of entries by AI classification tag."
          >
            <DonutChart
              data={sophisticationBreakdown}
              colorMap={SOPHISTICATION_COLORS}
              height={260}
              centerSubLabel="tagged"
            />
            <BreakdownChips
              agencyId={agency.id}
              rows={sophisticationBreakdown}
              labels={SOPHISTICATION_LABELS}
              filterKey="aiSophistications"
            />
          </Figure>
          <Figure
            eyebrow="Fig. 3 · Deployment scope"
            caption="Where the system is available, by scope."
          >
            <HorizontalBarChart
              data={scopeBreakdown}
              colorMap={SCOPE_COLORS}
              height={260}
              labelWidth={120}
            />
            <BreakdownChips
              agencyId={agency.id}
              rows={scopeBreakdown}
              labels={SCOPE_LABELS}
              filterKey="deploymentScopes"
            />
          </Figure>
        </div>
      </Section>

      {/* § II · Capabilities */}
      <Section
        number="II"
        title="Capabilities"
        lede="What the 2025 inventory shows this agency has — and does not have."
      >
        <CapabilityFlags maturity={maturity} />
      </Section>

      {/* § III · Products deployed */}
      <Section
        number="III"
        title="Products deployed"
        lede="Canonical AI products linked across this agency's use cases."
      >
        <ProductGrid products={products} agencyId={agency.id} />
      </Section>

      {/* § IV · Sub-agencies — conditionally rendered when the hierarchy
          knows of children. Replaces the older string-based bureau breakdown
          for top-level agencies that have a populated org tree. */}
      {childOrgs.length > 0 ? (
        <Section
          number="IV"
          title="Sub-agencies"
          lede="Bureaus, labs, centers, and offices within this agency, with their own AI use-case rollups."
        >
          <SubAgencyRollupGrid orgs={childOrgs} />
        </Section>
      ) : null}

      {/* § IV′ · Legacy bureau breakdown — fallback when no hierarchy children
          exist (small/independent agencies). */}
      {childOrgs.length === 0 && bureaus.length > 0 ? (
        <Section
          number="IV"
          title="Bureau breakdown"
          lede="Use case counts by bureau or component."
        >
          <BureauBreakdown rows={bureaus} agencyId={agency.id} />
        </Section>
      ) : null}

      {/* § V · Use cases */}
      <Section
        number={(bureaus.length > 0 || childOrgs.length > 0) ? "V" : "IV"}
        title="Use cases"
        lede="Every 2025 entry linked to this agency."
      >
        <Tabs defaultValue="individual">
          <TabsList className="flex h-auto w-full justify-start gap-0 border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="individual"
              className="h-auto rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Individual ({formatNumber(individual.length)})
            </TabsTrigger>
            <TabsTrigger
              value="consolidated"
              className="h-auto rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Consolidated ({formatNumber(consolidated.length)})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="individual" className="pt-6">
            <IndividualUseCasesTable rows={individual} />
          </TabsContent>
          <TabsContent value="consolidated" className="pt-6">
            <ConsolidatedUseCasesTable rows={consolidated} />
          </TabsContent>
        </Tabs>
      </Section>

      {/* § VI · Colophon — filing metadata */}
      <Section
        number={(bureaus.length > 0 || childOrgs.length > 0) ? "VI" : "V"}
        title="Colophon"
        lede="Filing metadata for this record."
      >
        <div className="border-t-2 border-foreground pt-4">
          <Eyebrow color="stamp">§ Filing</Eyebrow>
          <dl className="mt-3 grid gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.12em] sm:grid-cols-2">
            <Colophon label="Agency type" value={agencyTypeLabel(agency.agency_type)} />
            <Colophon label="Status" value={agency.status ?? "—"} />
            <Colophon
              label="Maturity tier"
              value={maturityTierLabel(maturity?.maturity_tier ?? null)}
            />
            <Colophon
              label="Schema compliance"
              value={
                agency.schema_compliance != null
                  ? formatPercent(agency.schema_compliance)
                  : "—"
              }
            />
            <Colophon label="Last modified" value={formatDate(agency.last_modified)} />
            <Colophon label="Date accessed" value={formatDate(agency.date_accessed)} />
          </dl>

          {agency.notes ? (
            <div className="mt-6 border-t border-dotted border-border pt-4">
              <Eyebrow>Notes</Eyebrow>
              <p className="mt-2 whitespace-pre-wrap font-body text-sm leading-relaxed text-foreground/90">
                {agency.notes}
              </p>
            </div>
          ) : null}

          {agency.csv_download_url ? (
            <div className="mt-6 border-t border-dotted border-border pt-4">
              <Link
                href={agency.csv_download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground hover:text-[var(--stamp)]"
              >
                Source CSV
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>
      </Section>

      {/* § VII (or VI) · FedRAMP authorization scope */}
      <Section
        number={(bureaus.length > 0 || childOrgs.length > 0) ? "VII" : "VI"}
        title="FedRAMP authorization scope"
        lede="FedRAMP-authorized cloud products linked to this agency's curated AI inventory. Shows only AI-relevant products (linked to a use-case via the curation queue), not the agency's full ATO portfolio."
      >
        {fedrampScope.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            — No AI-linked FedRAMP authorizations on file for this agency —
          </p>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-x-6 border-y-2 border-foreground py-4">
              <FedrampStat
                label="AI product ATOs"
                value={fedrampScope.length}
              />
              <FedrampStat
                label="Distinct CSPs"
                value={fedrampDistinctCsps}
              />
              <FedrampStat
                label="AI products in scope"
                value={fedrampInInventoryCount}
                sub={`of ${formatNumber(fedrampScope.length)} authorized`}
              />
            </div>

            <div>
              <Eyebrow color="stamp">§ AI-linked FedRAMP products</Eyebrow>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {fedrampScope.slice(0, 50).map((s) => (
                  <li
                    key={s.fedramp_id}
                    className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 py-3"
                  >
                    <Link
                      href={`/fedramp/marketplace/products/${s.fedramp_id}`}
                      className="group min-w-0 hover:text-[var(--stamp)]"
                    >
                      <div className="font-display italic text-[1.05rem] leading-tight text-foreground group-hover:text-[var(--stamp)]">
                        {s.cso}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {s.csp}
                      </div>
                    </Link>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                      {s.impact_level ?? "—"}
                    </span>
                    <Badge
                      variant={
                        s.appears_in_inventory === 1 ? "default" : "outline"
                      }
                      title={
                        s.appears_in_inventory === 1
                          ? "Appears in this agency's AI inventory"
                          : "Authorized but not reported in this agency's AI inventory"
                      }
                    >
                      {s.appears_in_inventory === 1
                        ? "In inventory"
                        : "Not in inventory"}
                    </Badge>
                  </li>
                ))}
              </ul>
              {fedrampScope.length > 50 ? (
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Showing first 50 of {formatNumber(fedrampScope.length)} authorizations.
                </p>
              ) : null}
            </div>

            <div>
              <Link
                href={`/fedramp/coverage/agencies/${agency.abbreviation}`}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:text-[var(--stamp)]"
              >
                Full per-agency drill →
              </Link>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function BreakdownChips({
  agencyId,
  rows,
  labels,
  filterKey,
}: {
  agencyId: number;
  rows: { label: string; count: number }[];
  labels: Record<string, string>;
  filterKey: "entryTypes" | "aiSophistications" | "deploymentScopes";
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        Jump to filtered:
      </span>
      {rows.map((row) => (
        <MonoChip
          key={row.label}
          href={agencyUseCasesUrl(agencyId, { [filterKey]: [row.label] })}
          tone="stamp"
          size="xs"
          title={`${labels[row.label] ?? row.label} (${row.count})`}
        >
          {(labels[row.label] ?? row.label)} ({formatNumber(row.count)})
        </MonoChip>
      ))}
    </div>
  );
}

function FedrampStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-[2.2rem] leading-none tabular-nums text-foreground md:text-[2.6rem]">
        {formatNumber(value)}
      </div>
      {sub ? (
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Colophon({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-agency rollup grid (used inside top-level org pages)
// ---------------------------------------------------------------------------

function SubAgencyRollupGrid({ orgs }: { orgs: OrgWithUseCaseCount[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {orgs.map((o) => {
        const total = o.descendant_use_case_count ?? o.use_case_count;
        const subLabel = o.child_count > 0
          ? `${o.use_case_count} direct · ${total} w/ sub-orgs`
          : `${total} use cases`;
        return (
          <li key={o.id}>
            <Link
              href={`/agencies/${o.slug}`}
              className="group flex items-baseline justify-between gap-3 border-t-2 border-foreground py-3 hover:border-[var(--stamp)]"
            >
              <div className="min-w-0">
                <p className="font-display italic text-[1.1rem] leading-tight tracking-[-0.01em] text-foreground group-hover:text-[var(--stamp)]">
                  {o.name}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {o.abbreviation ?? o.level.replace(/_/g, " ")}
                  {" · "}
                  {subLabel}
                </p>
              </div>
              <span className="shrink-0 font-display text-[1.6rem] leading-none tabular-nums text-foreground">
                {formatNumber(total)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Sub-agency / office page (no separate AgencyHeader; lighter chrome)
// ---------------------------------------------------------------------------

function SubOrgPage({ org }: { org: FederalOrganization }) {
  const breadcrumbs = getOrganizationBreadcrumbs(org.id);
  const useCases: UseCaseWithTags[] = getUseCasesForOrgSubtree(org.id);
  const childOrgs = getChildOrgRollups(org.id);
  const orgMaturity = getMaturityForOrg(org.id);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      <HierarchyBreadcrumbs breadcrumbs={breadcrumbs} className="mb-6" />

      <header className="ink-in border-b border-border pb-10 md:pb-12">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--stamp)]">
            § {org.level.replace(/_/g, " ")}
          </span>
          {org.abbreviation && (
            <MonoChip tone="muted" size="xs">
              {org.abbreviation}
            </MonoChip>
          )}
          {orgMaturity?.maturity_tier && (
            <MonoChip tone="stamp" size="xs">
              {maturityTierLabel(orgMaturity.maturity_tier)}
            </MonoChip>
          )}
        </div>
        <h1 className="mt-3 font-display italic text-[clamp(2.4rem,5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-foreground">
          {org.name}
        </h1>
        {org.description && !org.description.includes("[seeded:") ? (
          <p className="mt-4 max-w-prose text-[1rem] leading-relaxed text-foreground/85">
            {org.description}
          </p>
        ) : null}
      </header>

      {/* Maturity ledger if computed for this org */}
      {orgMaturity ? (
        <section className="ink-in mt-10 grid grid-cols-2 gap-4 md:mt-14 md:grid-cols-4">
          <MetricTile
            label="Use cases (subtree)"
            value={useCases.length}
          />
          <MetricTile
            label="General LLM"
            value={orgMaturity.general_llm_count ?? 0}
          />
          <MetricTile
            label="Coding tools"
            value={orgMaturity.coding_tool_count ?? 0}
          />
          <MetricTile
            label="Agentic AI"
            value={orgMaturity.agentic_ai_count ?? 0}
          />
        </section>
      ) : (
        <section className="ink-in mt-10 grid grid-cols-2 gap-4 md:mt-14 md:grid-cols-4">
          <MetricTile label="Use cases (subtree)" value={useCases.length} />
        </section>
      )}

      {/* Children of this sub-org, if any */}
      {childOrgs.length > 0 ? (
        <Section
          number="I"
          title="Sub-units"
          lede="Offices and components within this bureau."
        >
          <SubAgencyRollupGrid orgs={childOrgs} />
        </Section>
      ) : null}

      {/* Use cases scoped to this org's subtree */}
      <Section
        number={childOrgs.length > 0 ? "II" : "I"}
        title="Use cases"
        lede="Every 2025 entry whose bureau matches this organization or any of its descendants."
      >
        {useCases.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            — No bureau-tagged use cases found for this organization —
          </p>
        ) : (
          <IndividualUseCasesTable rows={useCases} />
        )}
      </Section>
    </div>
  );
}

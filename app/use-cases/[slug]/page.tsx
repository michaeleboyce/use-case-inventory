import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getUseCaseOrConsolidatedBySlug,
  getProductById,
  getProductsForUseCase,
  getProductsForConsolidatedUseCase,
  getTemplateById,
  getAgencyByAbbr,
  getRelatedByAgency,
  getRelatedByProduct,
  getRelatedByTemplate,
  getExternalEvidenceForUseCase,
  getExternalEvidenceForConsolidated,
  getUseCaseFedrampCoverage,
} from "@/lib/db";
import { FedrampCoverageBadge } from "@/components/FedrampCoverageBadge";
import { getOrganizationById } from "@/lib/hierarchy-db";
import type {
  ConsolidatedWithTags,
  UseCaseWithTags,
} from "@/lib/types";
import { RawJsonViewer } from "@/components/raw-json-viewer";
import { TagDefinitionList } from "@/components/tag-definition-list";
import { RelatedUseCases } from "@/components/related-use-cases";
import { Section, MonoChip, SourceLegend } from "@/components/editorial";
import type { SectionSource } from "@/components/editorial";
import {
  ExternalEvidenceBadge,
  ExternalEvidenceList,
} from "@/components/external-evidence";
import { formatBoolFlag } from "@/lib/formatting";
import {
  ArrowLeft,
  Code2,
  ExternalLink,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = getUseCaseOrConsolidatedBySlug(slug);
  if (!resolved) return { title: "Use case not found" };
  const name =
    resolved.kind === "use_case"
      ? resolved.data.use_case_name
      : resolved.data.ai_use_case;
  return {
    title: `${name} · Federal AI Inventory`,
  };
}

export default async function UseCaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = getUseCaseOrConsolidatedBySlug(slug);
  if (!resolved) return notFound();

  if (resolved.kind === "consolidated") {
    return <ConsolidatedDetail data={resolved.data} />;
  }
  return <IndividualDetail data={resolved.data} />;
}

// ---------------------------------------------------------------------------
// Individual use case
// ---------------------------------------------------------------------------

function IndividualDetail({ data }: { data: UseCaseWithTags }) {
  const tags = data.tags;
  const related = getRelatedByAgency(data.agency_id, data.id, 5);
  const productRelated =
    data.product_id != null
      ? getRelatedByProduct(data.product_id, data.id, 5)
      : [];
  const templateRelated =
    data.template_id != null
      ? getRelatedByTemplate(data.template_id, data.id, 5)
      : [];

  const agency = data.agency_abbreviation
    ? getAgencyByAbbr(data.agency_abbreviation)
    : null;
  // Agent D (plan §D.6): render all products linked via use_case_products,
  // not just the single use_cases.product_id. The legacy ``product`` value
  // remains the primary linkage for the section header; ``linkedProducts``
  // covers multi-product cases (e.g. "AWS (Textract + Bedrock)").
  const linkedProducts = getProductsForUseCase(data.id);
  const product =
    data.product_id != null ? getProductById(data.product_id) : null;
  const template =
    data.template_id != null ? getTemplateById(data.template_id) : null;
  const externalEvidence = getExternalEvidenceForUseCase(data.id);
  const fedrampCoverage = getUseCaseFedrampCoverage(data.id);
  const bureauOrg =
    data.bureau_organization_id != null
      ? getOrganizationById(data.bureau_organization_id)
      : null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      {/* Editorial hero */}
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-10 md:pb-14">
        <aside className="col-span-12 mb-6 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-3">
            <BackLink />
            <div className="eyebrow !text-[var(--stamp)]">§ Entry · Use Case</div>
            {data.use_case_id && (
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                No.{" "}
                <span className="tabular-nums text-foreground">
                  {data.use_case_id}
                </span>
              </div>
            )}
            {data.agency_abbreviation && (
              <div>
                <MonoChip
                  href={`/agencies/${data.agency_abbreviation}`}
                  tone="stamp"
                  size="sm"
                >
                  {data.agency_abbreviation}
                </MonoChip>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {tags?.entry_type && (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground">
                  {tags.entry_type.replace(/_/g, " ")}
                </span>
              )}
              {tags?.deployment_scope && (
                <>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ·
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground">
                    {tags.deployment_scope.replace(/_/g, " ")}
                  </span>
                </>
              )}
            </div>
            {tags?.high_impact_designation === "high_impact" && (
              <div className="relative inline-flex w-fit">
                <div className="stamp">High impact</div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {tags?.is_coding_tool === 1 && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <Code2 className="size-3 text-[var(--stamp)]" aria-hidden />
                  Coding tool
                </span>
              )}
              {tags?.is_general_llm_access === 1 && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <Sparkles
                    className="size-3 text-[var(--verified)]"
                    aria-hidden
                  />
                  General LLM
                </span>
              )}
              {tags?.has_ato_or_fedramp === 1 && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <ShieldCheck
                    className="size-3 text-[var(--verified)]"
                    aria-hidden
                  />
                  ATO / FedRAMP
                </span>
              )}
              <ExternalEvidenceBadge evidence={externalEvidence} />
            </div>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.2rem] leading-[1.02] tracking-[-0.02em] text-foreground md:text-[3.4rem]">
            {data.use_case_name}
          </h1>
          {agency && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <Link
                href={`/agencies/${data.agency_abbreviation}`}
                className="hover:text-[var(--stamp)]"
              >
                {agency.name}
              </Link>
              {data.bureau_component ? (
                <>
                  {" · "}
                  {bureauOrg ? (
                    <Link
                      href={`/agencies/${bureauOrg.slug}`}
                      className="text-foreground hover:text-[var(--stamp)]"
                      title={bureauOrg.name}
                    >
                      {data.bureau_component}
                    </Link>
                  ) : (
                    <span className="text-foreground">
                      {data.bureau_component}
                    </span>
                  )}
                </>
              ) : null}
            </p>
          )}
          {agency && (
            <SourceInventoryLinks
              inventoryUrl={agency.inventory_page_url}
              csvUrl={agency.csv_download_url}
              sourceFile={data.source_file}
            />
          )}
          {data.problem_statement && (
            <p className="mt-6 max-w-[62ch] text-[1rem] leading-relaxed text-foreground/85">
              {data.problem_statement}
            </p>
          )}
        </div>
      </header>

      <SourceLegend />

      {/* Sections */}
      <Section
        number="I"
        title="Summary"
        source="omb"
        lede="The filing card: bureau, stage, topic area, and the agency's own justification for high-impact status."
      >
        <DL>
          <Row label="Bureau / component" value={data.bureau_component} />
          <Row label="Stage of development" value={data.stage_of_development} />
          <Row label="Topic area" value={data.topic_area} />
          <Row label="Operational date" value={data.operational_date} />
          <Row
            label="High-impact (reported)"
            value={data.is_high_impact}
          />
          <Row label="Justification" value={data.justification} multiline />
        </DL>
      </Section>

      <Section
        number="II"
        title="External corroboration"
        source="derived"
        lede="What we know about this entry from sources outside the inventory itself — press, agency announcements, vendor case studies, or web searches."
      >
        <ExternalEvidenceList evidence={externalEvidence} />
      </Section>

      <Section
        number="III"
        title="AI classification"
        source="mixed"
        lede="How the entry describes its own AI — and how we've re-classified it analytically."
      >
        <DL>
          <Row
            label="Classification (reported)"
            value={data.ai_classification}
            multiline
            source="omb"
          />
          <Row
            label="AI sophistication"
            value={tags?.ai_sophistication?.replace(/_/g, " ") ?? null}
            source="derived"
          />
          <Row
            label="Generative AI"
            value={boolText(tags?.is_generative_ai)}
            source="derived"
          />
          <Row
            label="Frontier model"
            value={boolText(tags?.is_frontier_model)}
            source="derived"
          />
        </DL>
      </Section>

      <Section
        number="IV"
        title="Problem &amp; benefits"
        source="omb"
        lede="The narrative fields — what the system does, what it's meant to improve, and what it outputs."
      >
        <div className="flex flex-col gap-6">
          <TextBlock label="Problem statement" value={data.problem_statement} />
          <TextBlock label="Expected benefits" value={data.expected_benefits} />
          <TextBlock label="System outputs" value={data.system_outputs} />
        </div>
      </Section>

      <Section
        number="V"
        title="Documentation"
        source="omb"
        lede="Development posture, vendor, and authority-to-operate status."
      >
        <DL>
          <Row label="Development type" value={data.development_type} />
          <Row label="Vendor" value={data.vendor_name} />
          <Row label="System name" value={data.system_name} />
          <Row label="Has ATO (reported)" value={data.has_ato} />
          <Row
            label="Training data"
            value={data.training_data_description}
            multiline
          />
        </DL>
      </Section>

      <Section
        number="VI"
        title="Data &amp; code"
        source="omb"
        lede="PII exposure, data catalog entries, and open-source disclosures."
      >
        <DL>
          <Row label="Involves PII" value={data.has_pii} />
          <Row
            label="Federal data catalog"
            value={externalLink(data.link_to_data)}
            raw
          />
          <Row
            label="Privacy Impact Assessment"
            value={externalLink(data.pia_url)}
            raw
          />
          <Row
            label="Demographic variables"
            value={data.demographic_features}
            multiline
          />
          <Row label="Has custom code" value={data.has_custom_code} />
          <Row
            label="Open-source link"
            value={externalLink(data.code_url)}
            raw
          />
        </DL>
      </Section>

      <Section
        number="VII"
        title="Risk management"
        source="omb"
        lede="Testing, monitoring, training, and the appeal / feedback machinery required under M-25-21."
      >
        <DL columns={2}>
          <Row
            label="Pre-deployment testing"
            value={data.hi_testing_conducted}
            multiline
          />
          <Row
            label="Impact assessment"
            value={data.hi_assessment_completed}
            multiline
          />
          <Row
            label="Potential impacts"
            value={data.hi_potential_impacts}
            multiline
          />
          <Row
            label="Independent review"
            value={data.hi_independent_review}
            multiline
          />
          <Row
            label="Ongoing monitoring"
            value={data.hi_ongoing_monitoring}
            multiline
          />
          <Row
            label="Operator training"
            value={data.hi_training_established}
            multiline
          />
          <Row label="Fail-safe" value={data.hi_failsafe_presence} />
          <Row label="Appeal process" value={data.hi_appeal_process} multiline />
          <Row
            label="End-user feedback"
            value={data.hi_public_consultation}
            multiline
          />
        </DL>
      </Section>

      <Section
        number="VIII"
        title="Analytical tags"
        source="derived"
        lede="Every derived tag we attach to this entry, with a short definition of each field."
      >
        <TagDefinitionList tags={tags} />
      </Section>

      {(product || linkedProducts.length > 0) && (
        <Section
          number="IX"
          title={
            linkedProducts.length > 1 ? "Linked products" : "Linked product"
          }
          source="derived"
          lede={
            linkedProducts.length > 1
              ? "Every canonical product evidenced by this entry's vendor, system, name, or problem-statement text."
              : "The commercial product (or in-house system) this entry deploys."
          }
        >
          <ul className="flex flex-col divide-y divide-border border-t-2 border-foreground">
            {(linkedProducts.length > 0
              ? linkedProducts
              : product
                ? [
                    {
                      id: product.id,
                      canonical_name: product.canonical_name,
                      vendor: product.vendor,
                      description: product.description,
                      evidence_text: null,
                      confidence: null,
                    },
                  ]
                : []
            ).map((p) => (
              <li key={p.id} className="py-4 first:pt-4">
                <Link
                  href={`/products/${p.id}`}
                  className="group flex items-start justify-between gap-3 hover:text-[var(--stamp)]"
                >
                  <div>
                    <p className="font-display italic text-[1.4rem] leading-tight tracking-[-0.01em] text-foreground group-hover:text-[var(--stamp)]">
                      {p.canonical_name}
                    </p>
                    {p.vendor && (
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {p.vendor}
                        {p.confidence ? ` · ${p.confidence} evidence` : ""}
                      </p>
                    )}
                    {p.description && (
                      <p className="mt-2 line-clamp-3 max-w-[62ch] text-[13px] leading-snug text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <ExternalLink
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {template && (
        <Section
          number={product ? "X" : "IX"}
          title="Linked template"
          source="derived"
          lede="The canonical phrasing this entry matches — a useful handle for discovering similar work elsewhere."
        >
          <div className="flex flex-col gap-3 border-t-2 border-foreground pt-4">
            <p className="font-display italic text-[1.4rem] leading-tight tracking-[-0.01em] text-foreground">
              “{template.template_text}”
            </p>
            <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>
                {template.short_name ?? "Template"}
                {template.capability_category
                  ? ` · ${template.capability_category}`
                  : ""}
              </span>
              <Link
                href={`/templates/${template.id}`}
                className="text-foreground hover:text-[var(--stamp)]"
              >
                View template →
              </Link>
            </div>
          </div>
        </Section>
      )}

      <Section
        number={templateOrProductNextNumber(!!product, !!template)}
        title="Related filings"
        source="derived"
        lede="Other entries with the same agency, product, or template."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <RelatedUseCases
            title="More from this agency"
            items={related}
            emptyMessage="No other entries for this agency."
          />
          <RelatedUseCases
            title="Same product"
            items={productRelated}
            emptyMessage={
              product
                ? "No other entries using this product."
                : "No product linked."
            }
          />
          <RelatedUseCases
            title="Same template"
            items={templateRelated}
            emptyMessage={
              template
                ? "No other entries using this template."
                : "No template linked."
            }
          />
        </div>
      </Section>

      <Section
        number={rawNumber(!!product, !!template)}
        title="Raw record"
        source="omb"
        lede="The source JSON, preserved untouched for auditability."
      >
        <RawJsonViewer json={data.raw_json} />
      </Section>

      <Section
        number={fedrampNumber(!!product, !!template)}
        title="FedRAMP coverage"
        source="derived"
        lede="Whether this entry's product is FedRAMP-authorized — and whether the using agency is named in the ATO scope."
      >
        <FedrampCoverageSection coverage={fedrampCoverage} />
      </Section>
    </div>
  );
}

/** Figure out which Roman numeral to give the "Related filings" section
 *  depending on whether product/template sections exist. */
function templateOrProductNextNumber(hasProduct: boolean, hasTemplate: boolean) {
  if (hasProduct && hasTemplate) return "XI";
  if (hasProduct || hasTemplate) return "X";
  return "IX";
}

function rawNumber(hasProduct: boolean, hasTemplate: boolean) {
  if (hasProduct && hasTemplate) return "XII";
  if (hasProduct || hasTemplate) return "XI";
  return "X";
}

/** FedRAMP coverage section sits at the very end of the main column,
 *  one number past the Raw record. */
function fedrampNumber(hasProduct: boolean, hasTemplate: boolean) {
  if (hasProduct && hasTemplate) return "XIII";
  if (hasProduct || hasTemplate) return "XII";
  return "XI";
}

function FedrampCoverageSection({
  coverage,
}: {
  coverage: {
    state: import("@/lib/types").FedrampCoverageState;
    fedramp_products: import("@/lib/types").FedrampProduct[];
    authorized_at_using_agency: boolean;
    inherited_via_parent: boolean;
  };
}) {
  const { state, fedramp_products, inherited_via_parent } = coverage;
  const primary = fedramp_products[0] ?? null;
  return (
    <div className="border-t-2 border-foreground pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <FedrampCoverageBadge
          state={state}
          impactLevel={primary?.impact_level ?? null}
        />
        {inherited_via_parent && state === "covered" ? (
          <span
            className="inline-flex items-center border border-[var(--stamp)] bg-background px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--stamp)]"
            title="Coverage is inherited via the parent product's FedRAMP authorization (Phase-5 hierarchy)."
          >
            via parent platform
          </span>
        ) : null}
      </div>

      {state === "outside_scope" ? (
        <p className="mt-4 max-w-prose text-[13.5px] leading-relaxed text-muted-foreground">
          The product is FedRAMP authorized, but the filing agency does not
          appear in the ATO scope for this product. The agency may be operating
          under another agency&apos;s ATO, under a separate authorization not
          captured here, or without an authorization at all.
        </p>
      ) : null}

      {state === "no_fedramp" ? (
        <p className="mt-4 max-w-prose text-[13.5px] leading-relaxed text-muted-foreground">
          No FedRAMP marketplace listing has been mapped to this entry&apos;s
          linked product.
        </p>
      ) : null}

      {state === "no_link" ? (
        <p className="mt-4 max-w-prose text-[13.5px] leading-relaxed text-muted-foreground">
          This entry has no canonical product resolved yet, or the product is
          awaiting FedRAMP-link review in the curation queue.
        </p>
      ) : null}

      {fedramp_products.length > 0 ? (
        <ul className="mt-5 flex flex-col divide-y divide-border border-t border-border">
          {fedramp_products.map((p) => (
            <li key={p.fedramp_id} className="py-3">
              <Link
                href={`/fedramp/marketplace/products/${p.fedramp_id}`}
                className="group flex items-baseline justify-between gap-3 hover:text-[var(--stamp)]"
              >
                <div className="min-w-0">
                  <p className="font-display italic text-[1.15rem] leading-tight tracking-[-0.01em] text-foreground group-hover:text-[var(--stamp)]">
                    {p.cso}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {p.csp}
                    {p.impact_level ? ` · Impact ${p.impact_level}` : ""}
                  </p>
                </div>
                <ExternalLink
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consolidated use case
// ---------------------------------------------------------------------------

function ConsolidatedDetail({ data }: { data: ConsolidatedWithTags }) {
  const tags = data.tags;
  const related = getRelatedByAgency(data.agency_id, -1, 5);
  const agency = data.agency_abbreviation
    ? getAgencyByAbbr(data.agency_abbreviation)
    : null;
  const linkedProducts = getProductsForConsolidatedUseCase(data.id);
  const externalEvidence = getExternalEvidenceForConsolidated(data.id);
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-10 md:pb-14">
        <aside className="col-span-12 mb-6 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-3">
            <BackLink />
            <div className="eyebrow !text-[var(--stamp)]">
              § Entry · Consolidated
            </div>
            {data.agency_abbreviation && (
              <div>
                <MonoChip
                  href={`/agencies/${data.agency_abbreviation}`}
                  tone="stamp"
                  size="sm"
                >
                  {data.agency_abbreviation}
                </MonoChip>
              </div>
            )}
            {tags?.entry_type && (
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground">
                {tags.entry_type.replace(/_/g, " ")}
              </div>
            )}
            <div className="pt-2">
              <ExternalEvidenceBadge evidence={externalEvidence} />
            </div>
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.2rem] leading-[1.02] tracking-[-0.02em] text-foreground md:text-[3.4rem]">
            {data.ai_use_case}
          </h1>
          {agency && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <Link
                href={`/agencies/${data.agency_abbreviation}`}
                className="hover:text-[var(--stamp)]"
              >
                {agency.name}
              </Link>
            </p>
          )}
          {agency && (
            <SourceInventoryLinks
              inventoryUrl={agency.inventory_page_url}
              csvUrl={agency.csv_download_url}
              sourceFile={data.source_file}
            />
          )}
        </div>
      </header>

      <SourceLegend />

      <Section number="I" title="Summary" source="omb">
        <DL>
          <Row label="Commercial product" value={data.commercial_product} />
          <Row
            label="Commercial examples"
            value={data.commercial_examples}
            multiline
          />
          <Row label="Agency uses" value={data.agency_uses} multiline />
          <Row
            label="Estimated licenses / users"
            value={data.estimated_licenses_users}
          />
        </DL>
      </Section>

      <Section
        number="II"
        title="External corroboration"
        source="derived"
        lede="What we know about this entry from sources outside the inventory itself."
      >
        <ExternalEvidenceList evidence={externalEvidence} />
      </Section>

      <Section number="III" title="Analytical tags" source="derived">
        <TagDefinitionList tags={tags} />
      </Section>

      {linkedProducts.length > 0 && (
        <Section
          number="IV"
          title={
            linkedProducts.length > 1 ? "Linked products" : "Linked product"
          }
          source="derived"
          lede={
            linkedProducts.length > 1
              ? "Every canonical product evidenced by this entry's commercial-product, examples, or agency-uses text."
              : "The commercial product this consolidated entry deploys."
          }
        >
          <ul className="flex flex-col divide-y divide-border border-t-2 border-foreground">
            {linkedProducts.map((p) => (
              <li key={p.id} className="py-4 first:pt-4">
                <Link
                  href={`/products/${p.id}`}
                  className="group flex items-start justify-between gap-3 hover:text-[var(--stamp)]"
                >
                  <div>
                    <p className="font-display italic text-[1.4rem] leading-tight tracking-[-0.01em] text-foreground group-hover:text-[var(--stamp)]">
                      {p.canonical_name}
                    </p>
                    {p.vendor && (
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {p.vendor}
                        {p.confidence ? ` · ${p.confidence} evidence` : ""}
                      </p>
                    )}
                  </div>
                  <ExternalLink
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        number={linkedProducts.length > 0 ? "V" : "IV"}
        title="Related filings"
        source="derived"
      >
        <RelatedUseCases
          title="More from this agency"
          items={related}
          emptyMessage="No other entries for this agency."
        />
      </Section>

      <Section
        number={linkedProducts.length > 0 ? "VI" : "V"}
        title="Raw record"
        source="omb"
      >
        <RawJsonViewer json={data.raw_json} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/use-cases"
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
    >
      <ArrowLeft className="size-3" aria-hidden />
      All use cases
    </Link>
  );
}

function DL({
  children,
  columns = 1,
}: {
  children: React.ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <dl
      className={
        columns === 2
          ? "grid grid-cols-1 border-t-2 border-foreground sm:grid-cols-2 sm:[&>div]:border-b sm:[&>div]:border-border sm:[&>div:nth-child(odd)]:border-r sm:[&>div:nth-child(odd)]:pr-6 sm:[&>div:nth-child(even)]:pl-6"
          : "divide-y divide-border border-t-2 border-foreground"
      }
    >
      {children}
    </dl>
  );
}

function Row({
  label,
  value,
  multiline = false,
  raw = false,
  source,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
  raw?: boolean;
  source?: SectionSource;
}) {
  const isEmpty =
    value == null || (typeof value === "string" && value.trim().length === 0);
  const sourceTag =
    source === "omb"
      ? "OMB"
      : source === "derived"
        ? "IFP"
        : source === "omb-derived"
          ? "OMB → IFP"
          : null;
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6 sm:py-3.5">
      <dt className="flex w-full shrink-0 items-baseline gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:w-56">
        <span>{label}</span>
        {sourceTag ? (
          <span className="font-mono text-[8px] font-normal tracking-[0.1em] text-muted-foreground/70">
            {sourceTag}
          </span>
        ) : null}
      </dt>
      <dd
        className={
          multiline
            ? "whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground"
            : "text-[13.5px] text-foreground"
        }
      >
        {isEmpty ? (
          <span className="text-muted-foreground">—</span>
        ) : raw ? (
          value
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function TextBlock({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value || value.trim().length === 0) {
    return (
      <div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-[13.5px] text-muted-foreground">—</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground">
        {value}
      </p>
    </div>
  );
}

function boolText(v: number | null | undefined): string | null {
  if (v == null) return null;
  return formatBoolFlag(v);
}

function externalLink(url: string | null | undefined): React.ReactNode {
  if (!url || url.trim().length === 0) return null;
  if (!/^https?:\/\//i.test(url)) {
    return <span>{url}</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 border-b border-dotted border-border text-foreground hover:border-[var(--stamp)] hover:text-[var(--stamp)]"
    >
      {truncateUrl(url)}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const rest = u.pathname + (u.search || "");
    const tail = rest.length > 40 ? `${rest.slice(0, 39)}…` : rest;
    return `${u.hostname}${tail}`;
  } catch {
    return url.length > 60 ? `${url.slice(0, 59)}…` : url;
  }
}

function SourceInventoryLinks({
  inventoryUrl,
  csvUrl,
  sourceFile,
}: {
  inventoryUrl: string | null;
  csvUrl: string | null;
  sourceFile?: string | null;
}) {
  if (!inventoryUrl && !csvUrl) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      <span>Source</span>
      {inventoryUrl ? (
        <Link
          href={inventoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-foreground hover:text-[var(--stamp)]"
        >
          Agency inventory page<span aria-hidden>↗</span>
        </Link>
      ) : null}
      {csvUrl ? (
        <Link
          href={csvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-foreground hover:text-[var(--stamp)]"
        >
          Official inventory file<span aria-hidden>↗</span>
        </Link>
      ) : null}
      {sourceFile ? (
        <span className="text-muted-foreground normal-case tracking-normal">
          {sourceFile}
        </span>
      ) : null}
    </p>
  );
}

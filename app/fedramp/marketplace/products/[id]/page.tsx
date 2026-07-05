/**
 * /fedramp/marketplace/products/[id] — single-product detail page.
 *
 * Sections (numbered dynamically; supply-chain and description are both
 * conditional, so a `nextSection()` counter assigns roman numerals in order):
 *   § I    Identity         — CSP, CSO, status stamp, impact, models, FedRAMP id
 *   § II?  AI classification — independent LLM label (omitted when absent)
 *   § III? Supply chain     — leverages / leveraged by (omitted when empty)
 *   § IV?  Services in scope — the package's own service catalog, AI-labeled
 *   § V?   Description      — service_desc paragraph
 *   § VI   Authorizations   — full ATO ledger
 *   § VII  Colophon         — assessor, contacts, dates
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import {
  getFedrampProductById,
  getFedrampAuthorizationsForProduct,
  getFedrampAssessors,
  getLeveragedSystemsForFedrampProduct,
  getProductsLeveragedBy,
  getAiClassificationFor,
  getInventoryProductsForFedrampProduct,
  getServicesInScopeForProduct,
} from "@/lib/db";
import { Section, MonoChip, Eyebrow, Figure } from "@/components/editorial";
import { StatTile } from "@/components/stat-tile";
import { StatusStamp } from "@/components/fedramp/status-stamp";
import { ImpactBadge } from "@/components/fedramp/impact-badge";
import { AuthorizationsTable } from "@/components/fedramp/authorizations-table";
import { formatDate, formatNumber } from "@/lib/formatting";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = getFedrampProductById(id);
  if (!product) return { title: "Product not found · FedRAMP" };
  return {
    title: `${product.cso} — ${product.csp} · FedRAMP Marketplace`,
    description:
      product.service_desc?.slice(0, 160) ??
      `${product.cso} from ${product.csp} on the FedRAMP Marketplace.`,
  };
}

export default async function MarketplaceProductDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  if (!id) notFound();

  const product = getFedrampProductById(id);
  if (!product) notFound();

  const authorizations = getFedrampAuthorizationsForProduct(product.fedramp_id);
  const leverages = getLeveragedSystemsForFedrampProduct(product.fedramp_id);
  const leveragedBy = getProductsLeveragedBy(product.fedramp_id);
  const hasSupplyChain = leverages.length > 0 || leveragedBy.length > 0;

  // Services in scope (from the marketplace export's per-package catalogs),
  // AI-labeled first. Only ~90 of 659 products publish one.
  const servicesInScope = getServicesInScopeForProduct(product.fedramp_id);
  const aiServices = servicesInScope.filter(
    (s) => s.category === "core_ai" || s.category === "ai_featured",
  );
  const otherServices = servicesInScope.filter(
    (s) => s.category !== "core_ai" && s.category !== "ai_featured",
  );

  // Independent AI classification (orthogonal to inventory linkage). Present
  // only after the classification pass has shipped in the DB.
  const aiClassification = getAiClassificationFor(product.fedramp_id);
  const linkedInventory =
    aiClassification && aiClassification.category !== "not_ai"
      ? getInventoryProductsForFedrampProduct(product.fedramp_id)
      : [];

  // Look up the assessor's slug from the assessors directory so we can link
  // back to the 3PAO profile page.
  let assessorSlug: string | null = null;
  if (product.assessor_id != null) {
    const assessors = getFedrampAssessors();
    assessorSlug =
      assessors.find((a) => a.id === product.assessor_id)?.slug ?? null;
  }

  // Roman-numeral section counter — Identity is always § I; Supply chain and
  // Description are conditional; Authorizations and Colophon always render.
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
  let sectionIdx = 0;
  const nextSection = () => ROMAN[sectionIdx++];
  const identityNum = nextSection();
  const aiNum = aiClassification ? nextSection() : null;
  const supplyChainNum = hasSupplyChain ? nextSection() : null;
  const servicesNum = servicesInScope.length > 0 ? nextSection() : null;
  const descriptionNum = product.service_desc ? nextSection() : null;
  const authorizationsNum = nextSection();
  const colophonNum = nextSection();

  return (
    <div>
      <nav className="mb-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Link
          href="/fedramp/marketplace/products"
          className="hover:text-[var(--stamp)]"
        >
          ← All products
        </Link>
      </nav>

      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-3">
            <Eyebrow color="stamp">§ Product</Eyebrow>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              FedRAMP ID · {product.fedramp_id}
            </div>
            <div className="flex flex-wrap items-end gap-2 pt-2">
              <StatusStamp status={product.status} size="md" />
              <ImpactBadge impact={product.impact_level} size="sm" />
            </div>
            {product.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.logo}
                alt=""
                className="mt-3 max-h-16 max-w-[140px] object-contain opacity-90"
              />
            ) : null}
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <Link
            href={`/fedramp/marketplace/csps/${product.csp_slug}`}
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-[var(--stamp)]"
          >
            {product.csp}
          </Link>
          <h1 className="mt-2 font-display italic text-[2.4rem] leading-[1] tracking-[-0.02em] text-foreground md:text-[3.4rem]">
            {product.cso}
          </h1>

          <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile variant="rule"
              label="Authorizations"
              value={product.authorization_count ?? 0}
              accent="verified"
            />
            <StatTile variant="rule"
              label="Reuse"
              value={product.reuse_count ?? 0}
              sublabel="Marketplace count"
            />
            <StatTile variant="rule"
              label="Impact level"
              value={product.impact_level ?? "—"}
              accent="ink"
            />
            <StatTile variant="rule"
              label="Auth date"
              value={formatDate(product.auth_date)}
              sublabel={product.auth_type ?? undefined}
            />
          </section>
        </div>
      </header>

      <Section
        number={identityNum}
        title="Identity"
        lede="Sponsor, posture, and the categorical filing tags."
      >
        <dl className="grid gap-x-6 gap-y-4 font-mono text-[12px] sm:grid-cols-2">
          <Detail label="Cloud service provider">
            <MonoChip
              href={`/fedramp/marketplace/csps/${product.csp_slug}`}
              tone="ink"
            >
              {product.csp}
            </MonoChip>
          </Detail>
          <Detail label="Status">{product.status}</Detail>
          <Detail label="Impact level">
            <ImpactBadge impact={product.impact_level} />
          </Detail>
          <Detail label="Deployment model">
            {product.deployment_model ?? "—"}
          </Detail>
          <Detail label="Auth type">{product.auth_type ?? "—"}</Detail>
          <Detail label="Partnering agency">
            {product.partnering_agency ?? "—"}
          </Detail>
          <Detail label="Auth category">
            {product.auth_category ?? "—"}
          </Detail>
          <Detail label="UEI">{product.uei ?? "—"}</Detail>
          <Detail label="Small business">
            {product.small_business === 1
              ? "Yes"
              : product.small_business === 0
                ? "No"
                : "—"}
          </Detail>
          <Detail label="Annual assessment">
            {formatDate(product.annual_assessment_date)}
          </Detail>
        </dl>
      </Section>

      {aiClassification ? (
        <Section
          number={aiNum!}
          title="AI classification"
          lede="An independent LLM review of this FedRAMP listing — separate from whether the product links to the AI use-case inventory. It judges whether the offering itself is AI/ML."
        >
          <div className="flex flex-wrap items-center gap-2">
            {aiClassification.category === "core_ai" ? (
              <MonoChip tone="stamp" size="sm">Core AI</MonoChip>
            ) : aiClassification.category === "ai_featured" ? (
              <MonoChip tone="ink" size="sm">AI-featured</MonoChip>
            ) : (
              <MonoChip tone="muted" size="sm">Not AI</MonoChip>
            )}
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              {aiClassification.confidence} confidence · {aiClassification.model}
            </span>
          </div>
          <p className="mt-4 max-w-[68ch] font-body text-[15px] leading-relaxed text-foreground/90">
            {aiClassification.reasoning}
          </p>
          {aiClassification.signals.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {aiClassification.signals.map((s, i) => (
                <li
                  key={i}
                  className="border-l border-[var(--rule)] pl-3 text-[13px] italic leading-snug text-foreground/75"
                >
                  &ldquo;{s}&rdquo;
                </li>
              ))}
            </ul>
          ) : null}
          {aiClassification.category !== "not_ai" ? (
            <p className="mt-5 border-t border-dotted border-border pt-3 text-[13px] text-muted-foreground">
              {linkedInventory.length > 0 ? (
                <>
                  Linked to inventory product
                  {linkedInventory.length === 1 ? " " : "s "}
                  {linkedInventory.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 ? ", " : ""}
                      <span className="font-medium text-foreground">
                        {p.canonical_name}
                      </span>
                    </span>
                  ))}
                  {" "}— it appears on the inventory-linkage coverage boards.
                </>
              ) : (
                <>
                  Not linked to any inventory product — this AI tool appears on
                  the{" "}
                  <Link
                    href="/fedramp/coverage/unlinked-ai"
                    className="text-foreground underline decoration-[var(--stamp)] underline-offset-2"
                  >
                    FedRAMP AI absent from the inventory
                  </Link>{" "}
                  gap board.
                </>
              )}
            </p>
          ) : null}
        </Section>
      ) : null}

      {hasSupplyChain ? (
        <Section
          number={supplyChainNum!}
          title="Supply chain"
          lede="Other FedRAMP-authorized offerings that this CSO leverages, and those that leverage it. Resolved one hop only; unresolved labels are free-text references in the source filing."
        >
          {leverages.length > 0 ? (
            <div className="mb-8">
              <Eyebrow color="stamp">Leverages</Eyebrow>
              <div className="mt-3 flex flex-wrap gap-2">
                {leverages.map((row, i) =>
                  row.target_fedramp_id ? (
                    <MonoChip
                      key={`fwd-${i}`}
                      href={`/fedramp/marketplace/products/${row.target_fedramp_id}`}
                      tone="ink"
                    >
                      {row.target_csp ?? row.system_name} · {row.target_cso ?? ""}
                    </MonoChip>
                  ) : (
                    <span
                      key={`fwd-${i}`}
                      className="border border-dotted border-border px-2 py-1 font-mono text-[11px] text-muted-foreground"
                      title="Free-text reference in source filing; no FedRAMP marketplace match"
                    >
                      {row.system_name}
                    </span>
                  ),
                )}
              </div>
            </div>
          ) : null}

          {leveragedBy.length > 0 ? (
            <div>
              <Eyebrow color="stamp">Leveraged by</Eyebrow>
              <div className="mt-3 flex flex-wrap gap-2">
                {leveragedBy.map((row, i) => (
                  <MonoChip
                    key={`rev-${i}`}
                    href={`/fedramp/marketplace/products/${row.source_fedramp_id}`}
                    tone="ink"
                  >
                    {row.source_csp} · {row.source_cso}
                  </MonoChip>
                ))}
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      {servicesInScope.length > 0 ? (
        <Section
          number={servicesNum!}
          title="Services in scope"
          lede="The individual services this package's FedRAMP authorization covers, from the marketplace's own scope catalog. Being in scope means the authorization covers the service — not that any agency has enabled it."
        >
          {aiServices.length > 0 ? (
            <div className="mb-6">
              <Eyebrow color="stamp">AI services in scope</Eyebrow>
              <ul className="mt-3 space-y-2">
                {aiServices.map((s) => (
                  <li key={s.service} className="flex flex-wrap items-baseline gap-2">
                    <MonoChip
                      tone={s.category === "core_ai" ? "stamp" : "ink"}
                      size="xs"
                      title={
                        s.category === "core_ai"
                          ? "Primary purpose is AI/ML (independent per-service classification)"
                          : "Ships material AI/ML capability as a feature"
                      }
                    >
                      {s.category === "core_ai" ? "Core AI" : "AI-featured"}
                    </MonoChip>
                    <span className="text-[0.95rem] font-medium text-foreground">
                      {s.service}
                    </span>
                    {s.recency === "last_90" ? (
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                        added within 90 days of snapshot
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Per-service AI labels: independent LLM classification, frontier-QC&rsquo;d ·{" "}
                <Link
                  href="/fedramp/coverage/spread#services"
                  className="text-[var(--stamp)] hover:underline"
                >
                  the shelf inside the shelf →
                </Link>
              </p>
            </div>
          ) : null}

          <details className="group">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-[var(--stamp)]">
              Show all {formatNumber(servicesInScope.length)} services in scope
            </summary>
            <ul className="mt-4 columns-2 gap-x-8 text-[13px] leading-[1.7] text-foreground/80 md:columns-3">
              {otherServices.map((s) => (
                <li key={s.service} className="break-inside-avoid">
                  {s.service}
                </li>
              ))}
              {aiServices.map((s) => (
                <li key={`ai-${s.service}`} className="break-inside-avoid font-medium text-foreground">
                  {s.service}
                </li>
              ))}
            </ul>
          </details>
        </Section>
      ) : null}

      {product.service_desc ? (
        <Section
          number={descriptionNum!}
          title="Description"
          lede="The provider&rsquo;s own description of the offering."
        >
          <div className="prose max-w-[68ch] font-body text-[15px] leading-relaxed text-foreground/90">
            {product.service_desc.split("\n\n").map((para, i) => (
              <p key={i} className="mb-4 whitespace-pre-wrap">
                {para}
              </p>
            ))}
          </div>
          {product.fedramp_msg ? (
            <p className="mt-6 max-w-[68ch] border-l-2 border-[var(--stamp)] pl-4 font-body text-[14px] italic text-foreground/80">
              {product.fedramp_msg}
            </p>
          ) : null}
        </Section>
      ) : null}

      <Section
        number={authorizationsNum}
        title="Authorization ledger"
        lede={`Every agency ATO and reuse logged for ${product.cso}.`}
      >
        <Figure
          eyebrow={`Tab. 1 · ${formatNumber(authorizations.length)} ATO ${authorizations.length === 1 ? "event" : "events"}`}
          caption="Sorted by issuance date, descending. Initial = first agency authorization. Reuse = subsequent agency picking up the package."
        >
          <AuthorizationsTable rows={authorizations} />
        </Figure>
      </Section>

      <Section
        number={colophonNum}
        title="Colophon"
        lede="Filing metadata for this record."
      >
        <div className="border-t-2 border-foreground pt-4">
          <Eyebrow color="stamp">§ Filing</Eyebrow>
          <dl className="mt-3 grid gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.12em] sm:grid-cols-2">
            <Colophon
              label="Independent assessor (3PAO)"
              value={product.independent_assessor ?? "—"}
            />
            <Colophon label="Auth date" value={formatDate(product.auth_date)} />
            <Colophon
              label="Annual assessment"
              value={formatDate(product.annual_assessment_date)}
            />
            <Colophon
              label="Ready date"
              value={formatDate(product.ready_date)}
            />
            <Colophon label="Sales email" value={product.sales_email ?? "—"} />
            <Colophon
              label="Security email"
              value={product.security_email ?? "—"}
            />
            <Colophon label="UEI" value={product.uei ?? "—"} />
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-dotted border-border pt-4">
            {assessorSlug ? (
              <Link
                href={`/fedramp/marketplace/assessors/${assessorSlug}`}
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground hover:text-[var(--stamp)]"
              >
                Assessor profile →
              </Link>
            ) : null}
            {product.website ? (
              <Link
                href={product.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground hover:text-[var(--stamp)]"
              >
                Provider site →
              </Link>
            ) : null}
            {product.partnering_agency ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Partnering agency · {product.partnering_agency}
              </span>
            ) : null}
          </div>
        </div>
      </Section>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-dotted border-border pb-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] text-foreground/90">{children}</dd>
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

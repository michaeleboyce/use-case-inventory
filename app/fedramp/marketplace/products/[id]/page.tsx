/**
 * /fedramp/marketplace/products/[id] — single-product detail page.
 *
 * Sections:
 *   § I   Identity         — CSP, CSO, status stamp, impact, models, FedRAMP id
 *   § II  Description      — service_desc paragraph
 *   § III Authorizations   — full ATO ledger
 *   § IV  Colophon         — assessor, contacts, dates
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import {
  getFedrampProductById,
  getFedrampAuthorizationsForProduct,
  getFedrampAssessors,
} from "@/lib/db";
import { Section, MonoChip, Eyebrow, Figure } from "@/components/editorial";
import { MetricTile } from "@/components/metric-tile";
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

  // Look up the assessor's slug from the assessors directory so we can link
  // back to the 3PAO profile page.
  let assessorSlug: string | null = null;
  if (product.assessor_id != null) {
    const assessors = getFedrampAssessors();
    assessorSlug =
      assessors.find((a) => a.id === product.assessor_id)?.slug ?? null;
  }

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
            <MetricTile
              label="Authorizations"
              value={product.authorization_count ?? 0}
              accent="verified"
            />
            <MetricTile
              label="Reuse"
              value={product.reuse_count ?? 0}
              sublabel="Marketplace count"
            />
            <MetricTile
              label="Impact level"
              value={product.impact_level ?? "—"}
              accent="ink"
            />
            <MetricTile
              label="Auth date"
              value={formatDate(product.auth_date)}
              sublabel={product.auth_type ?? undefined}
            />
          </section>
        </div>
      </header>

      <Section
        number="I"
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

      {product.service_desc ? (
        <Section
          number="II"
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
        number={product.service_desc ? "III" : "II"}
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
        number={product.service_desc ? "IV" : "III"}
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

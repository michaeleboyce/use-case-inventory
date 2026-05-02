/**
 * /fedramp/marketplace/csps/[slug] — single-CSP detail page. Header (logo,
 * name, total ATOs/reuses) and a § Offerings section grid.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import {
  getFedrampCspBySlug,
  getFedrampProductsByCsp,
} from "@/lib/db";
import { Section, Eyebrow, MonoChip } from "@/components/editorial";
import { MetricTile } from "@/components/metric-tile";
import { StatusStamp } from "@/components/fedramp/status-stamp";
import { ImpactBadge } from "@/components/fedramp/impact-badge";
import { formatDate, formatNumber } from "@/lib/formatting";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = getFedrampCspBySlug(slug);
  if (!detail) return { title: "CSP not found · FedRAMP" };
  return {
    title: `${detail.csp} · FedRAMP Marketplace`,
    description: `${formatNumber(detail.offering_count)} cloud-service offerings under ${detail.csp}, with ${formatNumber(detail.total_authorizations)} total authorization events.`,
  };
}

export default async function MarketplaceCspDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const detail = getFedrampCspBySlug(slug);
  if (!detail) notFound();

  const products = getFedrampProductsByCsp(slug);

  return (
    <div>
      <nav className="mb-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Link
          href="/fedramp/marketplace/csps"
          className="hover:text-[var(--stamp)]"
        >
          ← All providers
        </Link>
      </nav>

      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <Eyebrow color="stamp">§ Provider</Eyebrow>
            <MonoChip tone="muted" size="sm">
              {detail.csp_slug}
            </MonoChip>
            <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="tabular-nums text-foreground">
                {formatNumber(detail.offering_count)}
              </span>{" "}
              {detail.offering_count === 1 ? "offering" : "offerings"}
            </div>
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.4rem] leading-[1] tracking-[-0.02em] text-foreground md:text-[3.4rem]">
            {detail.csp}
          </h1>
          <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-foreground/85 md:text-[1.05rem]">
            All FedRAMP cloud-service offerings filed under {detail.csp}.
            Each row below is a distinct CSO with its own authorization
            package.
          </p>
        </div>
      </header>

      <section className="ink-in mt-10 grid grid-cols-2 gap-4 md:mt-14 md:grid-cols-4">
        <MetricTile
          label="Listed offerings"
          value={detail.offering_count}
          sublabel="Distinct CSOs"
        />
        <MetricTile
          label="Authorized"
          value={detail.authorized_count}
          accent="verified"
          sublabel="Currently"
        />
        <MetricTile
          label="Total ATOs"
          value={detail.total_authorizations}
          sublabel="Marketplace count"
        />
        <MetricTile
          label="Total reuses"
          value={detail.total_reuses}
          sublabel="Marketplace count"
        />
      </section>

      <Section
        number="I"
        title="Offerings"
        lede="Each row is a distinct cloud service offering listed by this provider."
      >
        {products.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            No offerings on file.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-foreground text-left">
                  <Th>CSO</Th>
                  <Th>Status</Th>
                  <Th>Impact</Th>
                  <Th>Auth type</Th>
                  <Th align="right">Auth date</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.fedramp_id}
                    className="border-b border-dotted border-border align-baseline hover:bg-foreground/[0.025]"
                  >
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/fedramp/marketplace/products/${p.fedramp_id}`}
                        className="font-display italic text-[1rem] leading-tight text-foreground hover:text-[var(--stamp)]"
                      >
                        {p.cso}
                      </Link>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {p.fedramp_id}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusStamp status={p.status} size="xs" />
                    </td>
                    <td className="px-2 py-2.5">
                      <ImpactBadge impact={p.impact_level} />
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em]">
                      {p.auth_type ?? "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[11px] tabular-nums whitespace-nowrap text-muted-foreground">
                      {formatDate(p.auth_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

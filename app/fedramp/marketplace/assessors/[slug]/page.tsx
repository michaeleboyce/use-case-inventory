/**
 * /fedramp/marketplace/assessors/[slug] — portfolio dossier for a single
 * 3PAO. Identity, status / impact mix, and the products covered.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import {
  getFedrampAssessors,
  getFedrampProductsByAssessor,
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
  const assessor = getFedrampAssessors().find((a) => a.slug === slug);
  if (!assessor) return { title: "Assessor not found · FedRAMP" };
  return {
    title: `${assessor.name} · 3PAO · FedRAMP Marketplace`,
    description: `FedRAMP cloud-service offerings independently assessed by ${assessor.name}.`,
  };
}

export default async function MarketplaceAssessorDetailPage({
  params,
}: PageProps) {
  const { slug } = await params;
  const assessor = getFedrampAssessors().find((a) => a.slug === slug);
  if (!assessor) notFound();

  const products = getFedrampProductsByAssessor(assessor.id);
  const authorized = products.filter(
    (p) => p.status === "FedRAMP Authorized",
  ).length;
  const inProcess = products.filter(
    (p) => p.status === "FedRAMP In Process",
  ).length;
  const high = products.filter((p) => p.impact_level === "High").length;

  const statusMix = new Map<string, number>();
  const impactMix = new Map<string, number>();
  for (const p of products) {
    statusMix.set(p.status, (statusMix.get(p.status) ?? 0) + 1);
    if (p.impact_level) {
      impactMix.set(p.impact_level, (impactMix.get(p.impact_level) ?? 0) + 1);
    }
  }
  const statusRows = Array.from(statusMix.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
  const impactRows = Array.from(impactMix.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <nav className="mb-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Link
          href="/fedramp/marketplace/assessors"
          className="hover:text-[var(--stamp)]"
        >
          ← All assessors
        </Link>
      </nav>

      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <Eyebrow color="stamp">§ 3PAO</Eyebrow>
            <MonoChip tone="muted" size="sm">
              {assessor.slug}
            </MonoChip>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Third-party assessor
            </div>
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.4rem] leading-[1] tracking-[-0.02em] text-foreground md:text-[3.4rem]">
            {assessor.name}
          </h1>
          <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-foreground/85">
            FedRAMP-recognized 3PAO. Has independently assessed{" "}
            <span className="font-mono tabular-nums">
              {formatNumber(products.length)}
            </span>{" "}
            cloud-service offering{products.length === 1 ? "" : "s"}, of which{" "}
            <span className="font-mono tabular-nums">
              {formatNumber(authorized)}
            </span>{" "}
            currently hold a FedRAMP authorization.
          </p>
        </div>
      </header>

      <Section
        number="I"
        title="Identity"
        lede="The four-line portfolio ledger."
      >
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricTile
            label="Products covered"
            value={products.length}
            sublabel="Lifetime"
          />
          <MetricTile
            label="Authorized"
            value={authorized}
            accent="verified"
            sublabel="Currently"
          />
          <MetricTile
            label="In process"
            value={inProcess}
            sublabel="Active packages"
          />
          <MetricTile
            label="High-impact"
            value={high}
            accent="stamp"
            sublabel="Impact = High"
          />
        </section>
      </Section>

      <Section
        number="II"
        title="Portfolio mix"
        lede="How this assessor's offerings split across status and impact level."
      >
        <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
          <div className="border-t-2 border-foreground pt-3">
            <Eyebrow>Status mix</Eyebrow>
            <ul className="mt-3 space-y-2 font-mono text-[11px]">
              {statusRows.map((r) => (
                <li
                  key={r.key}
                  className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5"
                >
                  <span className="uppercase tracking-[0.1em] text-foreground">
                    {r.key}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatNumber(r.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t-2 border-foreground pt-3">
            <Eyebrow>Impact mix</Eyebrow>
            <ul className="mt-3 space-y-2 font-mono text-[11px]">
              {impactRows.map((r) => (
                <li
                  key={r.key}
                  className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5"
                >
                  <span className="uppercase tracking-[0.1em] text-foreground">
                    {r.key}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatNumber(r.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        number="III"
        title="Products covered"
        lede={`Every cloud-service offering attributed to ${assessor.name} in the marketplace ledger.`}
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
                  <Th>Provider</Th>
                  <Th>Status</Th>
                  <Th>Impact</Th>
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
                      <MonoChip
                        href={`/fedramp/marketplace/csps/${p.csp_slug}`}
                        tone="muted"
                        size="xs"
                      >
                        {p.csp}
                      </MonoChip>
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusStamp status={p.status} size="xs" />
                    </td>
                    <td className="px-2 py-2.5">
                      <ImpactBadge impact={p.impact_level} />
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

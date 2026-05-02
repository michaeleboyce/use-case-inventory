/**
 * /fedramp/marketplace/agencies/[slug] — single-agency dossier. Identity,
 * portfolio mix (status / impact share computed locally), and the full
 * authorization ledger. The path uses the FedRAMP `parent_slug` (not the
 * inventory abbreviation), per the FedRAMP marketplace's keying.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import {
  getFedrampAgencyByAbbr,
  getFedrampAuthorizationsForAgency,
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
  const agency = getFedrampAgencyByAbbr(slug);
  if (!agency) return { title: "Agency not found · FedRAMP" };
  return {
    title: `${agency.parent_agency} · FedRAMP Marketplace`,
    description: `FedRAMP authorization ledger for ${agency.parent_agency}.`,
  };
}

export default async function MarketplaceAgencyDetailPage({
  params,
}: PageProps) {
  const { slug } = await params;
  const agency = getFedrampAgencyByAbbr(slug);
  if (!agency) notFound();

  const auths = getFedrampAuthorizationsForAgency(agency.id);

  const initial = auths.filter((a) => a.ato_type === "Initial").length;
  const reuse = auths.filter((a) => a.ato_type === "Reuse").length;
  const distinct = new Set(auths.map((a) => a.fedramp_id)).size;
  const total = auths.length;

  // Portfolio mix: status counts and impact-level counts across the auths.
  const statusMix = new Map<string, number>();
  const impactMix = new Map<string, number>();
  for (const a of auths) {
    statusMix.set(a.status, (statusMix.get(a.status) ?? 0) + 1);
    if (a.impact_level) {
      impactMix.set(a.impact_level, (impactMix.get(a.impact_level) ?? 0) + 1);
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
          href="/fedramp/marketplace/agencies"
          className="hover:text-[var(--stamp)]"
        >
          ← All agencies
        </Link>
      </nav>

      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <Eyebrow color="stamp">§ Agency</Eyebrow>
            <MonoChip tone="muted" size="sm">
              {agency.parent_slug}
            </MonoChip>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="tabular-nums text-foreground">
                {formatNumber(total)}
              </span>{" "}
              total ATO events
            </div>
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.4rem] leading-[1] tracking-[-0.02em] text-foreground md:text-[3.4rem]">
            {agency.parent_agency}
          </h1>
          <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-foreground/85 md:text-[1.05rem]">
            FedRAMP authorization ledger for {agency.parent_agency}, including
            both packages it sponsored as the Initial authorizing official and
            packages it adopted under Reuse.
          </p>
        </div>
      </header>

      <Section
        number="I"
        title="Identity"
        lede="The headline numbers for this agency."
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricTile
            label="Total ATO events"
            value={total}
            sublabel="Initial + Reuse"
          />
          <MetricTile
            label="Initial ATOs"
            value={initial}
            sublabel="As authorizing agency"
          />
          <MetricTile
            label="Reuse ATOs"
            value={reuse}
            sublabel="Adopted packages"
            accent="verified"
          />
          <MetricTile
            label="Distinct products"
            value={distinct}
            sublabel="Unique CSOs"
          />
        </div>
      </Section>

      <Section
        number="II"
        title="Portfolio mix"
        lede="Status and impact-level distribution across this agency's authorization events."
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
              {statusRows.length === 0 ? (
                <li className="text-muted-foreground">No data.</li>
              ) : null}
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
              {impactRows.length === 0 ? (
                <li className="text-muted-foreground">No data.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        number="III"
        title="Authorization ledger"
        lede={`Every ATO event ${agency.parent_agency} holds, most recent first.`}
      >
        {auths.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            No authorization events on file.
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
                  <Th>ATO type</Th>
                  <Th align="right">Issued</Th>
                  <Th align="right">Expires</Th>
                </tr>
              </thead>
              <tbody>
                {auths.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-dotted border-border align-baseline hover:bg-foreground/[0.025]"
                  >
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/fedramp/marketplace/products/${a.fedramp_id}`}
                        className="font-display italic text-[1rem] leading-tight text-foreground hover:text-[var(--stamp)]"
                      >
                        {a.cso}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <MonoChip
                        href={`/fedramp/marketplace/csps/${a.csp_slug}`}
                        tone="muted"
                        size="xs"
                      >
                        {a.csp}
                      </MonoChip>
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusStamp status={a.status} size="xs" />
                    </td>
                    <td className="px-2 py-2.5">
                      <ImpactBadge impact={a.impact_level} />
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em]">
                      <span
                        className={
                          a.ato_type === "Reuse"
                            ? "text-[var(--verified)]"
                            : "text-foreground"
                        }
                      >
                        {a.ato_type ?? "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[11px] text-muted-foreground">
                      {formatDate(a.ato_issuance_date)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-[11px] text-muted-foreground">
                      {formatDate(a.ato_expiration_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          {formatNumber(auths.length)} rows total
        </div>
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

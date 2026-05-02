/**
 * /fedramp/marketplace — landing page for the marketplace sub-area.
 * Editorial dossier of the snapshot: vital statistics, then a directory of
 * the four sub-routes (products, csps, agencies, assessors) and the two
 * supplements (analytics, compare).
 */

import Link from "next/link";
import { Section, Eyebrow } from "@/components/editorial";
import { MetricTile } from "@/components/metric-tile";
import { getFedrampSnapshot, getFedrampProducts } from "@/lib/db";
import { formatDate, formatNumber } from "@/lib/formatting";

export const metadata = {
  title: "Marketplace · FedRAMP · Federal AI Inventory",
  description:
    "Read-only dossier of the FedRAMP marketplace — every authorized cloud service offering, every provider, every authorizing agency.",
};

const NAV_CARDS: Array<{
  href: string;
  kicker: string;
  title: string;
  body: string;
}> = [
  {
    href: "/fedramp/marketplace/products",
    kicker: "I",
    title: "Products",
    body: "Every cloud-service offering on the marketplace, with status, impact level, and authorization counts.",
  },
  {
    href: "/fedramp/marketplace/csps",
    kicker: "II",
    title: "Providers",
    body: "Cloud service providers behind the offerings, ranked by portfolio size.",
  },
  {
    href: "/fedramp/marketplace/agencies",
    kicker: "III",
    title: "Agencies",
    body: "Federal agencies that have authorized — or reused — at least one FedRAMP package.",
  },
  {
    href: "/fedramp/marketplace/assessors",
    kicker: "IV",
    title: "3PAOs",
    body: "Third-party assessors and the offerings they have signed.",
  },
  {
    href: "/fedramp/marketplace/analytics",
    kicker: "V",
    title: "Analytics",
    body: "Issuance over time, the reuse heatmap, the assessor leaderboard.",
  },
  {
    href: "/fedramp/marketplace/compare",
    kicker: "VI",
    title: "Compare",
    body: "Line up two FedRAMP offerings side by side.",
  },
];

export default function MarketplaceLandingPage() {
  const snapshot = getFedrampSnapshot();
  const products = getFedrampProducts();

  // Cheap top-level rollups derived from the products list (the snapshot
  // table holds the headline counts but not the impact / status breakdowns).
  const authorized = products.filter((p) => p.status === "FedRAMP Authorized").length;
  const inProcess = products.filter((p) => p.status === "FedRAMP In Process").length;
  const high = products.filter((p) => p.impact_level === "High").length;
  const moderate = products.filter((p) => p.impact_level === "Moderate").length;
  const low = products.filter((p) => p.impact_level === "Low").length;

  // The five most-recently authorized products (used as a "what's new"
  // strip on the landing).
  const recent = [...products]
    .filter((p) => !!p.auth_date)
    .sort((a, b) => (a.auth_date! < b.auth_date! ? 1 : -1))
    .slice(0, 6);

  return (
    <div>
      {/* ----------------------------------------------------------------- */}
      {/* Vital statistics                                                   */}
      {/* ----------------------------------------------------------------- */}
      <Section
        number="I"
        title="At a glance"
        lede="The shelf, in five numbers."
        className="mt-4 md:mt-6"
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-5">
          <MetricTile
            label="Products"
            value={snapshot?.product_count ?? products.length}
            sublabel="Cloud services"
            href="/fedramp/marketplace/products"
          />
          <MetricTile
            label="ATO events"
            value={snapshot?.ato_event_count ?? 0}
            sublabel="Initial + Reuse"
            accent="verified"
          />
          <MetricTile
            label="Agencies"
            value={snapshot?.agency_count ?? 0}
            sublabel="Authorizing"
            href="/fedramp/marketplace/agencies"
          />
          <MetricTile
            label="Providers"
            value={snapshot?.csp_count ?? 0}
            sublabel="Distinct CSPs"
            href="/fedramp/marketplace/csps"
          />
          <MetricTile
            label="3PAOs"
            value={snapshot?.assessor_count ?? 0}
            sublabel="Independent assessors"
            href="/fedramp/marketplace/assessors"
          />
        </dl>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Status & impact breakdown                                          */}
      {/* ----------------------------------------------------------------- */}
      <Section
        number="II"
        title="Status & impact"
        lede="What the lifecycle looks like across the catalog."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border-t-2 border-foreground pt-4">
            <Eyebrow>Authorization status</Eyebrow>
            <dl className="mt-3 space-y-2 font-mono text-[11px] uppercase tracking-[0.1em]">
              <Row label="FedRAMP Authorized" value={authorized} tone="verified" />
              <Row label="In process" value={inProcess} tone="stamp" />
              <Row label="Other" value={products.length - authorized - inProcess} />
            </dl>
          </div>
          <div className="border-t-2 border-foreground pt-4">
            <Eyebrow>Impact level</Eyebrow>
            <dl className="mt-3 space-y-2 font-mono text-[11px] uppercase tracking-[0.1em]">
              <Row label="High" value={high} tone="verified" />
              <Row label="Moderate" value={moderate} />
              <Row label="Low" value={low} tone="muted" />
            </dl>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Sub-area directory                                                 */}
      {/* ----------------------------------------------------------------- */}
      <Section
        number="III"
        title="Sections"
        lede="Six numbered cuts of the marketplace."
      >
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {NAV_CARDS.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className="group block border border-border p-4 transition-colors hover:border-foreground"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--stamp)]">
                    § {card.kicker}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Open →
                  </span>
                </div>
                <h3 className="mt-2 font-display italic text-[1.6rem] leading-[1] tracking-[-0.02em] text-foreground group-hover:text-[var(--stamp)]">
                  {card.title}
                </h3>
                <p className="mt-2 max-w-[40ch] text-sm leading-snug text-foreground/80">
                  {card.body}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Recent authorizations                                              */}
      {/* ----------------------------------------------------------------- */}
      <Section
        number="IV"
        title="Recently authorized"
        lede="The six most recent products to receive a FedRAMP authorization."
      >
        <ul className="divide-y divide-dotted divide-border border-t-2 border-foreground">
          {recent.length === 0 ? (
            <li className="py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              No authorizations on file.
            </li>
          ) : (
            recent.map((p) => (
              <li
                key={p.fedramp_id}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-x-3 py-2.5 text-sm"
              >
                <span className="font-mono text-[11px] tabular-nums text-foreground">
                  {formatDate(p.auth_date)}
                </span>
                <Link
                  href={`/fedramp/marketplace/csps/${p.csp_slug}`}
                  className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground hover:text-[var(--stamp)]"
                >
                  {p.csp}
                </Link>
                <Link
                  href={`/fedramp/marketplace/products/${p.fedramp_id}`}
                  className="min-w-0 truncate font-display italic text-[1rem] leading-tight text-foreground hover:text-[var(--stamp)]"
                >
                  {p.cso}
                </Link>
              </li>
            ))
          )}
        </ul>
      </Section>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number;
  tone?: "ink" | "verified" | "stamp" | "muted";
}) {
  const cls =
    tone === "verified"
      ? "text-[var(--verified)]"
      : tone === "stamp"
        ? "text-[var(--stamp)]"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${cls}`}>{formatNumber(value)}</dd>
    </div>
  );
}

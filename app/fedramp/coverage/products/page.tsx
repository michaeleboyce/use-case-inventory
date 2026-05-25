import Link from "next/link";
import {
  getAgencies,
  getAgenciesWithoutUseForFedrampProduct,
  getCoverageUnusedProducts,
  getFedrampSnapshot,
} from "@/lib/db";
import type { AgencyAtoRow, FedrampSnapshot } from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section } from "@/components/editorial";
import { CoverageAgencyFilter } from "@/components/coverage/coverage-agency-filter";
import { ProductsTable } from "./_sections/products-table";

export const metadata = {
  title: "Unused FedRAMP authorizations · AI Inventory",
  description:
    "FedRAMP-authorized AI products that map to the inventory's catalog but appear in zero 2025 use cases. Expand any row to see which agencies hold the authorization.",
};

type UnusedRow = ReturnType<typeof getCoverageUnusedProducts>[number];

const IMPACT_RANK: Record<string, number> = {
  High: 3,
  Moderate: 2,
  "Li-SaaS": 1,
  Low: 0,
};

export default async function FedrampCoverageProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ impact?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const impactFilter = (sp.impact ?? "").toLowerCase();
  const agencyFilter = (sp.agency ?? "").trim().toUpperCase() || null;

  const agencies = getAgencies();
  const agencyMatch = agencyFilter
    ? agencies.find(
        (a) => a.abbreviation.toUpperCase() === agencyFilter,
      ) ?? null
    : null;

  let rows: UnusedRow[] = [];
  let error: string | null = null;
  try {
    rows = getCoverageUnusedProducts(
      agencyMatch ? { agencyId: agencyMatch.id } : {},
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error.";
  }
  const snapshot = safeSnapshot();

  // Distinct impact levels for filter chips, computed pre-filter so chips
  // stay stable even after the user narrows by agency.
  const distinctImpacts = Array.from(
    new Set(
      rows
        .map((r) => r.fedramp_impact_level)
        .filter((v): v is string => Boolean(v)),
    ),
  ).sort((a, b) => (IMPACT_RANK[b] ?? -1) - (IMPACT_RANK[a] ?? -1));

  const filtered = impactFilter
    ? rows.filter(
        (r) => (r.fedramp_impact_level ?? "").toLowerCase() === impactFilter,
      )
    : rows;

  const sorted = filtered.slice().sort((a, b) => {
    const ai = IMPACT_RANK[a.fedramp_impact_level ?? ""] ?? -1;
    const bi = IMPACT_RANK[b.fedramp_impact_level ?? ""] ?? -1;
    if (bi !== ai) return bi - ai;
    if (b.fedramp_ato_count !== a.fedramp_ato_count) {
      return b.fedramp_ato_count - a.fedramp_ato_count;
    }
    return a.canonical_name.localeCompare(b.canonical_name);
  });

  // Attach agencies-with-ATO-but-no-use detail per row. Bounded — most rows
  // have a handful of agencies; the few outliers (M365 Copilot, Bedrock)
  // top out around 30 and still server-render fast.
  type ProductsTableRow = UnusedRow & {
    _agencies: AgencyAtoRow[];
  };
  const withDetail: ProductsTableRow[] = sorted.map((r) => ({
    ...r,
    _agencies: getAgenciesWithoutUseForFedrampProduct(r.fedramp_id),
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">FedRAMP → AI</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Unused authorizations
            </div>
            <Link
              href="/fedramp/coverage"
              className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
            >
              ← Coverage hub
            </Link>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            Authorized,{" "}
            <em className="italic">but not used</em> in any reported use case.
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            {agencyMatch ? (
              <>
                Scoped to {agencyMatch.name} ({agencyMatch.abbreviation}).{" "}
                <span className="font-medium text-foreground">
                  {formatNumber(rows.length)}
                </span>{" "}
                FedRAMP products in {agencyMatch.abbreviation}&rsquo;s ATO scope
                map to the inventory catalog but appear in zero of its 2025
                use cases.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {formatNumber(rows.length)}
                </span>{" "}
                inventory products carry a FedRAMP authorization yet appear in
                zero 2025 use cases. Two interpretations are possible: the
                agency community simply hasn&rsquo;t adopted the product, or
                the inventory misses what is in fact deployed.
              </>
            )}
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Click any row to see the agencies that hold this authorization.
          </p>
        </div>
      </header>

      <div className="mt-6">
        <CoverageAgencyFilter
          options={agencies.map((a) => ({
            abbreviation: a.abbreviation,
            name: a.name,
          }))}
          value={agencyMatch?.abbreviation ?? null}
        />
      </div>

      {error ? (
        <Section number="I" title="No data" lede="The FedRAMP tables aren&rsquo;t loaded.">
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Run <code className="font-mono text-foreground">make fedramp</code>{" "}
            to seed the FedRAMP tables. Detail:{" "}
            <span className="font-mono text-[11px]">{error}</span>
          </p>
        </Section>
      ) : (
        <Section
          number="I"
          title="Mapped but unused"
          lede="Filter by FedRAMP impact level and/or agency. Click a row to see the agencies that hold this authorization."
        >
          <div className="border-t-2 border-foreground pt-4 mb-5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground mr-1">
              Impact
            </span>
            <FilterChip
              href={qs({ agency: agencyFilter, impact: null })}
              active={!impactFilter}
              label="All"
            />
            {distinctImpacts.map((lvl) => (
              <FilterChip
                key={lvl}
                href={qs({ agency: agencyFilter, impact: lvl.toLowerCase() })}
                active={impactFilter === lvl.toLowerCase()}
                label={lvl}
              />
            ))}
          </div>

          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products match the current filter.
            </p>
          ) : (
            <ProductsTable rows={withDetail} />
          )}
        </Section>
      )}

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function qs({ agency, impact }: { agency: string | null; impact: string | null }) {
  const params = new URLSearchParams();
  if (agency) params.set("agency", agency);
  if (impact) params.set("impact", impact);
  const s = params.toString();
  return s ? `/fedramp/coverage/products?${s}` : "/fedramp/coverage/products";
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  const base =
    "inline-flex items-center border bg-background font-mono font-semibold uppercase tracking-[0.06em] transition-colors px-2 py-0.5 text-[11px]";
  const activeRing = "border-foreground text-foreground";
  const idle = "border-border text-muted-foreground hover:text-foreground";
  return (
    <Link href={href} className={`${base} ${active ? activeRing : idle}`}>
      {label}
    </Link>
  );
}

function safeSnapshot(): FedrampSnapshot | null {
  try {
    return getFedrampSnapshot();
  } catch {
    return null;
  }
}

function SnapshotFooter({ snapshot }: { snapshot: FedrampSnapshot | null }) {
  if (!snapshot) {
    return (
      <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        FedRAMP snapshot · unavailable
      </p>
    );
  }
  return (
    <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      FedRAMP snapshot ·{" "}
      {snapshot.snapshot_date
        ? `data as of ${formatDate(snapshot.snapshot_date)}`
        : "date unknown"}{" "}
      · {formatNumber(snapshot.product_count)} products
    </p>
  );
}

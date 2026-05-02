import Link from "next/link";
import {
  getCoverageUnusedProducts,
  getFedrampSnapshot,
} from "@/lib/db";
import type { FedrampSnapshot } from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section, MonoChip } from "@/components/editorial";

export const metadata = {
  title: "Unused FedRAMP authorizations · AI Inventory",
  description:
    "FedRAMP-authorized AI products that map to the inventory's product catalog but appear in zero 2025 use cases.",
};

type UnusedRow = ReturnType<typeof getCoverageUnusedProducts>[number];

function safeRows(): { rows: UnusedRow[]; error: string | null } {
  try {
    return { rows: getCoverageUnusedProducts(), error: null };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

function safeSnapshot(): FedrampSnapshot | null {
  try {
    return getFedrampSnapshot();
  } catch {
    return null;
  }
}

function impactTone(level: string | null): "stamp" | "verified" | "ink" | "muted" {
  const v = (level ?? "").toLowerCase();
  if (v === "high") return "verified";
  if (v === "moderate") return "stamp";
  if (v === "low" || v === "li-saas") return "muted";
  return "ink";
}

const IMPACT_RANK: Record<string, number> = {
  High: 3,
  Moderate: 2,
  "Li-SaaS": 1,
  Low: 0,
};

export default async function FedrampCoverageProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ impact?: string; aiType?: string }>;
}) {
  const sp = await searchParams;
  const impactFilter = (sp.impact ?? "").toLowerCase();
  const { rows, error } = safeRows();
  const snapshot = safeSnapshot();

  // Distinct impact levels available for filter UI.
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

  // Sort by impact rank desc, then ATO count desc, then name asc.
  const sorted = filtered.slice().sort((a, b) => {
    const ai = IMPACT_RANK[a.fedramp_impact_level ?? ""] ?? -1;
    const bi = IMPACT_RANK[b.fedramp_impact_level ?? ""] ?? -1;
    if (bi !== ai) return bi - ai;
    if (b.fedramp_ato_count !== a.fedramp_ato_count) {
      return b.fedramp_ato_count - a.fedramp_ato_count;
    }
    return a.canonical_name.localeCompare(b.canonical_name);
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">Panel 4</div>
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
            <span className="font-medium text-foreground">
              {formatNumber(rows.length)}
            </span>{" "}
            inventory products carry a FedRAMP authorization yet appear in zero
            2025 use cases. Two interpretations are possible: the agency
            community simply hasn&rsquo;t adopted the product, or the inventory
            misses what is in fact deployed.
          </p>
        </div>
      </header>

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
          lede="Filter by FedRAMP impact level. Sorted by impact then by authorizing-agency count."
        >
          {/* Filter chips */}
          <div className="border-t-2 border-foreground pt-4 mb-5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground mr-1">
              Impact
            </span>
            <FilterChip
              href="/fedramp/coverage/products"
              active={!impactFilter}
              label="All"
            />
            {distinctImpacts.map((lvl) => (
              <FilterChip
                key={lvl}
                href={`/fedramp/coverage/products?impact=${encodeURIComponent(lvl.toLowerCase())}`}
                active={impactFilter === lvl.toLowerCase()}
                label={lvl}
                tone={impactTone(lvl)}
              />
            ))}
          </div>

          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products match the current filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <Th>Vendor</Th>
                    <Th align="left">Product (inventory)</Th>
                    <Th align="left">FedRAMP offering</Th>
                    <Th align="left">Impact</Th>
                    <Th align="right">Authorizing agencies</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr
                      key={row.inventory_product_id}
                      className="border-b border-border/60 hover:bg-muted/30"
                    >
                      <td className="px-2 py-2 text-muted-foreground">
                        {row.vendor ?? "—"}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/products/${row.inventory_product_id}`}
                          className="text-foreground hover:text-[var(--stamp)]"
                        >
                          {row.canonical_name}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        <MonoChip
                          href={`/fedramp/marketplace/products/${row.fedramp_id}`}
                          tone="stamp"
                          size="xs"
                          title={`${row.fedramp_csp} · ${row.fedramp_cso}`}
                        >
                          {row.fedramp_id}
                        </MonoChip>
                        <span className="ml-2 text-[0.85rem] text-muted-foreground">
                          {row.fedramp_csp} · {row.fedramp_cso}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {row.fedramp_impact_level ? (
                          <MonoChip
                            tone={impactTone(row.fedramp_impact_level)}
                            size="xs"
                          >
                            {row.fedramp_impact_level}
                          </MonoChip>
                        ) : (
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {row.fedramp_ato_count > 0
                          ? formatNumber(row.fedramp_ato_count)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  tone = "ink",
}: {
  href: string;
  active: boolean;
  label: string;
  tone?: "stamp" | "verified" | "ink" | "muted";
}) {
  const base =
    "inline-flex items-center border bg-background font-mono font-semibold uppercase tracking-[0.06em] transition-colors px-2 py-0.5 text-[11px]";
  const activeRing =
    tone === "verified"
      ? "border-[var(--verified)] text-[var(--verified)]"
      : tone === "stamp"
        ? "border-[var(--stamp)] text-[var(--stamp)]"
        : "border-foreground text-foreground";
  const idle = "border-border text-muted-foreground hover:text-foreground";
  return (
    <Link href={href} className={`${base} ${active ? activeRing : idle}`}>
      {label}
    </Link>
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
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
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

/**
 * /browse/[dimension] — sliced views of the inventory by one cross-cut tag.
 *
 * Valid dimension slugs: sophistication, high-impact, topic-area, vendor.
 * URL slug is hyphenated; CrossCutKey uses snake_case, so we map at the
 * page boundary. Unknown slugs → notFound() (404).
 *
 * Two views, controlled by `?view=list|heatmap` (default list):
 *   - list:    per-value cards with count + top agencies + top products
 *   - heatmap: value × top-15-agencies grid; cells link into /use-cases.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCrossCutSummary,
  getCrossCutHeatmap,
  type CrossCutKey,
} from "@/lib/db";
import { Section, MonoChip } from "@/components/editorial";
import { CrossCutList } from "@/components/cross-cut-list";
import { CrossCutHeatmap } from "@/components/cross-cut-heatmap";
import { DIMENSION_PROVENANCE } from "@/lib/cross-cuts";

type View = "list" | "heatmap";

const SLUG_TO_KEY: Record<string, CrossCutKey> = {
  sophistication: "sophistication",
  "high-impact": "high_impact",
  "topic-area": "topic_area",
  vendor: "vendor",
};

const DIMENSION_TITLES: Record<CrossCutKey, string> = {
  entry_type: "Entry type",
  sophistication: "AI sophistication",
  scope: "Deployment scope",
  use_type: "Use type",
  high_impact: "High-impact designation",
  topic_area: "Topic area",
  vendor: "Vendor",
};

const DIMENSION_LEDES: Record<CrossCutKey, string> = {
  entry_type: "Every reported AI use case, sliced by entry type.",
  sophistication:
    "Every reported AI use case, sliced by AI sophistication tier.",
  scope: "Every reported AI use case, sliced by deployment scope.",
  use_type: "Every reported AI use case, sliced by intended use.",
  high_impact:
    "Every reported AI use case, sliced by high-impact designation.",
  topic_area: "Every reported AI use case, sliced by topic area.",
  vendor: "Every reported AI use case, sliced by product vendor.",
};

type Search = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseView(sp: Search): View {
  return first(sp.view) === "heatmap" ? "heatmap" : "list";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ dimension: string }>;
}) {
  const { dimension } = await params;
  const key = SLUG_TO_KEY[dimension];
  if (!key) return { title: "Browse · Federal AI Inventory" };
  return {
    title: `Browse · ${DIMENSION_TITLES[key]} · Federal AI Inventory`,
    description: DIMENSION_LEDES[key],
  };
}

export default async function BrowseDimensionPage({
  params,
  searchParams,
}: {
  params: Promise<{ dimension: string }>;
  searchParams: Promise<Search>;
}) {
  const { dimension } = await params;
  const key = SLUG_TO_KEY[dimension];
  if (!key) notFound();

  const sp = await searchParams;
  const view = parseView(sp);
  const title = DIMENSION_TITLES[key];
  const lede = DIMENSION_LEDES[key];

  const baseHref = `/browse/${dimension}`;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      {/* Editorial header */}
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-10">
        <aside className="col-span-12 mb-6 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--stamp)]">
              § Browse
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Cross-cut · {dimension}
            </div>
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2rem,5.5vw,4.2rem)] leading-[0.98] tracking-[-0.02em] text-foreground">
            Browse · <em className="inline font-normal italic">{title}</em>
          </h1>
          <p className="mt-4 max-w-prose text-[1rem] leading-[1.55] text-foreground/85">
            {lede}
          </p>

          {/* Provenance — make it obvious whether values come from OMB
              filings or from IFP's analytical layer. */}
          <div className="mt-5 flex max-w-prose items-baseline gap-3 border-l-2 border-border pl-3">
            <MonoChip
              tone={
                DIMENSION_PROVENANCE[key].source === "omb" ? "muted" : "stamp"
              }
              size="xs"
            >
              {DIMENSION_PROVENANCE[key].source === "omb" ? "OMB" : "IFP"}
            </MonoChip>
            <p className="text-[0.85rem] leading-[1.5] text-muted-foreground">
              {DIMENSION_PROVENANCE[key].long}
            </p>
          </div>

          {/* Tab strip */}
          <nav
            aria-label="View toggle"
            className="mt-6 inline-flex items-stretch gap-0 border-t border-border/70"
          >
            <TabLink href={`${baseHref}?view=list`} active={view === "list"}>
              List
            </TabLink>
            <TabLink
              href={`${baseHref}?view=heatmap`}
              active={view === "heatmap"}
            >
              Heatmap
            </TabLink>
          </nav>
        </div>
      </header>

      {/* Content */}
      <Section
        number={view === "list" ? "I" : "II"}
        title={view === "list" ? "Values" : "Value × agency"}
        lede={
          view === "list"
            ? "Counts, top agencies, top products."
            : "Top 15 agencies by total. Click a glyph to filter /use-cases."
        }
      >
        {view === "list" ? (
          <CrossCutList dim={key} rows={getCrossCutSummary(key)} />
        ) : (
          <CrossCutHeatmap dim={key} data={getCrossCutHeatmap(key, 15)} />
        )}
      </Section>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-active={active ? "true" : undefined}
      className="-mt-px flex items-center border-t-2 border-transparent px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-[var(--stamp)] data-[active=true]:text-foreground"
    >
      {children}
    </Link>
  );
}

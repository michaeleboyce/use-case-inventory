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

/** Where each dimension's *values* originate. Drives the OMB / IFP chip
 *  + provenance lede in the page header. Sophistication, scope, use_type,
 *  high_impact, entry_type are auto-derived by IFP from OMB-filed text
 *  (see auto_tag.py heuristics). topic_area and vendor are OMB-filed by
 *  the agency (vendor via the products it lists). */
const DIMENSION_PROVENANCE: Record<
  CrossCutKey,
  { source: "omb" | "derived"; note: string }
> = {
  entry_type: {
    source: "derived",
    note: "Entry type is an IFP-derived classification — every reported entry is bucketed (custom_system / product_deployment / bespoke_application / generic_use_pattern / product_feature) by auto_tag.py based on the OMB-filed system_name, vendor, and problem statement.",
  },
  sophistication: {
    source: "derived",
    note: "AI sophistication is an IFP-derived tier — auto_tag.py inspects each entry's OMB-filed text (problem statement, system outputs, ai_classification) and the linked product's vendor/category to assign one of: classical_ml · general_llm · coding_assistant · agentic · computer_vision · nlp_specific · predictive_analytics. \"Agentic\" requires evidence of multi-step orchestration; \"coding_assistant\" requires explicit coding intent (so a generic Copilot rollout is NOT counted, but a coding-specific Copilot deployment IS).",
  },
  scope: {
    source: "derived",
    note: "Deployment scope is an IFP-derived classification — auto_tag.py reads the OMB-filed deployment narrative to bucket each entry as enterprise_wide / department / bureau / office / team / pilot.",
  },
  use_type: {
    source: "derived",
    note: "Use type is an IFP-derived classification — auto_tag.py categorizes each entry's intent as administrative / mission_critical / it_operations / cybersecurity / research from the OMB-filed problem statement.",
  },
  high_impact: {
    source: "omb",
    note: "High-impact designation is OMB-filed (M-25-21 §I.7) — agencies self-classify each entry as High impact, Presumed-not-high-impact, or Not high impact based on whether the use case affects rights or safety.",
  },
  topic_area: {
    source: "omb",
    note: "Topic area is OMB-filed verbatim (M-25-21 §II.1) — agencies pick from a controlled vocabulary plus free-text fallbacks. Some values are agency-specific (e.g., \"Loan Program Operations\" appears only at SBA).",
  },
  vendor: {
    source: "omb",
    note: "Vendor is OMB-filed via each entry's linked product. IFP normalizes vendor strings across spelling variants (e.g., \"OpenAI\", \"OpenAI Inc.\", \"openai\" all map to one canonical vendor).",
  },
};

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
              {DIMENSION_PROVENANCE[key].note}
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

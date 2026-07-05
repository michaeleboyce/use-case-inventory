import Link from "next/link";
import { getFedrampSnapshot } from "@/lib/db";
import type { FedrampSnapshot } from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section, MonoChip } from "@/components/editorial";
import { EmptyState } from "@/components/empty-state";
import {
  buildViewModel,
  parseBoardFilters,
  CAPABILITY_LABELS,
} from "./_view-model";
import { SleepingServicesFunnel } from "./_sections/funnel";
import { FrontierGrid } from "./_sections/frontier-grid";
import { SleepingServicesBoard } from "./_sections/board-table";
import { CapabilityMatrix } from "./_sections/capability-matrix";
import { TimingChart } from "./_sections/timing";

export const metadata = {
  title: "Sleeping services · FedRAMP × AI Inventory",
  description:
    "AI services already in scope of packages agencies hold ATOs for — Azure OpenAI, Bedrock, Textract and peers — where another agency reports real AI use but the ATO holder reports nothing.",
};

export default async function SleepingServicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    genai?: string;
    similar?: string;
    tier?: string;
    capability?: string;
    hidetiming?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = parseBoardFilters(sp);
  const vm = buildViewModel(filters);
  const snapshot = safeSnapshot();

  // Local roman-numeral chain — sections render conditionally.
  let n = 0;
  const nextSection = () => ["I", "II", "III", "IV", "V"][n++] ?? `${n}`;

  const leadsByProduct: Record<string, string[]> = {};
  for (const row of vm.board) {
    leadsByProduct[row.product] = row.leads.map((d) => d.agency_abbr);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">FedRAMP → AI</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Sleeping services
            </div>
            <Link
              href="/fedramp/coverage"
              className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
            >
              ← Coverage hub
            </Link>
            <Link
              href="/fedramp/coverage/sleeping"
              className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
            >
              ↔ Product-level board
            </Link>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            The AI already <em className="italic">inside the shelf.</em>
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            FedRAMP authorizes packages, but the AI capability lives in the
            services inside them: Azure OpenAI inside Azure, Bedrock inside
            AWS, Textract, Translate, Kendra. An agency that holds the host
            package&rsquo;s ATO has the paperwork done — the service is
            legally in reach. This board finds the services where at least
            one peer agency reports real AI use while the ATO holder reports
            nothing, and asks the harder question: does the holder deploy{" "}
            <em className="italic">anything</em> in that capability class at
            all?
          </p>
          {vm.available ? (
            <p className="mt-3 max-w-prose text-[0.95rem] leading-[1.55] text-foreground/75">
              <span className="font-medium text-foreground">
                {formatNumber(vm.funnel.sleeping)}
              </span>{" "}
              sleeping (product × agency) pairs across the mapped services;{" "}
              <span className="font-medium text-foreground">
                {formatNumber(vm.funnel.nothing_similar)}
              </span>{" "}
              with nothing similar deployed, of which{" "}
              <span className="font-medium text-foreground">
                {formatNumber(vm.funnel.genai_void)}
              </span>{" "}
              are generative-AI capability voids.
            </p>
          ) : null}
        </div>
      </header>

      {!vm.available ? (
        <Section
          number="I"
          title="No data"
          lede="The sleeping-services sidecars aren't loaded in this DB build."
        >
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Run <code className="font-mono text-foreground">make fedramp</code>{" "}
            in the ETL workspace (crosswalk + capability labels), then sync
            the DB.{" "}
            {vm.error ? (
              <span className="font-mono text-[11px]">{vm.error}</span>
            ) : null}
          </p>
        </Section>
      ) : (
        <>
          <Section
            number={nextSection()}
            title="From reach to void"
            source="mixed"
            lede="How the headline number is built: every step is a filter, every count links to the rows behind it. Timing-excluded pairs leave the funnel before any counting."
          >
            <SleepingServicesFunnel funnel={vm.funnel} />
          </Section>

          {vm.grid.columns.length > 0 ? (
            <Section
              number={nextSection()}
              title="The frontier grid"
              source="mixed"
              lede="Gen-AI platforms × agencies. Filled squares report the product; hollow red squares hold the ATO, watch a peer use it, and report nothing in the class. Hover or focus any cell for dates, host packages, and lead users."
            >
              <div className="border-t-2 border-foreground pt-4">
                <FrontierGrid
                  columns={vm.grid.columns}
                  rows={vm.grid.rows}
                  leadsByProduct={leadsByProduct}
                />
              </div>
            </Section>
          ) : null}

          <Section
            number={nextSection()}
            title="The board"
            source="mixed"
            lede="One row per mapped product — named offerings first, hyperscaler catalog services after. Click a row for lead users and sleeping holders with timing and similar-capability evidence."
          >
            <div id="board" className="scroll-mt-28 border-t-2 border-foreground pt-4">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  Filter
                </span>
                <FilterChip href={qs(sp, {})} active={!filters.genai && !filters.voidOnly && !filters.tier && !filters.capability} label="All" />
                <FilterChip href={qs(sp, { genai: filters.genai ? null : "1" })} active={filters.genai} label="Gen-AI only" />
                <FilterChip href={qs(sp, { similar: filters.voidOnly ? null : "void" })} active={filters.voidOnly} label="Nothing similar" />
                <FilterChip href={qs(sp, { tier: filters.tier === "named_offering" ? null : "named_offering" })} active={filters.tier === "named_offering"} label="Named offerings" />
                <FilterChip href={qs(sp, { tier: filters.tier === "catalog" ? null : "catalog" })} active={filters.tier === "catalog"} label="Catalog services" />
              </div>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  Capability
                </span>
                {vm.capabilitiesPresent.map((c) => (
                  <FilterChip
                    key={c}
                    href={qs(sp, { capability: filters.capability === c ? null : c })}
                    active={filters.capability === c}
                    label={CAPABILITY_LABELS[c]}
                  />
                ))}
              </div>
              {vm.board.length === 0 ? (
                <EmptyState variant="bare" message="No services match the current filters." />
              ) : (
                <SleepingServicesBoard rows={vm.board} />
              )}
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {vm.board.length} of {vm.boardUnfilteredCount} mapped products shown
              </p>
            </div>
          </Section>

          {vm.matrix.rows.length > 0 ? (
            <Section
              number={nextSection()}
              title="Capability voids by agency"
              source="mixed"
              lede="The same data folded by capability class. A hollow red square means the agency has the capability in authorized reach, a peer has proven it in production, and the agency reports nothing of the kind."
            >
              <div className="border-t-2 border-foreground pt-4">
                <CapabilityMatrix categories={vm.matrix.categories} rows={vm.matrix.rows} />
              </div>
            </Section>
          ) : null}

          <Section
            number={nextSection()}
            title="Is it just too new?"
            source="mixed"
            lede="Age of the first host-package ATO behind every sleeping pair. If timing explained the gap, the mass would sit in the recent buckets — it doesn't."
          >
            <div className="border-t-2 border-foreground pt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Sleeping pairs by first-ATO age
                </p>
                <TimingChart rows={vm.timing} />
              </div>
              <div className="max-w-prose text-[0.92rem] leading-[1.55] text-foreground/80">
                <p>
                  {formatNumber(vm.funnel.timing_excluded)} pairs postdate the
                  2025 inventory cutoff (or entered a scope catalog inside the
                  snapshot&rsquo;s last 90 days) and are excluded from every
                  headline count — those agencies never had a reporting window.
                  They are this board&rsquo;s falsification test: if the gap is
                  real, they should convert to lead users or stay excluded next
                  cycle, not migrate into the sleeping column.
                </p>
                <p className="mt-3 text-[0.85rem] text-muted-foreground">
                  Blind spot, stated plainly: the marketplace does not publish
                  when a service entered a package&rsquo;s scope catalog (only
                  a 90-day recency flag), so an old host ATO is an upper bound
                  on how long the service was in reach — not proof it was
                  available the whole time.
                </p>
              </div>
            </div>
          </Section>

          <div className="mt-14 border border-border p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              How to read this page
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 text-[0.85rem] leading-[1.5] text-foreground/80 md:grid-cols-3">
              <p>
                <span className="font-medium text-foreground">In reach ≠ enabled.</span>{" "}
                A service in an authorized package&rsquo;s scope catalog is
                legally available under the agency&rsquo;s existing ATO. It
                says nothing about whether the agency switched it on — that is
                exactly the gap being measured.
              </p>
              <p>
                <span className="font-medium text-foreground">Two evidence tiers.</span>{" "}
                <MonoChip tone="ink" size="xs">named offering</MonoChip> rows
                (Ask Sage In a Box, Claude for Government…) reflect a specific
                vendor relationship — strong signal.{" "}
                <MonoChip tone="muted" size="xs">catalog</MonoChip> rows ride
                along with any hyperscaler ATO — meaningful mainly as
                capability voids, not as underreporting.
              </p>
              <p>
                <span className="font-medium text-foreground">Provenance.</span>{" "}
                Service→product crosswalk: curated CSV (42 services, 31
                products). &ldquo;Nothing similar&rdquo;: LLM capability labels
                over every product with a use-case edge, QC-audited
                (product_capability_2026_07). Inventory absence can also mean a
                lawful exemption — law-enforcement-sensitive uses need not be
                published.
              </p>
            </div>
          </div>
        </>
      )}

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function qs(
  current: Record<string, string | undefined>,
  patch: Record<string, string | null>,
) {
  const params = new URLSearchParams();
  for (const k of ["genai", "similar", "tier", "capability", "hidetiming"]) {
    const v = patch[k] !== undefined ? patch[k] : current[k];
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s
    ? `/fedramp/coverage/sleeping-services?${s}#board`
    : "/fedramp/coverage/sleeping-services#board";
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
    <Link href={href} scroll={false} className={`${base} ${active ? activeRing : idle}`}>
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

import Link from "next/link";
import {
  getAgenciesHoldingAto,
  getAiClassificationCounts,
  getFedrampSnapshot,
  getUnlinkedAiByAgency,
  getUnlinkedAiProducts,
  hasAiClassification,
} from "@/lib/db";
import type {
  AiClassificationCounts,
  FedrampSnapshot,
  UnlinkedAiByAgencyRow,
  UnlinkedAiProductRow,
} from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section } from "@/components/editorial";
import {
  UnlinkedAiTable,
  type UnlinkedAiTableRow,
} from "./_sections/unlinked-ai-table";

export const metadata = {
  title: "Unlinked AI products · FedRAMP × AI Inventory",
  description:
    "FedRAMP cloud products an independent LLM review judged to be AI/ML offerings — most fully authorized, some still in the pipeline — that appear in no agency AI use-case inventory. AI by classification, not by inventory linkage.",
};

const IMPACT_RANK: Record<string, number> = {
  High: 3,
  Moderate: 2,
  "Li-SaaS": 1,
  Low: 0,
};

/** URL `status` param → the marketplace statuses it admits. */
const STATUS_FILTERS: Record<string, string[]> = {
  authorized: ["FedRAMP Authorized"],
  ready: ["FedRAMP Ready"],
  in_process: ["Agency Authorization In Process", "FedRAMP In Process"],
};

export default async function UnlinkedAiPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; impact?: string; status?: string }>;
}) {
  const sp = await searchParams;
  // Core AI is the default lens — primary-purpose AI tools are the story;
  // `cat=all` widens to the AI-featured platforms (AWS, Azure, …).
  const catFilter = (sp.cat ?? "core_ai").toLowerCase();
  const impactFilter = (sp.impact ?? "").toLowerCase();
  const statusFilter = (sp.status ?? "").toLowerCase();

  if (!hasAiClassification()) {
    return <NotClassified />;
  }

  let products: UnlinkedAiProductRow[] = [];
  let counts: AiClassificationCounts | null = null;
  let byAgency: UnlinkedAiByAgencyRow[] = [];
  let error: string | null = null;
  try {
    products = getUnlinkedAiProducts();
    counts = getAiClassificationCounts();
    byAgency = getUnlinkedAiByAgency(15);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error.";
  }
  const snapshot = safeSnapshot();

  const distinctImpacts = Array.from(
    new Set(products.map((p) => p.impact_level).filter((v): v is string => Boolean(v))),
  ).sort((a, b) => (IMPACT_RANK[b] ?? -1) - (IMPACT_RANK[a] ?? -1));

  const admittedStatuses = STATUS_FILTERS[statusFilter];
  const filtered = products.filter((p) => {
    if (catFilter !== "all" && p.category !== catFilter) return false;
    if (impactFilter && (p.impact_level ?? "").toLowerCase() !== impactFilter) return false;
    if (admittedStatuses && !admittedStatuses.includes(p.status)) return false;
    return true;
  });

  // Pre-fetch the ATO-holding agency list per row (bounded — handful each).
  const withDetail: UnlinkedAiTableRow[] = filtered.map((p) => ({
    ...p,
    _agencies: getAgenciesHoldingAto(p.fedramp_id),
  }));

  const maxAgency = byAgency.reduce((m, a) => Math.max(m, a.unlinked_ai_ato_count), 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">FedRAMP → AI</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Unlinked AI products
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
            FedRAMP&rsquo;d AI <em className="italic">nobody&rsquo;s reporting.</em>
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            Every product below is an AI/ML cloud offering on the FedRAMP
            marketplace that appears in{" "}
            <span className="font-medium text-foreground">no</span>{" "}
            agency&rsquo;s 2025 AI use-case inventory. Most have completed
            authorization &mdash; capability the government has already done
            the security work to allow, sitting unused (or at least
            unreported); the rest are still in the Ready / In&nbsp;Process
            pipeline, filterable below.
          </p>
          {counts ? (
            <p className="mt-3 max-w-prose text-[0.95rem] leading-[1.55] text-foreground/75">
              <span className="font-medium text-foreground">
                {formatNumber(counts.ai_unlinked)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">
                {formatNumber(counts.core_ai + counts.ai_featured)}
              </span>{" "}
              FedRAMP AI products are absent from the inventory (
              {formatNumber(counts.ai_linked)} are linked and appear on the
              other coverage boards). Of the absent set,{" "}
              <span className="font-medium text-foreground">
                {formatNumber(counts.ai_unlinked_authorized)}
              </span>{" "}
              are fully FedRAMP Authorized,{" "}
              <span className="font-medium text-foreground">
                {formatNumber(counts.ai_unlinked_pipeline)}
              </span>{" "}
              are still in the pipeline, and{" "}
              <span className="font-medium text-foreground">
                {formatNumber(
                  products.filter((p) => p.category === "core_ai").length,
                )}
              </span>{" "}
              are primary-purpose AI tools.
            </p>
          ) : null}
          <p className="mt-3 max-w-prose text-[0.85rem] leading-[1.5] text-muted-foreground">
            Timing note: the 2025 inventories closed before FedRAMP&rsquo;s
            Jan&ndash;Feb&nbsp;2026 20x AI authorizations, so the newest
            listings could not have been reported yet.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Click any row for the classification reasoning and the agencies holding an ATO.
          </p>
        </div>
      </header>

      <div data-coverage-content="1">
        {error ? (
          <Section number="I" title="Error" lede="The classification query failed.">
            <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
              <span className="font-mono text-[11px]">{error}</span>
            </p>
          </Section>
        ) : (
          <>
            <Section
              number="I"
              title="Two ways to be “AI”"
              lede="This board uses a different AI definition than the rest of coverage. The distinction is load-bearing — read it before reading the numbers."
            >
              <div className="border-t-2 border-foreground pt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="border border-border p-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    AI by linkage · the rest of coverage
                  </p>
                  <p className="text-[0.92rem] leading-[1.5] text-foreground/85">
                    Every other coverage board treats a FedRAMP product as
                    &ldquo;AI&rdquo; only if it links to a curated product in
                    the inventory&rsquo;s AI catalog. Precise, but blind to AI
                    tools the inventory never named.
                  </p>
                </div>
                <div className="border border-foreground p-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)]">
                    AI by classification · this board
                  </p>
                  <p className="text-[0.92rem] leading-[1.5] text-foreground/85">
                    An independent LLM review reads each FedRAMP listing
                    (provider, offering, service description, business
                    functions) and judges whether it is a{" "}
                    <span className="font-medium text-foreground">Core AI</span>{" "}
                    offering (primary purpose is AI/ML) or{" "}
                    <span className="font-medium text-foreground">AI-featured</span>{" "}
                    (ships material AI as a feature). This board shows only the
                    classified-AI products with <em>no</em> inventory link.
                  </p>
                  {snapshot ? (
                    <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                      FedRAMP snapshot {formatDate(snapshot.snapshot_date)}
                    </p>
                  ) : null}
                </div>
              </div>
            </Section>

            {byAgency.length > 0 ? (
              <Section
                number="II"
                title="Who's sitting on the most"
                lede="Agencies ranked by how many of these absent-from-inventory AI products they personally hold an ATO for. A high bar means an agency has authorized a lot of AI it isn't reporting in its inventory."
              >
                <div className="border-t-2 border-foreground pt-4">
                  <ul className="space-y-1.5">
                    {byAgency.map((a) => (
                      <li key={a.inventory_agency_id} className="flex items-center gap-3">
                        <Link
                          href={`/agencies/${a.agency_abbreviation}`}
                          className="w-24 shrink-0 truncate font-mono text-[11px] uppercase tracking-[0.1em] text-foreground hover:text-[var(--stamp)]"
                          title={a.agency_name}
                        >
                          {a.agency_abbreviation}
                        </Link>
                        <div className="relative h-4 flex-1 bg-muted/40">
                          <div
                            className="absolute inset-y-0 left-0 bg-[var(--stamp)]/80"
                            style={{
                              width: `${maxAgency > 0 ? (a.unlinked_ai_ato_count / maxAgency) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right font-display italic tabular-nums text-foreground">
                          {formatNumber(a.unlinked_ai_ato_count)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>
            ) : null}

            <Section
              number={byAgency.length > 0 ? "III" : "II"}
              title="By product"
              lede="One row per classified-AI FedRAMP product with no inventory link. Filter by AI class, marketplace status, or impact level; sort by any column; click a row to expand."
            >
              <div className="border-t-2 border-foreground pt-4 mb-5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground mr-1">
                  Class
                </span>
                <FilterChip
                  href={qs({ cat: null, impact: impactFilter || null, status: statusFilter || null })}
                  active={catFilter === "core_ai"}
                  label="Core AI"
                />
                <FilterChip
                  href={qs({ cat: "ai_featured", impact: impactFilter || null, status: statusFilter || null })}
                  active={catFilter === "ai_featured"}
                  label="AI-featured"
                />
                <FilterChip
                  href={qs({ cat: "all", impact: impactFilter || null, status: statusFilter || null })}
                  active={catFilter === "all"}
                  label="All"
                />
                <span className="ml-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground mr-1">
                  Status
                </span>
                <FilterChip
                  href={qs({ cat: sp.cat ?? null, impact: impactFilter || null, status: null })}
                  active={!statusFilter}
                  label="All"
                />
                <FilterChip
                  href={qs({ cat: sp.cat ?? null, impact: impactFilter || null, status: "authorized" })}
                  active={statusFilter === "authorized"}
                  label="Authorized"
                />
                <FilterChip
                  href={qs({ cat: sp.cat ?? null, impact: impactFilter || null, status: "ready" })}
                  active={statusFilter === "ready"}
                  label="Ready"
                />
                <FilterChip
                  href={qs({ cat: sp.cat ?? null, impact: impactFilter || null, status: "in_process" })}
                  active={statusFilter === "in_process"}
                  label="In Process"
                />
                <span className="ml-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground mr-1">
                  Impact
                </span>
                <FilterChip
                  href={qs({ cat: sp.cat ?? null, impact: null, status: statusFilter || null })}
                  active={!impactFilter}
                  label="All"
                />
                {distinctImpacts.map((lvl) => (
                  <FilterChip
                    key={lvl}
                    href={qs({ cat: sp.cat ?? null, impact: lvl.toLowerCase(), status: statusFilter || null })}
                    active={impactFilter === lvl.toLowerCase()}
                    label={lvl}
                  />
                ))}
              </div>

              {withDetail.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No products match the current filter.
                </p>
              ) : (
                <UnlinkedAiTable rows={withDetail} />
              )}
            </Section>
          </>
        )}
      </div>

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function qs({
  cat,
  impact,
  status,
}: {
  cat: string | null;
  impact: string | null;
  status: string | null;
}) {
  const params = new URLSearchParams();
  if (cat) params.set("cat", cat);
  if (impact) params.set("impact", impact);
  if (status) params.set("status", status);
  const s = params.toString();
  return s ? `/fedramp/coverage/unlinked-ai?${s}` : "/fedramp/coverage/unlinked-ai";
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
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

function NotClassified() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <Section
        number="I"
        title="Classification not loaded"
        lede="The FedRAMP AI classification table isn't present in this database build."
      >
        <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
          Run{" "}
          <code className="font-mono text-foreground">
            scripts/classify_fedramp_ai.py
          </code>{" "}
          then{" "}
          <code className="font-mono text-foreground">
            scripts/apply_fedramp_ai_classification.py --apply
          </code>{" "}
          in the ETL repo and re-sync the database.
        </p>
      </Section>
    </div>
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

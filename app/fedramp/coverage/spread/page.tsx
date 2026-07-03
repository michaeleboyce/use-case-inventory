import Link from "next/link";
import {
  getAgenciesHoldingAto,
  getAuthorizedCoreAiSpread,
  getFedrampSnapshot,
  getFrontierTrioStatus,
  getSpreadCounts,
  hasAiClassification,
} from "@/lib/db";
import type {
  CoreAiSpreadRow,
  FedrampSnapshot,
  FrontierProductStatus,
  SpreadCounts,
} from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section, Figure, MonoChip } from "@/components/editorial";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { SpreadTable, type SpreadTableRow } from "./_sections/spread-table";
import { Fn, FootnoteList } from "./_sections/footnotes";

export const metadata = {
  title: "Authorization vs adoption · FedRAMP × AI Inventory",
  description:
    "FedRAMP's premise is authorize once, reuse everywhere. For AI it mostly isn't happening: most authorized core-AI products never spread past a single agency ATO, and the 20x frontier products show zero recorded reuse — while adoption flows through OneGov channels the ledger doesn't see.",
};

// Bucket colors: single-ATO is the vermilion "problem" bar; spread is calmer.
const ATO_BUCKET_COLORS: Record<string, string> = {
  "0–1 ATOs (never spread)": "#d84b33",
  "2–3 ATOs": "#b98a2f",
  "4+ ATOs": "#3d7a54",
};

/** cso name → its marketplace-listing footnote number (see _sections/footnotes). */
const FRONTIER_FOOTNOTE: Record<string, number> = {
  "ChatGPT Enterprise and API Platform": 1,
  "Gemini for Government": 2,
  "Perplexity Enterprise and API Platform": 3,
};

export default function SpreadPage() {
  if (!hasAiClassification()) {
    return <NotClassified />;
  }

  let rows: CoreAiSpreadRow[] = [];
  let counts: SpreadCounts | null = null;
  let trio: FrontierProductStatus[] = [];
  let error: string | null = null;
  try {
    rows = getAuthorizedCoreAiSpread();
    counts = getSpreadCounts();
    trio = getFrontierTrioStatus();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error.";
  }
  const snapshot = safeSnapshot();

  const buckets = [
    {
      label: "0–1 ATOs (never spread)",
      count: rows.filter((r) => r.ato_count <= 1).length,
    },
    { label: "2–3 ATOs", count: rows.filter((r) => r.ato_count >= 2 && r.ato_count <= 3).length },
    { label: "4+ ATOs", count: rows.filter((r) => r.ato_count >= 4).length },
  ];

  const withDetail: SpreadTableRow[] = rows.map((r) => ({
    ...r,
    _agencies: getAgenciesHoldingAto(r.fedramp_id),
  }));

  const pairsNoUse = counts
    ? counts.ato_pairs - counts.ato_pairs_with_reported_use
    : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">FedRAMP → AI</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Authorization vs adoption
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
            Authorized once. <em className="italic">Adopted where?</em>
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            FedRAMP&rsquo;s design premise is{" "}
            <span className="font-medium text-foreground">
              authorize once, reuse everywhere
            </span>
            : one agency does the security review, every other agency can adopt
            the package.<Fn n={11} first /> For AI, the marketplace ledger says
            the reuse mostly is not happening —{" "}
            {counts ? (
              <>
                <span className="font-medium text-foreground">
                  {formatNumber(counts.single_ato)} of{" "}
                  {formatNumber(counts.authorized_core_ai)}
                </span>{" "}
                fully authorized primary-purpose AI products have never picked
                up a second agency ATO
              </>
            ) : (
              "most fully authorized primary-purpose AI products have never picked up a second agency ATO"
            )}
            , and the frontier chat products authorized under the 20x program
            show zero recorded reuse.<Fn n={1} first />
            <Fn n={2} first />
            <Fn n={3} first /> But the ledger is only half the story: real
            adoption now flows through OneGov deals and shared platforms the
            marketplace doesn&rsquo;t record.
          </p>
          {snapshot?.snapshot_date ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              FedRAMP snapshot {formatDate(snapshot.snapshot_date)} · AI class by independent LLM review
            </p>
          ) : null}
        </div>
      </header>

      {error ? (
        <Section number="I" title="Error" lede="The spread queries failed.">
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            <span className="font-mono text-[11px]">{error}</span>
          </p>
        </Section>
      ) : (
        <>
          <Section
            number="I"
            title="One ATO, then silence"
            lede="Every FedRAMP-Authorized core-AI product, by how many agencies hold an ATO for it. The sponsoring agency's own ATO is the first one — a product that never moves past one was authorized but never spread."
          >
            <div className="border-t-2 border-foreground pt-4">
              {counts ? (
                <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                  <StatTile
                    value={formatNumber(counts.authorized_core_ai)}
                    label="Authorized core-AI products"
                  />
                  <StatTile
                    value={formatNumber(counts.single_ato)}
                    label="Stuck at a single ATO"
                    accent
                  />
                  <StatTile
                    value={formatNumber(counts.multi_ato)}
                    label="Spread to 2+ agencies"
                  />
                  <StatTile
                    value={`${formatNumber(counts.ato_pairs_with_reported_use)} of ${formatNumber(counts.ato_pairs)}`}
                    label="ATO'd pairs with reported use"
                    title="Of the agency × product ATO pairs mappable to an inventory agency, how many are corroborated by a reported use case at that agency."
                  />
                </div>
              ) : null}

              <Figure
                eyebrow="Distribution"
                caption="FedRAMP-Authorized core-AI products by count of distinct ATO-holding agencies. Marketplace ledger; ATO reuse the ledger hasn't recorded is not counted."
              >
                <HorizontalBarChart
                  data={buckets}
                  colorMap={ATO_BUCKET_COLORS}
                  labelMap={{
                    "0–1 ATOs (never spread)": "0–1 ATOs (never spread)",
                    "2–3 ATOs": "2–3 ATOs",
                    "4+ ATOs": "4+ ATOs",
                  }}
                  height={170}
                  labelWidth={160}
                />
              </Figure>

              <p className="mt-4 max-w-prose text-[0.9rem] leading-[1.5] text-muted-foreground">
                The <span className="text-foreground">reported-use</span> column
                below carries the second gap: even where an agency holds the
                ATO, its 2025 inventory usually reports no use case naming the
                product{counts ? ` (${formatNumber(pairsNoUse)} of ${formatNumber(counts.ato_pairs)} ATO'd pairs)` : ""}.
                Only ~35% of 2025 use cases name a linkable product at all, so
                read that as &ldquo;no reported use,&rdquo; not &ldquo;no
                use.&rdquo;
              </p>
            </div>
          </Section>

          <Section
            number="II"
            title="By product"
            lede="One row per authorized core-AI product. Sort by any column; click a row for the agencies holding its ATOs."
          >
            <div className="border-t-2 border-foreground pt-4">
              <SpreadTable rows={withDetail} />
            </div>
          </Section>

          <Section
            number="III"
            title="The 20x frontier products"
            lede="FedRAMP's 2025–26 AI prioritization fast-tracked the frontier chat platforms. Each cleared the program pathway — and each shows a ledger with one program-level authorization and zero agency reuses."
          >
            <div className="border-t-2 border-foreground pt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
              {trio.map((p) => (
                <FrontierCard
                  key={p.fedramp_id}
                  product={p}
                  footnote={FRONTIER_FOOTNOTE[p.cso] ?? 1}
                />
              ))}
            </div>

            <div className="mt-6 border border-border bg-muted/20 p-5">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)]">
                The counter-story · Anthropic
              </p>
              <p className="max-w-prose text-[0.92rem] leading-[1.5] text-foreground/85">
                Claude never appeared on the FedRAMP marketplace at all — yet
                agencies deployed it enterprise-wide through the same OneGov
                channel (HHS rolled it out to all staff in December 2025). On
                February 27, 2026 a presidential directive ordered agencies to
                cease all use of Anthropic technology, the Defense Department
                designated the company a supply-chain risk, and GSA removed it
                from USAi and terminated its schedule listings.<Fn n={10} first />{" "}
                Adoption and un-adoption both happened without the marketplace
                ledger moving.
              </p>
            </div>

            <p className="mt-4 max-w-prose text-[0.85rem] leading-[1.5] text-muted-foreground">
              Timing note: the 2025 use-case inventories closed before these
              authorizations landed, so none of the three can appear in the
              inventory data on this site yet. The zero that matters here is in
              FedRAMP&rsquo;s own reuse ledger, months after authorization.
            </p>
          </Section>

          <Section
            number="IV"
            title="Where adoption actually shows up"
            lede="If the ledger says nobody adopted these products, the procurement record says otherwise. The channels just don't write back to the marketplace."
          >
            <div className="border-t-2 border-foreground pt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3 text-[0.95rem] leading-[1.55] text-foreground/85">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  OneGov · buy first, authorize later
                </p>
                <p>
                  GSA priced the frontier platforms at token rates for every
                  agency at once: ChatGPT Enterprise at $1 per agency for
                  2026,<Fn n={4} first /> Google&rsquo;s stack — Gemini included
                  — at $0.47 per agency through 2026,<Fn n={5} first /> and
                  Perplexity at $0.25 per agency over 18 months, the first
                  direct-to-government deal of its kind.<Fn n={6} first />{" "}
                  Procurement stopped being the bottleneck before the
                  authorizations even landed.
                </p>
              </div>
              <div className="space-y-3 text-[0.95rem] leading-[1.55] text-foreground/85">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Shared platforms · one ATO, many tenants
                </p>
                <p>
                  GSA&rsquo;s USAi platform serves models from OpenAI, Google,
                  Anthropic (until February 2026), Meta, and xAI to{" "}
                  <span className="font-medium text-foreground">
                    15 agencies with more on a waiting list
                  </span>
                  , under GSA&rsquo;s umbrella rather than per-agency ATOs
                  — and becomes a paid, cost-recoverable service in fiscal
                  2027.<Fn n={7} first /> On the military side, GenAI.mil put
                  Gemini in front of 3&nbsp;million personnel and passed a
                  million unique users in about a month (vendor-reported;
                  Department of War systems sit outside this site&rsquo;s
                  civilian inventory scope).<Fn n={8} first />
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-prose text-[0.95rem] leading-[1.55] text-foreground/85">
              OpenAI itself reports 90,000+ users across 3,500+ federal, state,
              and local agencies sending 18&nbsp;million messages since 2024 —
              a vendor-reported figure that spans far more than the federal
              enterprise channel.<Fn n={9} first /> The honest synthesis: the
              marketplace ledger measures the{" "}
              <span className="font-medium text-foreground">old</span> adoption
              channel (agency-by-agency ATO reuse), and the new channels —
              OneGov pricing, shared platforms, tenancy on already-authorized
              clouds — bypass it. Zero recorded reuse is real evidence that
              per-agency authorization isn&rsquo;t spreading; it is{" "}
              <span className="font-medium text-foreground">not</span> evidence
              that nobody is using the tools. The truth for most products on
              this board sits between &ldquo;sitting on the shelf&rdquo; and
              &ldquo;adopted invisibly.&rdquo;
            </p>
          </Section>

          <Section
            number="V"
            title="Sources & method"
            lede="Ledger numbers are computed live from the FedRAMP snapshot; the adoption record is cited below. Every URL was fetched and verified against its claim on July 3, 2026."
          >
            <div className="border-t-2 border-foreground pt-4">
              <FootnoteList />
              <p className="mt-6 max-w-prose text-[0.85rem] leading-[1.5] text-muted-foreground">
                Method: &ldquo;core AI&rdquo; is the independent per-listing LLM
                classification (primary purpose is AI/ML) described on the{" "}
                <Link href="/fedramp/coverage" className="text-[var(--stamp)] underline underline-offset-2">
                  coverage hub
                </Link>
                . ATO counts are distinct authorizing agencies in the marketplace
                ledger; reuse counts are the marketplace&rsquo;s own tally. Both
                under-record adoption that happens off-ledger — that asymmetry
                is this page&rsquo;s subject, not a footnote to it.
              </p>
            </div>
          </Section>
        </>
      )}

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function StatTile({
  value,
  label,
  accent = false,
  title,
}: {
  value: string;
  label: string;
  accent?: boolean;
  title?: string;
}) {
  return (
    <div className="border-t-2 border-foreground pt-2" title={title}>
      <div
        className={`font-display text-[2rem] italic leading-[0.95] tracking-[-0.02em] tabular-nums ${accent ? "text-[var(--stamp)]" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function FrontierCard({
  product,
  footnote,
}: {
  product: FrontierProductStatus;
  footnote: number;
}) {
  const authorized = product.status === "FedRAMP Authorized";
  return (
    <div className="border border-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">{product.csp}</p>
        <MonoChip tone={authorized ? "verified" : "muted"} size="xs">
          {authorized ? "Authorized" : product.status}
        </MonoChip>
      </div>
      <p className="mt-0.5 text-[0.85rem] leading-snug text-muted-foreground">
        {product.cso}
        <Fn n={footnote} />
      </p>
      <dl className="mt-3 space-y-1.5 font-mono text-[11px] text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt className="uppercase tracking-[0.1em]">Authorized</dt>
          <dd className="text-foreground">
            {product.auth_date ? formatDate(product.auth_date) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="uppercase tracking-[0.1em]">Impact</dt>
          <dd className="text-foreground">{product.impact_level ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="uppercase tracking-[0.1em]">Ledger reuses</dt>
          <dd className="text-[var(--stamp)]">{formatNumber(product.reuse_count)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="uppercase tracking-[0.1em]">ATO holders</dt>
          <dd className="text-right text-foreground">
            {product.ato_holders.length === 0
              ? "none recorded"
              : product.ato_holders.map((a) => a.agency_name).join(", ")}
          </dd>
        </div>
      </dl>
      <p className="mt-3">
        <MonoChip href={`/fedramp/marketplace/products/${product.fedramp_id}`} tone="stamp" size="xs">
          {product.fedramp_id}
        </MonoChip>
      </p>
    </div>
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

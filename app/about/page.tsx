import { ExternalLink } from "lucide-react";
import {
  Section,
  Figure,
  Eyebrow,
  MonoChip,
} from "@/components/editorial";
import {
  getAgencyInventoryLinks,
  getGlobalStats,
  getLastUpdatedDate,
} from "@/lib/db";
import { formatDate, formatNumber } from "@/lib/formatting";
import { DATA_QUALITY_ISSUES, TAG_SCHEMA } from "./_sections/about-content";

export const metadata = {
  title: "Colophon · Federal AI Use Case Inventory",
};

export default function AboutPage() {
  const stats = getGlobalStats();
  const agencies = getAgencyInventoryLinks();
  const lastUpdated = getLastUpdatedDate();

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      {/* HERO — editorial nameplate */}
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-4">
            <div>
              <div className="eyebrow mb-1.5 !text-[var(--stamp)]">§ Colophon</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Masthead · Methodology
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                OMB M-25-21 · Cycle 2025
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <div>
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Last updated
                </div>
                <div className="text-foreground">{formatDate(lastUpdated)}</div>
              </div>
              <div>
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Aggregate
                </div>
                <div className="text-foreground">
                  {formatNumber(stats.total_use_cases)} uc ·{" "}
                  {formatNumber(stats.total_consolidated)} cons
                </div>
              </div>
              <div>
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Coverage
                </div>
                <div className="text-foreground">
                  {stats.total_agencies_with_data}/{stats.total_agencies}{" "}
                  agencies
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-[-0.02em] text-foreground">
            How this issue
            <br />
            was put together.
          </h1>

          <p className="mt-8 max-w-prose font-body text-[1.05rem] leading-[1.55] text-foreground/85">
            <span className="float-left mr-2 font-display italic text-[3.6rem] leading-[0.82] text-foreground">
              T
            </span>
            his dashboard is a structured view of the 2025 Federal AI Use Case
            Inventory — {formatNumber(stats.total_use_cases)} individual use
            cases and {formatNumber(stats.total_consolidated)} consolidated
            entries, reported by{" "}
            {formatNumber(stats.total_agencies_with_data)} agencies per OMB
            Memorandum M-25-21. Every source file was downloaded directly from
            the publishing agency, parsed verbatim, and then passed through a
            three-stage tagging pipeline. This page documents the schema, the
            sources, and the known gaps.
          </p>
        </div>
      </header>

      {/* § I · Collection pipeline — methodology prose */}
      <Section
        number="I"
        title="How the data was collected"
        lede={`Browser-saved CSV / XLSX downloads from ${stats.total_agencies_with_data} agency inventory pages, parsed verbatim and retagged.`}
      >
        <div className="max-w-prose space-y-5 font-body text-[1rem] leading-[1.6] text-foreground/90">
          <p>
            Each agency publishes its AI use case inventory as required by OMB{" "}
            <a
              href="https://www.whitehouse.gov/wp-content/uploads/2025/04/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:text-[var(--stamp)] hover:underline"
            >
              Memorandum M-25-21
              <ExternalLink className="size-3" aria-hidden />
            </a>
            . We downloaded each agency&apos;s file directly from its published
            location, preserving the source link in the database for
            provenance.
          </p>
          <p>
            Source files were parsed with format-specific loaders (CSV, XLSX,
            and — in one case — a nested JSON export). The M-25-21 schema has
            roughly thirty fields per use case across five sections; every raw
            field is stored verbatim on{" "}
            <code className="border border-border bg-background px-1 py-0.5 font-mono text-xs">
              use_cases
            </code>{" "}
            or{" "}
            <code className="border border-border bg-background px-1 py-0.5 font-mono text-xs">
              consolidated_use_cases
            </code>
            .
          </p>

          <div className="mt-8 border-t-2 border-foreground pt-5">
            <Eyebrow color="stamp">§ Tagging pipeline</Eyebrow>
            <ol className="mt-3 space-y-4 font-body text-[1rem] leading-[1.6]">
              <li>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--stamp)]">
                  01 · Auto-tagger.
                </span>{" "}
                A rule-based first pass classifies every entry on entry_type,
                ai_sophistication, vendor family, and the binary flags. Rules
                are deliberately narrow — when any rule fires it writes a tag;
                when none do, the field stays null.
              </li>
              <li>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--stamp)]">
                  02 · Per-agency sub-agent review.
                </span>{" "}
                For each agency, a long-context pass inspects ambiguous entries
                (missing or conflicting tags, unusual vendor names, unclear
                scope) and either fills in tags or leaves a note explaining why
                the entry is genuinely ambiguous.
              </li>
              <li>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--stamp)]">
                  03 · Cross-reference review.
                </span>{" "}
                A final pass normalizes tags across agencies: the same product
                should map to the same{" "}
                <code className="border border-border bg-background px-1 py-0.5 font-mono text-xs">
                  product_id
                </code>{" "}
                even across spelling variants; the same reusable pattern should
                resolve to the same{" "}
                <code className="border border-border bg-background px-1 py-0.5 font-mono text-xs">
                  template_id
                </code>
                .
              </li>
            </ol>
            <p className="mt-5 text-[0.95rem] text-muted-foreground">
              Maturity tiers — leading / progressing / early / minimal — are
              computed from the aggregates in{" "}
              <code className="border border-border bg-background px-1 py-0.5 font-mono text-xs">
                agency_ai_maturity
              </code>{" "}
              using thresholds documented in the data repo.
            </p>
          </div>
        </div>
      </Section>

      {/* § II · Schema reference — hairline definition lists */}
      <Section
        number="II"
        title="Tag schema"
        lede="Every use case carries a row in use_case_tags. Nulls mean 'not applicable or unknown' — the auto-tagger never guesses."
      >
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
          {TAG_SCHEMA.map((section) => (
            <Figure key={section.section} eyebrow={`§ ${section.section}`}>
              <dl className="divide-y divide-border">
                {section.fields.map((f) => (
                  <div
                    key={f.key}
                    className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-4 py-3"
                  >
                    <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground">
                      {f.label}
                    </dt>
                    <dd className="space-y-2">
                      <p className="font-body text-sm leading-snug text-muted-foreground">
                        {f.description}
                      </p>
                      {f.values ? (
                        <div className="flex flex-wrap gap-1">
                          {f.values.map((v) => (
                            <MonoChip key={v} tone="muted" size="xs">
                              {v}
                            </MonoChip>
                          ))}
                        </div>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </Figure>
          ))}
        </div>
      </Section>

      {/* § III · Errata — stamp-style */}
      <Section
        number="III"
        title="Errata"
        lede="Known data-quality issues. Each is handled in the importer; they are listed here so downstream users understand the caveats."
      >
        <div className="border-t-2 border-foreground pt-4">
          <div className="mb-5 inline-block">
            <div className="stamp">Errata · Caveat Lector</div>
          </div>
          <ol className="space-y-4 font-mono text-[12px] leading-[1.55] text-foreground/90">
            {DATA_QUALITY_ISSUES.map((issue, i) => (
              <li
                key={issue.title}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 border-b border-dotted border-border pb-4 last:border-b-0"
              >
                <span className="pt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)]">
                  № {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground">
                    {issue.title}
                  </div>
                  <p className="mt-1 font-body text-[0.95rem] leading-[1.55] text-muted-foreground">
                    {issue.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* § IV · Data sources — full ranked list of reporting agencies */}
      <Section
        number="IV"
        title="Sources"
        lede="Primary guidance, the consolidated portal, and every per-agency inventory page behind this database."
      >
        <div className="space-y-10">
          <Figure eyebrow="§ Primary guidance">
            <ul className="divide-y divide-border">
              <li className="flex items-baseline justify-between gap-4 py-3">
                <a
                  href="https://www.whitehouse.gov/wp-content/uploads/2025/04/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 font-body text-base text-foreground underline-offset-4 hover:text-[var(--stamp)] hover:underline"
                >
                  OMB Memorandum M-25-21
                  <ExternalLink className="size-3" aria-hidden />
                </a>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Reporting guidance
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-4 py-3">
                <a
                  href="https://ai.gov/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 font-body text-base text-foreground underline-offset-4 hover:text-[var(--stamp)] hover:underline"
                >
                  AI.gov
                  <ExternalLink className="size-3" aria-hidden />
                </a>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Consolidated federal portal
                </span>
              </li>
            </ul>
          </Figure>

          <Figure
            eyebrow={`§ Agency inventories · ${agencies.length} filings`}
            caption="Click an abbreviation to jump to the agency's record on this site; the link at right goes to the agency's own published inventory page."
          >
            <ol className="divide-y divide-border">
              {agencies.map((a, i) => (
                <li
                  key={a.id}
                  className="grid grid-cols-[3rem_5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 py-2"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    № {String(i + 1).padStart(2, "0")}
                  </span>
                  <MonoChip href={`/agencies/${a.abbreviation}`} tone="ink" size="sm">
                    {a.abbreviation}
                  </MonoChip>
                  <span className="truncate font-body text-sm text-foreground">
                    {a.name}
                  </span>
                  {a.inventory_page_url ? (
                    <a
                      href={a.inventory_page_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
                      title={a.name}
                    >
                      Inventory
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
                      —
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </Figure>
        </div>
      </Section>

      {/* § V · Credits — colophon */}
      <section className="mt-16 border-t-2 border-foreground pt-6 md:mt-24">
        <div className="grid grid-cols-12 gap-x-6">
          <div className="col-span-12 md:col-span-3">
            <Eyebrow color="stamp">§ Credits</Eyebrow>
          </div>
          <div className="col-span-12 md:col-span-9">
            <dl className="divide-y divide-border border-b border-border font-mono text-[11px] uppercase tracking-[0.14em]">
              <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 py-3">
                <dt className="text-muted-foreground">Issue</dt>
                <dd className="text-foreground">
                  No. 001 · OMB M-25-21 · Cycle 2025
                </dd>
              </div>
              <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 py-3">
                <dt className="text-muted-foreground">Set in</dt>
                <dd className="text-foreground">
                  System serif · platform monospace
                </dd>
              </div>
              <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 py-3">
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="text-foreground tabular-nums">
                  {formatDate(lastUpdated)}
                </dd>
              </div>
            </dl>
            <p className="mt-5 max-w-prose font-body text-sm leading-[1.55] text-muted-foreground">
              A longitudinal reference for federal AI adoption, built from
              agency submissions under OMB M-25-21. The inventory database
              powers reporting, benchmarking, and comparison across agencies.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

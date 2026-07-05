/**
 * Home hero — the editorial nameplate: filing-meta rail, three-line
 * headline with the highlight underline, drop-cap lede, and the
 * "By the numbers" ledger. Extracted verbatim from app/page.tsx during
 * the front-door rebuild; the numbers were corrected in the Phase-1
 * data fixes (canonical product count + separate deployments row).
 */
import Link from "next/link";
import { formatNumber } from "@/lib/formatting";
import { buildUseCasesUrl } from "@/lib/urls";
import type { HomeViewModel } from "../_view-model";

export function HomeHero({
  stats,
  distinctProducts,
  productDeployments,
  codingEntries,
  agenciesWithDataWord,
}: {
  stats: HomeViewModel["stats"];
  distinctProducts: number;
  productDeployments: number;
  codingEntries: number;
  agenciesWithDataWord: string;
}) {
  return (
    <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-14 md:pb-20">
      {/* Left margin: filing meta */}
      <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
        <div className="sticky top-32 space-y-4">
          <div>
            <div className="eyebrow mb-1.5 !text-[var(--stamp)]">
              No. 001 · Filed
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Research Memorandum
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              OMB M-25-21 · Cycle 2025
            </div>
          </div>

          <div className="relative inline-flex w-fit">
            <div className="stamp">Preliminary</div>
          </div>

          <div className="hidden space-y-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:block">
            <div className="border-t border-border pt-3">
              <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                Aggregate
              </div>
              <div className="text-foreground">
                <Link
                  href={buildUseCasesUrl({})}
                  className="transition-colors hover:text-[var(--stamp)]"
                >
                  {formatNumber(stats.total_use_cases)} uc
                </Link>{" "}
                ·{" "}
                <Link
                  href={buildUseCasesUrl({})}
                  className="transition-colors hover:text-[var(--stamp)]"
                >
                  {formatNumber(stats.total_consolidated)} cons
                </Link>
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                Coverage
              </div>
              <div className="text-foreground">
                <Link
                  href="/agencies"
                  className="transition-colors hover:text-[var(--stamp)]"
                >
                  {stats.total_agencies_with_data}/{stats.total_agencies}{" "}
                  agencies
                </Link>
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                Catalogue
              </div>
              <div className="text-foreground">
                <Link
                  href="/products"
                  className="transition-colors hover:text-[var(--stamp)]"
                >
                  {stats.total_products} products
                </Link>{" "}
                ·{" "}
                <Link
                  href="/templates"
                  className="transition-colors hover:text-[var(--stamp)]"
                >
                  {stats.total_templates} templates
                </Link>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Headline column */}
      <div className="col-span-12 md:col-span-9">
        <h1 className="font-display text-[clamp(2.8rem,7.5vw,6.4rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
          An inventory of{" "}
          <em className="inline font-normal italic">everything</em> American
          <br />
          government says it is doing with
          <br />
          <span className="relative inline-block">
            <span
              aria-hidden
              className="absolute inset-x-[-0.08em] bottom-[0.16em] h-[0.38em] bg-[var(--highlight)]/90"
            />
            <span className="relative">artificial&nbsp;intelligence.</span>
          </span>
        </h1>

        <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-6">
          <p className="col-span-12 max-w-prose text-[1.05rem] leading-[1.55] text-foreground/85 md:col-span-7">
            <span className="float-left mr-2 font-display italic text-[3.6rem] leading-[0.82] text-foreground">
              {agenciesWithDataWord.charAt(0)}
            </span>
            {agenciesWithDataWord.slice(1)} federal agencies filed{" "}
            <span className="font-medium text-foreground">
              {formatNumber(stats.total_use_cases)} individual use cases
            </span>{" "}
            and {formatNumber(stats.total_consolidated)} consolidated entries
            to the Office of Management and Budget for the 2025 reporting
            cycle. This inventory collects them all in one place, normalizes
            the schema, tags each record for the questions that matter, and
            lets you drill from an enterprise-wide rollout of Microsoft
            Copilot at the Department of State down to a single line-item on
            a rural-land classifier at the USDA.
          </p>

          <div className="col-span-12 md:col-span-4 md:col-start-9 md:self-end">
            <div className="editorial-rule-left space-y-3">
              <div className="eyebrow">By the numbers</div>
              <dl className="space-y-2 font-mono text-sm">
                <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5">
                  <dt className="text-muted-foreground">Use cases</dt>
                  <dd className="tabular-nums text-foreground">
                    <Link
                      href={buildUseCasesUrl({})}
                      className="transition-colors hover:text-[var(--stamp)]"
                    >
                      {formatNumber(stats.total_use_cases)}
                    </Link>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5">
                  <dt className="text-muted-foreground">Agencies</dt>
                  <dd className="tabular-nums text-foreground">
                    <Link
                      href="/agencies"
                      className="transition-colors hover:text-[var(--stamp)]"
                    >
                      {stats.total_agencies_with_data}
                    </Link>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5">
                  <dt className="text-muted-foreground">Products</dt>
                  <dd className="tabular-nums text-foreground">
                    <Link
                      href="/products"
                      className="transition-colors hover:text-[var(--stamp)]"
                    >
                      {formatNumber(distinctProducts)}
                    </Link>
                  </dd>
                </div>
                <div
                  className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5"
                  title="Agency×product pairs — a product run by twelve agencies counts twelve times"
                >
                  <dt className="text-muted-foreground">Deployments</dt>
                  <dd className="tabular-nums text-foreground">
                    <Link
                      href="/products"
                      className="transition-colors hover:text-[var(--stamp)]"
                    >
                      {formatNumber(productDeployments)}
                    </Link>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Coding entries</dt>
                  <dd className="tabular-nums text-foreground">
                    <Link
                      href={buildUseCasesUrl({ isCodingTool: true })}
                      className="transition-colors hover:text-[var(--stamp)]"
                    >
                      {formatNumber(codingEntries)}
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

/**
 * Expandable "Who runs it" list for a product detail page. Each row is an
 * agency that reports this product; clicking it reveals up to 10 of that
 * agency's use cases naming the product (Deployed-first), plus a
 * "See all N entries" link that drills into the agency-scoped explorer.
 *
 * Mirrors the click-to-expand pattern used on /fedramp/coverage/*, but
 * keeps the existing single-list visual cadence of the product page
 * rather than dropping in a TanStack table.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MonoChip } from "@/components/editorial";
import { formatNumber, truncate } from "@/lib/formatting";
import { agencyUseCasesUrl } from "@/lib/urls";
import type { ProductAgencyEntryRow } from "@/lib/types";

export type AgencyRunnerRow = {
  id: number;
  abbreviation: string;
  name: string;
  count: number;
  useCases: ProductAgencyEntryRow[];
};

function stageBucket(
  stage: string | null,
): "Deployed" | "Pilot" | "Pre-deployment" | "Retired" {
  const s = (stage ?? "").toLowerCase();
  if (s.includes("retired")) return "Retired";
  if (
    s.includes("operation") ||
    s.includes("production") ||
    s.includes("mission") ||
    s.includes("deployed")
  ) {
    return "Deployed";
  }
  if (
    s.includes("implementation") ||
    s.includes("assessment") ||
    s.includes("pilot")
  ) {
    return "Pilot";
  }
  return "Pre-deployment";
}

export function AgenciesRunnersList({
  productId,
  agencies,
}: {
  productId: number;
  agencies: AgencyRunnerRow[];
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ul className="divide-y divide-border border-y-2 border-foreground">
      {agencies.map((a, i) => {
        const isOpen = open.has(a.id);
        const hidden = Math.max(0, a.count - a.useCases.length);
        const seeAllHref = agencyUseCasesUrl(a.id, { productIds: [productId] });
        return (
          <li key={a.id} className={isOpen ? "bg-[var(--highlight)]/15" : ""}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggle(a.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(a.id);
                }
              }}
              aria-expanded={isOpen}
              className="group grid w-full cursor-pointer grid-cols-[1.5rem_2.25rem_4.5rem_1fr_auto] items-baseline gap-x-3 py-3 transition-colors hover:bg-[var(--highlight)]/20 md:grid-cols-[1.5rem_2.75rem_5rem_1fr_auto] md:gap-x-5"
            >
              <span
                className="inline-flex size-5 items-center justify-center self-center text-muted-foreground transition-colors group-hover:text-[var(--stamp)]"
                aria-hidden
              >
                {isOpen ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Link
                href={`/agencies/${a.abbreviation}`}
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-sm font-semibold tracking-[0.04em] text-foreground hover:text-[var(--stamp)]"
              >
                {a.abbreviation}
              </Link>
              <Link
                href={`/agencies/${a.abbreviation}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate font-display text-[1.05rem] italic text-foreground transition-[letter-spacing] group-hover:tracking-[-0.01em]"
              >
                {a.name}
              </Link>
              <Link
                href={seeAllHref}
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-[11px] uppercase tracking-[0.1em] tabular-nums text-muted-foreground transition-colors hover:text-[var(--stamp)]"
              >
                {formatNumber(a.count)} entries
              </Link>
            </div>
            {isOpen ? (
              <div className="border-t border-border bg-[var(--paper-warm)]/40 px-3 py-5 md:pl-[calc(1.5rem+0.75rem+2.25rem+0.75rem)]">
                {a.useCases.length === 0 ? (
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    — No detailed use cases on file for this product at{" "}
                    {a.abbreviation} —
                  </p>
                ) : (
                  <>
                    <ul className="space-y-4">
                      {a.useCases.map((uc) => {
                        const bucket = stageBucket(uc.stage_of_development);
                        const tone =
                          bucket === "Deployed"
                            ? "stamp"
                            : bucket === "Pilot"
                              ? "ink"
                              : "muted";
                        const href = uc.slug
                          ? `/use-cases/${uc.slug}`
                          : null;
                        return (
                          <li
                            key={`${uc.kind}-${uc.id}`}
                            className="border-l border-[var(--rule)] pl-3"
                          >
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <MonoChip tone={tone} size="xs">
                                {bucket}
                              </MonoChip>
                              {href ? (
                                <Link
                                  href={href}
                                  className="font-display text-[1.02rem] italic leading-tight text-foreground hover:underline decoration-[var(--stamp)] underline-offset-[3px]"
                                >
                                  {truncate(uc.use_case_name, 140)}
                                </Link>
                              ) : (
                                <span className="font-display text-[1.02rem] italic leading-tight text-foreground">
                                  {truncate(uc.use_case_name, 140)}
                                </span>
                              )}
                            </div>
                            {uc.problem_snippet ? (
                              <p className="mt-1.5 line-clamp-3 max-w-prose text-[0.9rem] leading-[1.55] text-foreground/80">
                                {uc.problem_snippet}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    {hidden > 0 ? (
                      <p className="mt-4">
                        <Link
                          href={seeAllHref}
                          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--stamp)] hover:underline"
                        >
                          See all {formatNumber(a.count)} entries at{" "}
                          {a.abbreviation} →
                        </Link>
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

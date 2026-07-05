/**
 * Server-rendered list of CoverageUseCaseRow items shown inside the
 * expanded panel on /fedramp/coverage/* pages. Mirrors the
 * silently-dropped "ExpandedUseCaseItem" markup: stage chip
 * (Deployed = stamp, Pilot = ink, Pre-deploy / Retired = muted), italic
 * use-case-name link to `/use-cases/[slug]`, line-clamp-3 problem
 * snippet.
 *
 * Footer: a "See all N use cases →" anchor when `seeAllHref` is provided,
 * matching the user's "top-10 inline + filter for more" preference.
 */

import Link from "next/link";
import { MonoChip } from "@/components/editorial";
import { EmptyState } from "@/components/empty-state";
import type { CoverageUseCaseRow } from "@/lib/types";

function stageBucket(stage: string | null):
  | "Deployed"
  | "Pilot"
  | "Pre-deployment"
  | "Retired" {
  const s = (stage ?? "").toLowerCase();
  if (s.includes("retired")) return "Retired";
  // Pilot must be checked BEFORE deployed: the OMB Pilot label text reads
  // "has been deployed in a limited test or pilot capacity".
  if (s.includes("implementation") || s.includes("assessment") || s.includes("pilot")) {
    return "Pilot";
  }
  if (
    s.includes("operation") ||
    s.includes("production") ||
    s.includes("mission") ||
    s.includes("deployed")
  ) {
    return "Deployed";
  }
  return "Pre-deployment";
}

export function CoverageUseCaseList({
  rows,
  totalCount,
  seeAllHref,
  emptyMessage = "No use cases reported.",
  heading,
}: {
  rows: CoverageUseCaseRow[];
  /** Full N — `rows` is sliced to top 10. If `totalCount > rows.length`,
   *  show "See all N →" footer. */
  totalCount: number;
  seeAllHref?: string;
  emptyMessage?: string;
  /** Optional small heading rendered above the list (e.g.
   *  "Reported by N agencies without a FedRAMP authorization"). */
  heading?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState variant="bare" message={emptyMessage} />;
  }

  const hidden = Math.max(0, totalCount - rows.length);

  return (
    <div className="space-y-3">
      {heading ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {heading}
        </p>
      ) : null}
      <ul className="space-y-4 pl-4">
        {rows.map((r) => {
          const bucket = stageBucket(r.stage_of_development);
          const tone =
            bucket === "Deployed"
              ? "stamp"
              : bucket === "Pilot"
                ? "ink"
                : "muted";
          const href = r.slug ? `/use-cases/${r.slug}` : null;
          return (
            <li
              key={r.id}
              className="border-l border-[var(--rule)] pl-3"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <MonoChip tone={tone} size="xs">
                  {bucket}
                </MonoChip>
                <MonoChip
                  tone="muted"
                  size="xs"
                  href={`/agencies/${r.agency_abbreviation}`}
                >
                  {r.agency_abbreviation}
                </MonoChip>
                {href ? (
                  <Link
                    href={href}
                    className="font-display text-[1.02rem] italic leading-tight text-foreground hover:underline decoration-[var(--stamp)] underline-offset-[3px]"
                  >
                    {r.use_case_name}
                  </Link>
                ) : (
                  <span className="font-display text-[1.02rem] italic leading-tight text-foreground">
                    {r.use_case_name}
                  </span>
                )}
              </div>
              {r.problem_snippet ? (
                <p className="mt-1.5 line-clamp-3 max-w-prose text-[0.9rem] leading-[1.55] text-foreground/80">
                  {r.problem_snippet}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && seeAllHref ? (
        <p className="pl-4">
          <Link
            href={seeAllHref}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--stamp)] hover:underline"
          >
            See all {totalCount.toLocaleString()} use cases · filter →
          </Link>
        </p>
      ) : null}
    </div>
  );
}

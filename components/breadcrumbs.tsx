import Link from "next/link";
import { Fragment } from "react";

/**
 * Breadcrumbs — mono small-caps trail for detail pages.
 *
 * Parents typically come from the IA registry (`lib/nav.ts`,
 * `breadcrumbTrail()`); the caller appends the dynamic leaf. The last
 * item renders as plain text (current page); everything before it links.
 * Complements — never replaces — the top nav (see AGENTS.md).
 */
export function Breadcrumbs({
  trail,
  className = "mb-6",
}: {
  trail: Array<{ href?: string; label: string }>;
  className?: string;
}) {
  if (trail.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground ${className}`}
    >
      {trail.map((crumb, i) => {
        const isLast = i === trail.length - 1;
        return (
          <Fragment key={`${crumb.label}-${i}`}>
            {i > 0 ? (
              <span aria-hidden className="text-muted-foreground/50">
                /
              </span>
            ) : null}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-[var(--stamp)]"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={isLast ? "text-foreground" : undefined}
              >
                {crumb.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

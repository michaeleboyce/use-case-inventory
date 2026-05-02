/**
 * Breadcrumb chain for the federal hierarchy. Restyled for the editorial
 * aesthetic — mono caps, hairline separators, no Home icon by default
 * (the slug "agencies" anchors that role).
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { HierarchyBreadcrumb } from "@/lib/types";

export interface HierarchyBreadcrumbsProps {
  breadcrumbs: HierarchyBreadcrumb[];
  /** Whether to render the leading "Agencies" link. Default true. */
  showRoot?: boolean;
  className?: string;
}

const LEVEL_CHIP: Record<HierarchyBreadcrumb["level"], string> = {
  department: "Dept.",
  independent: "Agency",
  sub_agency: "Bureau",
  office: "Office",
  component: "Component",
};

export function HierarchyBreadcrumbs({
  breadcrumbs,
  showRoot = true,
  className = "",
}: HierarchyBreadcrumbsProps) {
  if (breadcrumbs.length === 0) return null;

  return (
    <nav
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ${className}`}
      aria-label="Breadcrumb"
    >
      {showRoot && (
        <>
          <Link href="/agencies" className="hover:text-[var(--stamp)]">
            Agencies
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden />
        </>
      )}
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        const label = crumb.abbreviation ?? crumb.name;
        const levelChip = LEVEL_CHIP[crumb.level];
        return (
          <span key={crumb.id} className="flex items-center gap-1.5">
            {isLast ? (
              <span className="text-foreground">
                {label}
                {levelChip && (
                  <span className="ml-1.5 text-muted-foreground/70">
                    · {levelChip}
                  </span>
                )}
              </span>
            ) : (
              <>
                <Link
                  href={`/agencies/${crumb.slug}`}
                  className="hover:text-[var(--stamp)]"
                  title={crumb.name}
                >
                  {label}
                </Link>
                <ChevronRight
                  className="size-3 text-muted-foreground/60"
                  aria-hidden
                />
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}

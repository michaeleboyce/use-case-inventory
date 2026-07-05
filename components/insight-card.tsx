import type { ReactNode } from "react";
import { StatTile } from "@/components/stat-tile";

/**
 * @deprecated Thin shim over `StatTile variant="boxed"`. Migrate call sites
 * to `StatTile` directly; this file is deleted at the end of the retrofit
 * sweep (refactor Phase 3).
 */
export function InsightCard({
  value,
  headline,
  subtext,
  accent = "ink",
  kicker,
  className,
  href,
}: {
  value: string;
  headline: ReactNode;
  subtext?: ReactNode;
  accent?: "stamp" | "verified" | "ink";
  kicker?: string;
  className?: string;
  href?: string;
}) {
  return (
    <StatTile
      variant="boxed"
      value={value}
      headline={headline}
      sublabel={subtext}
      accent={accent}
      kicker={kicker}
      className={className}
      href={href}
    />
  );
}

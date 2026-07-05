import { StatTile, type StatTileAccent } from "@/components/stat-tile";

/**
 * @deprecated Thin shim over `StatTile variant="rule"`. Migrate call sites
 * to `StatTile` directly; this file is deleted at the end of the retrofit
 * sweep (refactor Phase 3).
 */
export function MetricTile({
  label,
  value,
  sublabel,
  accent = "default",
  href,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  accent?: StatTileAccent;
  href?: string;
}) {
  return (
    <StatTile
      variant="rule"
      label={label}
      value={value}
      sublabel={sublabel}
      accent={accent}
      href={href}
    />
  );
}

/**
 * A single horizontal subscore bar for one rubric dimension on the
 * agency-readiness scorecard card. Server component — no interactivity.
 *
 * Color shifts with the score band so a glance at the card reveals which
 * dimensions are pulling the composite down:
 *   ≥70 → verified  (strong)
 *   40–69 → highlight  (mid)
 *   <40 → stamp     (weak)
 *
 * The accompanying `weight` is rendered as a small mono caption so the
 * reader can mentally weight the dimension when reading the bar.
 */
import type { ReactNode } from "react";

function scoreBarColor(value: number): string {
  if (value >= 70) return "bg-[var(--verified)]";
  if (value >= 40) return "bg-[var(--highlight)]";
  return "bg-[var(--stamp)]";
}

export function ReadinessSubscoreBar({
  label,
  value,
  weight,
  rawInfo,
}: {
  label: string;
  value: number;
  weight: number;
  rawInfo?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const barColor = scoreBarColor(value);

  const tooltip: string | undefined = rawInfo;

  const node: ReactNode = (
    <div className="flex flex-col gap-1" title={tooltip}>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-sm text-foreground">{label}</span>
        <span className="font-mono text-sm tabular-nums text-foreground">
          {Math.round(value)}
        </span>
      </div>
      <div className="relative h-2 bg-muted">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="font-mono text-[10px] text-muted-foreground/60">
        weight {Math.round(weight * 100)}%
      </div>
    </div>
  );

  return node;
}

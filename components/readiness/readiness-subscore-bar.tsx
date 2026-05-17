/**
 * A single horizontal subscore bar for one rubric dimension on the
 * agency-readiness scorecard card. Server component — no interactivity.
 *
 * Color shifts with the score band so a glance at the card reveals which
 * dimensions are pulling the composite down:
 *   ≥70 → emerald  (strong)
 *   40–69 → amber  (mid)
 *   <40 → rose     (weak)
 *
 * The accompanying `weight` is rendered as a small mono caption so the
 * reader can mentally weight the dimension when reading the bar.
 */
import type { ReactNode } from "react";

function scoreBarColor(value: number): string {
  if (value >= 70) return "bg-emerald-700";
  if (value >= 40) return "bg-amber-700";
  return "bg-rose-800";
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
        <span className="font-display text-sm text-stone-800">{label}</span>
        <span className="font-mono text-sm tabular-nums text-stone-900">
          {Math.round(value)}
        </span>
      </div>
      <div className="relative h-2 bg-stone-200">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="font-mono text-[10px] text-stone-400">
        weight {Math.round(weight * 100)}%
      </div>
    </div>
  );

  return node;
}

/**
 * V1 — the methodology funnel. Four proportional steps from "in reach" to
 * "gen-AI capability void", each a link scrolling to the board scoped to
 * that cut, plus a grayed timing-excluded shard leaving the funnel.
 * Server component; widths are pure CSS percentages of the first step.
 */
import Link from "next/link";
import { formatNumber } from "@/lib/formatting";
import type { Funnel } from "../_shared";

const STEPS: Array<{
  key: keyof Omit<Funnel, "timing_excluded">;
  label: string;
  sub: string;
  href: string;
  tone: string;
}> = [
  {
    key: "reach_pairs",
    label: "In reach",
    sub: "product × agency pairs where a host-package ATO puts the service in scope",
    href: "#board",
    tone: "bg-foreground/15",
  },
  {
    key: "sleeping",
    label: "Sleeping",
    sub: "≥1 peer agency reports the product; the ATO holder reports nothing",
    href: "#board",
    tone: "bg-[var(--stamp)]/35",
  },
  {
    key: "nothing_similar",
    label: "Nothing similar",
    sub: "holder reports no product in the same capability class at all",
    href: "?similar=void#board",
    tone: "bg-[var(--stamp)]/60",
  },
  {
    key: "genai_void",
    label: "Gen-AI void",
    sub: "the missing capability is a generative-AI platform or assistant",
    href: "?genai=1&similar=void#board",
    tone: "bg-[var(--stamp)]",
  },
];

export function SleepingServicesFunnel({ funnel }: { funnel: Funnel }) {
  const base = Math.max(funnel.reach_pairs, 1);
  return (
    <div className="border-t-2 border-foreground pt-4">
      <ol className="space-y-3">
        {STEPS.map((s, i) => {
          const value = funnel[s.key];
          const width = Math.max((value / base) * 100, 1.5);
          return (
            <li key={s.key}>
              <Link href={s.href} scroll={s.href.startsWith("#") ? undefined : false} className="group block">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                    {i + 1} · {s.label}
                  </span>
                  <span className="font-display italic tabular-nums text-[1.35rem] leading-none text-foreground">
                    {formatNumber(value)}
                  </span>
                </div>
                <div className="mt-1 h-4 w-full bg-muted/40">
                  <div
                    className={`h-4 ${s.tone} transition-all group-hover:opacity-80`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <p className="mt-1 max-w-prose text-[0.82rem] leading-snug text-muted-foreground">
                  {s.sub}
                </p>
              </Link>
            </li>
          );
        })}
      </ol>
      {funnel.timing_excluded > 0 ? (
        <p className="mt-4 border-l-2 border-border pl-3 text-[0.82rem] leading-snug text-muted-foreground">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]">
            excluded ·{" "}
          </span>
          {formatNumber(funnel.timing_excluded)} additional pairs are grayed
          out of every count above: the agency&rsquo;s first host ATO
          postdates the inventory cutoff (or the service entered scope in the
          snapshot&rsquo;s last 90 days), so absence from the 2025 inventory
          proves nothing. These rows are the board&rsquo;s falsification
          test — they should disappear next cycle.
        </p>
      ) : null}
    </div>
  );
}

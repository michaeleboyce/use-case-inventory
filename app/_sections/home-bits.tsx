/**
 * Small composed pieces shared by the home page's sections: the browse
 * cross-cut card, the capability gap list, and the percent-first stat
 * glance. Extracted from app/page.tsx during the front-door rebuild.
 */
import Link from "next/link";
import { MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";

export function CrossCutCard({
  kicker,
  href,
  label,
  note,
  source,
}: {
  kicker: string;
  href: string;
  label: string;
  note: string;
  /** Tag the dimension as OMB-filed or IFP-derived so readers don't
   *  have to click through to /browse to see provenance. */
  source: "omb" | "derived";
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-2 border-t-2 border-foreground pt-2 transition-colors"
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--stamp)]">
          {kicker}
        </span>
        <span className="font-display italic text-[1.5rem] leading-tight text-foreground transition-colors group-hover:text-[var(--stamp)]">
          {label}
        </span>
        <span
          className={`ml-auto font-mono text-[9px] tracking-[0.08em] ${
            source === "derived"
              ? "text-[var(--stamp)]"
              : "text-muted-foreground"
          }`}
          title={
            source === "derived"
              ? "IFP-derived classification (auto_tag.py)"
              : "OMB-filed by the agency"
          }
        >
          {source === "derived" ? "IFP" : "OMB"}
        </span>
      </div>
      <p className="text-sm leading-snug text-muted-foreground">{note}</p>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-[var(--stamp)]">
        Browse →
      </span>
    </Link>
  );
}

export function GapList({
  kicker,
  title,
  note,
  items,
  tone,
}: {
  kicker: string;
  title: string;
  note: React.ReactNode;
  items: Array<{ id: number; abbr: string; name: string }>;
  tone: "stamp" | "ink";
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3 border-t-2 border-foreground pt-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--stamp)]">
          {kicker}
        </span>
        <h3 className="font-display italic text-[1.35rem] leading-tight text-foreground md:text-[1.55rem]">
          {title}
        </h3>
      </div>
      <p className="mb-4 max-w-prose text-[0.95rem] leading-[1.55] text-muted-foreground">
        {note}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <li className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            None —
          </li>
        ) : (
          items.map((a) => (
            <li key={a.id}>
              <MonoChip
                href={`/agencies/${a.abbr}`}
                title={a.name}
                tone={tone}
              >
                {a.abbr}
              </MonoChip>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

const ACCENT_COLOR: Record<string, string> = {
  stamp: "text-[var(--stamp)]",
  verified: "text-[var(--verified)]",
  default: "text-foreground",
};

export function StatGlance({
  label,
  count,
  pct,
  sublabel,
  href,
  accent = "default",
}: {
  label: string;
  count: number | undefined;
  pct: string | undefined;
  sublabel?: string;
  href: string;
  accent?: keyof typeof ACCENT_COLOR;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-1 border-t-2 border-foreground pt-2 transition-colors"
    >
      <div className="eyebrow truncate">{label}</div>
      <div className="flex items-baseline gap-2">
        <span
          className={`font-display text-[2.4rem] italic leading-[0.95] tracking-[-0.02em] tabular-nums transition-colors group-hover:text-[var(--stamp)] ${ACCENT_COLOR[accent]}`}
        >
          {pct ?? "—"}
        </span>
        {count != null && (
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {formatNumber(count)}
          </span>
        )}
      </div>
      {sublabel ? (
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          {sublabel}
        </div>
      ) : null}
    </Link>
  );
}

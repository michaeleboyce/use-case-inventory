import Link from "next/link";
import { cn } from "@/lib/utils";

type Accent = "stamp" | "verified" | "ink";

const ACCENT_KICKER: Record<Accent, string> = {
  stamp: "text-[var(--stamp)]",
  verified: "text-[var(--verified)]",
  ink: "text-foreground",
};

type Props = {
  value: string;
  headline: React.ReactNode;
  subtext?: React.ReactNode;
  accent?: Accent;
  kicker?: string;
  className?: string;
  /**
   * If provided, the card becomes a clickable link that drills through to
   * the given href. A subtle hover ring in the stamp color is applied so
   * the affordance is visible without breaking the flat editorial aesthetic.
   */
  href?: string;
};

export function InsightCard({
  value,
  headline,
  subtext,
  accent = "ink",
  kicker,
  className,
  href,
}: Props) {
  const base = cn(
    "flex h-full flex-col border border-border bg-background p-5",
    href
      ? "transition-colors hover:ring-1 hover:ring-[var(--stamp)] hover:text-[var(--stamp)]"
      : null,
    className,
  );

  const body = (
    <>
      {kicker ? (
        <div
          className={cn(
            "mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]",
            ACCENT_KICKER[accent],
          )}
        >
          {kicker}
        </div>
      ) : null}
      <div className="border-t-2 border-foreground pt-4">
        <span className="block font-display italic text-[3.2rem] leading-[0.9] tracking-[-0.02em] text-foreground tabular-nums">
          {value}
        </span>
        <p className="mt-3 text-[0.95rem] leading-snug text-foreground">
          {headline}
        </p>
        {subtext ? (
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {subtext}
          </p>
        ) : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(base, "block")}>
        {body}
      </Link>
    );
  }

  return <figure className={base}>{body}</figure>;
}

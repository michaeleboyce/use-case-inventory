import Link from "next/link";

import { formatNumber } from "@/lib/formatting";

export function StatCell({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-[2.2rem] leading-none tabular-nums text-foreground transition-colors md:text-[2.8rem] ${
          href ? "group-hover:text-[var(--stamp)]" : ""
        }`}
      >
        {formatNumber(value)}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

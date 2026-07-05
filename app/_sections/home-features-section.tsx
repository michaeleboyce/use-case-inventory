/**
 * § VI teaser — the Features band. The essays (The AI Experience,
 * Stories: 2024 → 2025) and the policy crosswalk carry the site's
 * argument; before the front-door rebuild they were reachable only
 * from a hover dropdown.
 */
import Link from "next/link";
import { Section } from "@/components/editorial";

const FEATURES: Array<{
  kicker: string;
  href: string;
  title: string;
  blurb: string;
}> = [
  {
    kicker: "A",
    href: "/experience",
    title: "The AI Experience",
    blurb:
      "What working in government feels like now: how much generative AI landed, when the wave hit, who has seats, and the capability ladder from chatbot to workflow.",
  },
  {
    kicker: "B",
    href: "/stories",
    title: "Stories: 2024 → 2025",
    blurb:
      "Six sourced narrative arcs across fourteen agencies — permission to product, zero to dense, procured not built, and the disappearing act.",
  },
  {
    kicker: "C",
    href: "/policy",
    title: "Policy crosswalk",
    blurb:
      "What agencies have actually published in response to M-25-21 — strategies, compliance plans, and the page counts behind them.",
  },
];

export function HomeFeaturesSection({ kicker }: { kicker: string }) {
  return (
    <Section
      number={kicker}
      title="Features"
      lede="The essays and crosswalks that carry the argument — read these first."
      source="derived"
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="group flex min-w-0 flex-col gap-2 border-t-2 border-foreground pt-3 transition-colors"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--stamp)]">
                {f.kicker}
              </span>
              <span className="font-display italic text-[1.5rem] leading-tight text-foreground transition-colors group-hover:text-[var(--stamp)]">
                {f.title}
              </span>
            </div>
            <p className="text-sm leading-snug text-muted-foreground">
              {f.blurb}
            </p>
            <span className="mt-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-[var(--stamp)]">
              Read →
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

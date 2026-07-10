/**
 * /figures — index of the article-figure exports.
 *
 * Each entry links to its /figures/[slug] capture route (fixed-width,
 * chrome-hidden renders for the article — see _registry.tsx). The index
 * exists purely for discoverability: the capture routes themselves stay
 * out of the top nav, but this page is registered under REFERENCE_LINKS
 * so the set is reachable without a deep link. Captions are the same
 * self-contained provenance text the capture routes print.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { PageMasthead } from "@/components/page-masthead";
import { FIGURES } from "./_registry";

export const metadata: Metadata = {
  title: "Article figures",
  description:
    "Fixed-width, capture-ready renders of the article-grade charts — integration depth, reach vs. access, bureau divergence, adoption curves.",
};

export default function FiguresIndexPage() {
  const entries = Object.entries(FIGURES).map(([slug, def]) => {
    const rendered = def.render();
    return {
      slug,
      title: def.title,
      width: def.width,
      caption: rendered?.caption ?? null,
      available: rendered !== null,
    };
  });

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <PageMasthead
        kicker="§ Reference · Figures"
        metaLines={[
          `${entries.filter((e) => e.available).length} figures`,
          "Fixed-width capture routes",
        ]}
        title={
          <>
            The figures,
            <br />
            in one place.
          </>
        }
        lede="Every article-grade chart, rendered at its fixed capture width with a self-contained provenance caption. These are the same components the live pages mount — each route hides the site chrome so an element screenshot of the frame is publication-ready."
        dropCap
      />

      <div className="divide-y divide-border border-t-2 border-foreground">
        {entries.map((e) => (
          <div
            key={e.slug}
            className="grid grid-cols-12 gap-x-6 gap-y-2 py-5"
          >
            <div className="col-span-12 md:col-span-4">
              {e.available ? (
                <Link
                  href={`/figures/${e.slug}`}
                  className="font-medium underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
                >
                  {e.title}
                </Link>
              ) : (
                <span className="font-medium text-muted-foreground">
                  {e.title}
                </span>
              )}
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                /figures/{e.slug} · {e.width}px
                {!e.available && " · unavailable in this build"}
              </p>
            </div>
            <p className="col-span-12 font-mono text-[10.5px] leading-[1.6] text-muted-foreground md:col-span-8">
              {e.caption ?? "This DB build lacks the data behind this figure."}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}

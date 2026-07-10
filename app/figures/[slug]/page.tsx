/**
 * /figures/[slug] — fixed-width, capture-ready renders of the article
 * figures. See app/figures/_registry.tsx for the registry, the capture
 * recipe (Playwright element screenshot of #figure-frame), and how to add
 * one. Dynamic [slug] route → exempt from lib/nav.ts registration; the
 * /figures index (registered under REFERENCE_LINKS) links every slug.
 */

import { notFound } from "next/navigation";
import { FIGURES } from "../_registry";

export function generateStaticParams() {
  return Object.keys(FIGURES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const def = FIGURES[slug];
  return { title: def ? `${def.title} · Figure` : "Figure" };
}

export default async function FigurePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const def = FIGURES[slug];
  if (!def) notFound();
  const rendered = def.render();
  if (!rendered) notFound();

  return (
    // Capture route: the sticky site header would overlap an element
    // screenshot whenever the frame is taller than the viewport, so hide
    // the chrome on this route only (the root layout stays untouched).
    <div className="flex justify-center px-4 py-12">
      <style>{`body > header, body > footer { display: none; }`}</style>
      <div
        id="figure-frame"
        style={{ width: def.width, maxWidth: "100%" }}
        className="border-t-2 border-foreground bg-background px-8 pb-8 pt-5"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Figure · {def.title}
        </p>
        <div className="mt-6">{rendered.node}</div>
        <p className="mt-6 max-w-none font-mono text-[10.5px] leading-[1.6] text-muted-foreground">
          {rendered.caption}
        </p>
      </div>
    </div>
  );
}

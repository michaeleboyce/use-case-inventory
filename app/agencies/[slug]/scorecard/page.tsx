/**
 * Print-friendly per-agency Federal AI Readiness scorecard.
 *
 * A minimal page (no chart chrome, no nav per `@media print` styles in
 * globals.css) intended to be printed or saved as a PDF for citation
 * inside IFP white papers and Hill briefings.
 *
 * Slug resolution matches `/agencies/[slug]`: accepts a slug or a
 * top-level agency abbreviation. If the resolved org has no legacy
 * agency or no readiness row, 404s.
 */
import { notFound } from "next/navigation";
import Link from "next/link";

import { getAgencyById } from "@/lib/db";
import { getOrganizationBySlugOrAbbr } from "@/lib/hierarchy";
import { getAgencyReadinessByAbbr } from "@/lib/readiness";
import { AgencyScorecardCard } from "@/components/agency/agency-scorecard-card";
import { PrintButton } from "./print-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = getOrganizationBySlugOrAbbr(slug);
  if (!org) return { title: "Scorecard not found" };
  return {
    title: `${org.abbreviation ?? org.name} Federal AI Readiness Scorecard | IFP`,
    description: `Federal AI Readiness Scorecard for ${org.name} — 5-dimension rubric, print-friendly.`,
  };
}

export default async function ScorecardPrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = getOrganizationBySlugOrAbbr(slug);
  if (!org || org.legacy_agency_id == null) return notFound();
  const agency = getAgencyById(org.legacy_agency_id);
  if (!agency) return notFound();
  let readiness: ReturnType<typeof getAgencyReadinessByAbbr> = null;
  try {
    readiness = getAgencyReadinessByAbbr(agency.abbreviation);
  } catch {
    readiness = null;
  }
  if (!readiness) return notFound();

  return (
    <main className="max-w-3xl mx-auto p-8 print:p-4 print:max-w-none">
      <nav className="mb-4 print:hidden">
        <Link
          href={`/agencies/${slug}`}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          ← {agency.abbreviation} agency page
        </Link>
      </nav>
      <header className="border-b border-border pb-4 mb-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Federal AI Use Case Inventory · IFP
        </div>
        <h1 className="mt-1 font-display italic text-3xl text-foreground">
          Federal AI Readiness Scorecard
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          {agency.name} ({agency.abbreviation}) · {readiness.computed_at}
        </p>
      </header>

      <AgencyScorecardCard readiness={readiness} />

      <section className="mt-8 max-w-prose">
        <h2 className="font-display italic text-xl text-foreground">
          About this scorecard
        </h2>
        <p className="mt-3 font-body text-sm leading-relaxed text-muted-foreground">
          Federal AI Readiness is a 5-dimension rubric scoring U.S. federal
          agencies on adoption breadth, frontier capability, procurement
          hygiene, reporting quality, and governance documentation. Weights and
          definitions are published at{" "}
          <Link
            href="/readiness/methodology"
            className="underline underline-offset-2 hover:text-foreground"
          >
            use-case-inventory.vercel.app/readiness/methodology
          </Link>
          .
        </p>
      </section>

      <footer className="mt-8 pt-4 border-t border-border font-mono text-xs text-muted-foreground">
        Source: use-case-inventory.vercel.app · Institute for Progress · Federal
        AI Use Case Inventory
      </footer>

      <PrintButton />
    </main>
  );
}

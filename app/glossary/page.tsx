/**
 * /glossary — every term of art on the site, grouped and anchored.
 *
 * Static content page: entries come from lib/definitions.ts GLOSSARY (the
 * same source the TermChip popovers read), so the popover text and the
 * glossary can never disagree. Each entry is addressable as
 * /glossary#<slug>, and popovers link here via "Full definition →".
 */
import Link from "next/link";
import type { Metadata } from "next";
import { PageMasthead } from "@/components/page-masthead";
import { Section, MonoChip } from "@/components/editorial";
import { PageSubnav } from "@/components/page-subnav";
import { GLOSSARY } from "@/lib/definitions";

export const metadata: Metadata = {
  title: "Glossary",
  description:
    "Definitions for every term of art in the Federal AI Inventory — entry types, sophistication tiers, agency scores, lineage statuses, and FedRAMP coverage vocabulary.",
};

export default function GlossaryPage() {
  return (
    <>
      <PageSubnav
        tabs={GLOSSARY.map((g) => ({ id: g.id, label: g.title.split(" (")[0] }))}
      />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
        <PageMasthead
          kicker="§ Reference · Glossary"
          metaLines={[
            `${GLOSSARY.reduce((n, g) => n + g.entries.length, 0)} terms`,
            "Same source as the hover popovers",
          ]}
          title={
            <>
              The words,
              <br />
              defined.
            </>
          }
          lede="Every term of art this site leans on — what counts as an entry, what the tags mean, how the two agency scores differ, and the FedRAMP coverage vocabulary. Chips elsewhere on the site pop these same definitions in place; this page is the citable, linkable index."
          dropCap
        />

        {GLOSSARY.map((group, i) => (
          <Section
            key={group.id}
            id={group.id}
            number={String(i + 1).padStart(2, "0")}
            title={group.title}
            source="derived"
          >
            <dl className="divide-y divide-border border-t-2 border-foreground">
              {group.entries.map((entry) => (
                <div
                  key={entry.slug}
                  id={entry.slug}
                  className="grid scroll-mt-36 grid-cols-12 gap-x-6 gap-y-2 py-5"
                >
                  <dt className="col-span-12 md:col-span-3">
                    <span className="font-display italic text-[1.2rem] leading-tight text-foreground">
                      {entry.term}
                    </span>
                    <span className="ml-2 align-middle">
                      <MonoChip
                        tone={entry.source === "derived" ? "stamp" : "muted"}
                        size="xs"
                        title={
                          entry.source === "derived"
                            ? "Computed or added by IFP"
                            : "Filed by the agency to OMB"
                        }
                      >
                        {entry.source === "derived" ? "IFP" : "OMB"}
                      </MonoChip>
                    </span>
                  </dt>
                  <dd className="col-span-12 md:col-span-9">
                    <p className="max-w-prose text-[0.95rem] leading-[1.55] text-foreground/85">
                      {entry.definition}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 font-mono text-[10px] uppercase tracking-[0.14em]">
                      {entry.seeAlso ? (
                        <Link
                          href={entry.seeAlso.href}
                          className="text-muted-foreground transition-colors hover:text-[var(--stamp)]"
                        >
                          {entry.seeAlso.label} →
                        </Link>
                      ) : null}
                      <Link
                        href={`/glossary#${entry.slug}`}
                        className="text-muted-foreground/60 transition-colors hover:text-[var(--stamp)]"
                        aria-label={`Permalink to ${entry.term}`}
                      >
                        #{entry.slug}
                      </Link>
                    </div>
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        ))}
      </main>
    </>
  );
}

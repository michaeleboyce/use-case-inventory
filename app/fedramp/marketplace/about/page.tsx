/**
 * /fedramp/marketplace/about — colophon, glossary, methodology, credits.
 *
 * Ports the source FedRAMP dashboard's about page into the inventory
 * dashboard's editorial idiom. Server Component.
 */

import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/editorial";
import { getFedrampSnapshot } from "@/lib/db";
import { formatDate, formatNumber } from "@/lib/formatting";

export const metadata: Metadata = {
  title: "About · FedRAMP Marketplace · Federal AI Inventory",
  description:
    "Colophon, glossary, methodology, and credits for the FedRAMP Marketplace section — sources, vocabulary, and how the SQLite snapshot is built.",
};

export default function MarketplaceAboutPage() {
  const snapshot = getFedrampSnapshot();

  return (
    <div>
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <Eyebrow color="stamp">§ Colophon</Eyebrow>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              About this section
            </div>
            {snapshot ? (
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Filed {formatDate(snapshot.snapshot_date)}
              </div>
            ) : null}
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[clamp(2.4rem,5.5vw,4.4rem)] leading-[1] tracking-[-0.02em] text-foreground">
            About this ledger.
          </h1>
          <p className="mt-6 max-w-[60ch] text-[1.05rem] leading-[1.55] text-foreground/85">
            The FedRAMP marketplace is mirrored, read-only, into this dashboard
            so the inventory&rsquo;s questions about cloud authorization can be
            answered alongside the use-case data — &ldquo;who else uses this
            product?&rdquo;, &ldquo;which agencies have authorized it?&rdquo;,
            &ldquo;is this offering authorized at the right impact level?&rdquo;
            — without leaving the page.
          </p>
        </div>
      </header>

      <Section
        number="I"
        title="Source"
        lede="Where the data comes from."
      >
        <div className="space-y-4 text-[0.98rem] leading-[1.6] text-foreground/85">
          <p>
            All records are derived from the public FedRAMP Marketplace at{" "}
            <a
              href="https://marketplace.fedramp.gov"
              className="font-mono text-sm text-foreground underline decoration-dotted underline-offset-4 hover:text-[var(--stamp)]"
              target="_blank"
              rel="noreferrer noopener"
            >
              marketplace.fedramp.gov
            </a>
            . The dashboard does not call any non-public APIs and stores no
            data the marketplace itself does not publish.
          </p>
          {snapshot ? (
            <p>
              <span className="font-mono text-sm">Snapshot date:</span>{" "}
              <span className="font-mono text-sm font-semibold text-foreground">
                {snapshot.snapshot_date ?? "—"}
              </span>{" "}
              · <span className="font-mono text-sm">Built at:</span>{" "}
              <span className="font-mono text-sm text-foreground">
                {snapshot.built_at ?? "—"}
              </span>
            </p>
          ) : null}
          {snapshot ? (
            <p>
              The current snapshot mirrors{" "}
              <span className="font-mono text-sm">
                {formatNumber(snapshot.product_count)}
              </span>{" "}
              products,{" "}
              <span className="font-mono text-sm">
                {formatNumber(snapshot.ato_event_count)}
              </span>{" "}
              ATO events,{" "}
              <span className="font-mono text-sm">
                {formatNumber(snapshot.agency_count)}
              </span>{" "}
              agencies,{" "}
              <span className="font-mono text-sm">
                {formatNumber(snapshot.csp_count)}
              </span>{" "}
              cloud service providers, and{" "}
              <span className="font-mono text-sm">
                {formatNumber(snapshot.assessor_count)}
              </span>{" "}
              third-party assessors.
            </p>
          ) : null}
          <p>
            The build pipeline is a small set of Python scripts that fetch the
            marketplace&rsquo;s wide-format JSON (one row per product) and
            long-format JSON (one row per authorization event), reconcile
            them, normalize agency names, and write the result alongside the
            inventory dataset in a single SQLite file at{" "}
            <span className="font-mono text-sm">
              data/federal_ai_inventory_2025.db
            </span>
            .
          </p>
        </div>
      </Section>

      <Section
        number="II"
        title="Glossary"
        lede="The vocabulary, defined."
      >
        <dl className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <GlossaryEntry term="Initial vs Reuse">
            An <em>Initial</em> ATO is the first authorization an agency
            issues for a product. A <em>Reuse</em> is when a different agency
            adopts that same authorization package. One product can have
            many of each.
          </GlossaryEntry>
          <GlossaryEntry term="Authorization Type — Agency vs JAB vs Program">
            <em>Agency</em> ATOs are issued by an individual federal agency.{" "}
            <em>JAB</em> (Joint Authorization Board) authorizations are
            issued by the GSA-DoD-DHS triumvirate as government-wide
            baselines. <em>Program</em> authorizations come directly from the
            FedRAMP PMO.
          </GlossaryEntry>
          <GlossaryEntry term="Impact levels — Low, Moderate, High, Li-SaaS">
            FIPS-199 categorization of the worst-case impact a breach of the
            system would have on confidentiality, integrity, or availability.{" "}
            <em>Li-SaaS</em> (FedRAMP Tailored) is a lighter baseline for
            low-risk SaaS products that handle non-public data.
          </GlossaryEntry>
          <GlossaryEntry term="Service models — IaaS, PaaS, SaaS">
            The NIST 800-145 cloud taxonomy: <em>Infrastructure</em> (raw
            compute / storage / network), <em>Platform</em> (managed
            runtime), and <em>Software</em> (a finished application). A
            single product can be tagged with more than one.
          </GlossaryEntry>
          <GlossaryEntry term="3PAO">
            Third-party assessment organization. An accredited independent
            firm that performs the security assessment of a CSP&rsquo;s
            system against the FedRAMP baseline. One product is associated
            with one 3PAO at a time.
          </GlossaryEntry>
          <GlossaryEntry term="Baseline — Rev 5 vs 20x">
            <em>Rev 5</em> (NIST SP 800-53 Rev 5) is the prevailing FedRAMP
            control baseline. <em>20x</em> is the accelerated authorization
            track introduced in 2025 — a smaller, faster pathway built around
            continuous monitoring and machine-readable evidence.
          </GlossaryEntry>
        </dl>
      </Section>

      <Section
        number="III"
        title="Methodology"
        lede="How the database is built."
      >
        <div className="space-y-5 text-[0.98rem] leading-[1.6] text-foreground/85">
          <p>
            The marketplace publishes two complementary JSON feeds. The{" "}
            <span className="font-mono text-sm">wide</span> file lists one
            row per cloud-service offering with summary attributes. The{" "}
            <span className="font-mono text-sm">long</span> file lists every
            individual ATO event — one row per (product, agency,
            issuance-date) triple, with type and expiration.
          </p>
          <p>
            The build script writes the wide rows to{" "}
            <span className="font-mono text-sm">fedramp_products</span>, the
            long rows to{" "}
            <span className="font-mono text-sm">fedramp_authorizations</span>
            , and normalizes agencies and assessors into deduplicated sibling
            tables.
          </p>
          <p>
            Counts on this dashboard are computed live against SQLite. There
            is no caching layer; if a number looks wrong, view the source
            row.
          </p>
        </div>
      </Section>

      <Section
        number="IV"
        title="Credits"
        lede="Who built this."
      >
        <div className="space-y-4 text-[0.98rem] leading-[1.6] text-foreground/85">
          <p>
            Built by the AI Use Case Inventory team at U.S. Digital Response,
            integrated into the OMB M-25-21 AI Inventory dashboard.
          </p>
          <p>
            Source data is the work of the FedRAMP Program Management Office,
            cloud service providers, and the federal agencies that file
            authorization packages. Errors in this presentation belong to us;
            errors in the source records belong to the source.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            No personal data is collected. No analytics scripts run.
          </p>
        </div>
      </Section>
    </div>
  );
}

function GlossaryEntry({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t-2 border-foreground pt-3">
      <dt className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
        {term}
      </dt>
      <dd className="text-[0.95rem] leading-[1.55] text-foreground/85">
        {children}
      </dd>
    </div>
  );
}

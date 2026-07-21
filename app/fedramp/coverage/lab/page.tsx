import Link from "next/link";
import { Section } from "@/components/editorial";
import { buildLabModel } from "./_view-model";
import { GravityWell } from "./_sections/gravity-well";
import { PeerProofArcs } from "./_sections/peer-proof-arcs";
import { WorkforceTreemap } from "./_sections/workforce-treemap";
import { CapabilityWeather } from "./_sections/capability-weather";

export const metadata = {
  title: "Chart lab · FedRAMP × AI Inventory",
  description:
    "Four different visual framings of the same FedRAMP capability-vs-adoption data — position, relation, area, and time — side by side for comparison.",
};

/**
 * /fedramp/coverage/lab — four deliberately different visual grammars over
 * one dataset, kept publication-grade so any of them could be lifted into
 * an article. The point of the page is comparison: same facts, four
 * framings, pick the one that carries the argument best.
 */
export default function CoverageLabPage() {
  const model = buildLabModel();

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">FedRAMP → AI</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Chart lab
            </div>
            <Link
              href="/fedramp/coverage"
              className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
            >
              ← Coverage hub
            </Link>
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            Same data, <em className="italic">four framings.</em>
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            Every chart below draws on the same records: which core-AI
            services sit in scope of packages each agency holds an ATO for,
            which peer agencies report real use, and IFP&rsquo;s
            web-corroborated estimates of staff access. What differs is the
            visual grammar — position, relation, area, time. The page exists
            to compare framings side by side and pick the one that carries
            the argument best.
          </p>
          <p className="mt-3 max-w-prose font-mono text-[11px] text-muted-foreground">
            Throughout: &ldquo;in reach&rdquo; = in scope of a package the
            agency holds an ATO for — never &ldquo;enabled&rdquo;. Access
            shares are IFP assessments, not OMB data. Marketplace snapshot
            2026-06-12.
          </p>
        </div>
      </header>

      {!model ? (
        <Section
          number="I"
          title="No data"
          lede="The FedRAMP sidecars aren't loaded in this DB build."
        >
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Run <code className="font-mono text-foreground">make fedramp</code>{" "}
            in the ETL workspace, then sync the DB.
          </p>
        </Section>
      ) : (
        <>
          <Section
            number="I"
            title="Distance to the mandate's goal"
            source="mixed"
            lede="Position as the argument: the center is the mandate fulfilled — every eligible worker has a tool. Each agency sits as far from the center as its staff are from that goal; the ring around an agency is peer-proven capability it holds but doesn't use."
          >
            <div className="border-t-2 border-foreground pt-4">
              <GravityWell agencies={model.agencies} />
            </div>
          </Section>

          <Section
            number="II"
            title="Who proved it for whom"
            source="mixed"
            lede="Relation as the argument: every arc connects an agency that reports real use of a product to an agency that holds the same product authorized and reports nothing. The de-risking already happened — the arcs show who did it for whom."
          >
            <div className="border-t-2 border-foreground pt-4">
              <PeerProofArcs agencies={model.agencies} pairs={model.pairs} />
            </div>
          </Section>

          <Section
            number="III"
            title="One rectangle of government"
            source="mixed"
            lede="Area as the argument: the whole profiled AI-eligible workforce as a single rectangle, every agency a tile sized by its people, painted by how many of them have a tool. Nothing is left out — the accounting is visibly exhaustive."
          >
            <div className="border-t-2 border-foreground pt-4">
              <WorkforceTreemap agencies={model.agencies} />
            </div>
          </Section>

          <Section
            number="IV"
            title="Capability weather vs. access weather"
            source="mixed"
            lede="Time as the argument: two calendars over the same fifteen years. The top strip rains steadily — agencies' first ATOs on core-AI-bearing packages, month after month since 2013. The bottom strip stays dry until late 2024."
          >
            <div className="border-t-2 border-foreground pt-4">
              <CapabilityWeather events={model.events} />
            </div>
          </Section>

          <div className="mt-14 border border-border p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Reading the lab
            </p>
            <p className="mt-3 max-w-prose text-[0.85rem] leading-[1.5] text-foreground/80">
              These four are sketches of the same facts, kept to publication
              standard so any can graduate into an article figure. The
              established figures live at{" "}
              <Link href="/figures" className="text-foreground underline-offset-2 hover:underline hover:text-[var(--stamp)]">
                /figures
              </Link>
              ; the full boards behind this data are{" "}
              <Link href="/fedramp/coverage/sleeping-services" className="text-foreground underline-offset-2 hover:underline hover:text-[var(--stamp)]">
                sleeping services
              </Link>{" "}
              and{" "}
              <Link href="/fedramp/coverage/agencies" className="text-foreground underline-offset-2 hover:underline hover:text-[var(--stamp)]">
                agency gaps
              </Link>
              .
            </p>
          </div>
        </>
      )}
    </div>
  );
}

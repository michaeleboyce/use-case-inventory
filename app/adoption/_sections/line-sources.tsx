// app/adoption/_sections/line-sources.tsx — per-line source documentation
// for the adoption chart: one bullet per plotted line, each with the mandate
// instrument, the data source(s), and how each source supports the plotted
// points. Rendered on /adoption (§ Method & sources) and embedded in the
// /figures/adoption-curves capture so exported images keep full provenance.
// Every URL verified live 2026-07-26; per-claim verification votes in the
// ETL repo at audit/article/research_2026-07-26/.

import { Citation } from "@/components/citation";

/** Swatch matching the chart's series color (solid or dashed). */
function Swatch({ colorVar, dashed }: { colorVar: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-block w-4 align-middle"
      style={
        dashed
          ? { height: 0, borderTop: `2px dashed var(${colorVar})` }
          : { height: 2, background: `var(${colorVar})` }
      }
    />
  );
}

interface LineSourceEntry {
  colorVar: string;
  dashed?: boolean;
  line: string;
  population: string;
  sources: {
    citation: { url: string; title: string; accessed: string };
    role: string;
  }[];
}

const LINES: LineSourceEntry[] = [
  {
    colorVar: "--chart-adoption-1",
    line: "Federal HTTPS — enforced",
    population: "live parent .gov domains, executive branch",
    sources: [
      {
        citation: {
          url: "https://obamawhitehouse.archives.gov/sites/default/files/omb/memoranda/2015/m-15-13.pdf",
          title: "OMB M-15-13 — The HTTPS-Only Standard (June 8, 2015)",
          accessed: "2026-07-26",
        },
        role: "The mandate instrument: sets the June 2015 year-0 for the mandate clock and the colored rule at yr 20.6 of the tech clock, and defines the standard the line measures compliance with.",
      },
      {
        citation: {
          url: "https://github.com/GSA/https/tree/master/compliance/m-15-13/data",
          title: "GSA archived Pulse HTTPS scans (weekly parents-*.csv)",
          accessed: "2026-07-06",
        },
        role: "The data: every plotted point is IFP-computed from these raw weekly scan files (82 snapshots, Jun 2015 → Dec 2016). “Enforced” = the domain defaults to or strictly forces HTTPS (the archived Pulse definition); denominator = live parent .gov domains in that week's scan (~1,130–1,190).",
      },
    ],
  },
  {
    colorVar: "--chart-adoption-1",
    dashed: true,
    line: "Federal HTTPS — supported",
    population: "live parent .gov domains, executive branch",
    sources: [
      {
        citation: {
          url: "https://github.com/GSA/https/tree/master/compliance/m-15-13/data",
          title: "GSA archived Pulse HTTPS scans (weekly parents-*.csv)",
          accessed: "2026-07-06",
        },
        role: "Same scan files and denominator as the enforced line; “supported” = valid HTTPS that does not downgrade — the softer Pulse bar, deliberately plotted as its own dashed line.",
      },
    ],
  },
  {
    colorVar: "--chart-adoption-2",
    line: "Federal strong-auth login (PIV)",
    population: "federal civilian CFO Act agency users",
    sources: [
      {
        citation: {
          url: "https://www.dhs.gov/homeland-security-presidential-directive-12",
          title: "HSPD-12 — Policy for a Common Identification Standard (Aug 27, 2004)",
          accessed: "2026-07-26",
        },
        role: "The mandate instrument: year-0 for the mandate clock and the rule at yr 9.2 of the tech clock (smart-card credentials in commercial use since ≈mid-1990s).",
      },
      {
        citation: {
          url: "https://obamawhitehouse.archives.gov/blog/2015/07/31/strengthening-enhancing-federal-cybersecurity-21st-century",
          title: "OMB FISMA annual reports & 2015 Cybersecurity Sprint results (White House)",
          accessed: "2026-07-06",
        },
        role: "The data: each point is a government-wide PIV / strong-auth login percentage as published — 1.24% (FY2010) and ~20% (FY2013) from the FISMA annual reports, 42% → 72% from the 2015 Sprint announcement, 81% (Nov 2015) from the FY2015 FISMA report. Metric definitions vary slightly across reports (noted in the data).",
      },
    ],
  },
  {
    colorVar: "--chart-adoption-5",
    line: "Federal DNSSEC — .gov signed",
    population: "federal second-level .gov domains",
    sources: [
      {
        citation: {
          url: "https://obamawhitehouse.archives.gov/sites/default/files/omb/memoranda/fy2008/m08-23.pdf",
          title: "OMB M-08-23 — Securing the Federal Government's DNS Infrastructure (Aug 22, 2008)",
          accessed: "2026-07-21",
        },
        role: "The mandate instrument: year-0 for the mandate clock and the rule at yr 3.5 of the tech clock (DNSSEC-bis specs, RFC 4033–4035, Mar 2005). Also defines the line's metric — all agency second-level .gov domains DNSSEC-signed — and the Dec 2009 deadline the first point measures against.",
      },
      {
        citation: {
          url: "https://obamawhitehouse.archives.gov/sites/default/files/omb/assets/egov_docs/fy11_fisma.pdf",
          title: "OMB FY2011 FISMA Annual Report to Congress",
          accessed: "2026-07-26",
        },
        role: "The 35% (FY2010) and 65% (FY2011) points: the government-wide “DNSSEC Implementation” percentages in the capability table (p.8) and Figure 9 — measured by DHS scans, not agency self-reports.",
      },
      {
        citation: {
          url: "https://obamawhitehouse.archives.gov/sites/default/files/omb/assets/egov_docs/fy12_fisma.pdf",
          title: "OMB FY2012 FISMA Annual Report to Congress",
          accessed: "2026-07-26",
        },
        role: "The 74% (FY2012) point: the same DHS-measured series continued (capability table p.25; Figure 10).",
      },
      {
        citation: {
          url: "https://usgv6-deploymon.nist.gov/cgi-bin/generate-gov",
          title: "NIST USGv6 deployment monitor — federal .gov DNSSEC & IPv6 statistics",
          accessed: "2026-07-26",
        },
        role: "The 2026 endpoint: IFP computed 84.4% signed (1,129 of the 1,338 domains on CISA's federal .gov list; 81.8% also validate and chain from .gov) from the monitor's 2026-07-26 per-domain snapshot. Denominator differs from the FISMA-era scans — the point is flagged approximate.",
      },
      {
        citation: {
          url: "https://www.usenix.org/system/files/conference/lisa12/lisa12-final-27_0.pdf",
          title: "NIST — USENIX LISA '12 study of .gov DNSSEC deployment (Rose)",
          accessed: "2026-07-21",
        },
        role: "Corroboration for the early trajectory: NIST's own daily scans found ~20% of federal zones signed at the Dec 2009 deadline and 54% signed-and-chained by Mar 2012 (a different denominator than the FISMA series — cross-check only, not plotted).",
      },
    ],
  },
  {
    colorVar: "--chart-adoption-4",
    line: "Federal cloud (agency ATOs)",
    population: "the 24 CFO Act agencies",
    sources: [
      {
        citation: {
          url: "https://obamawhitehouse.archives.gov/sites/default/files/omb/assets/egov_docs/fedrampmemo.pdf",
          title: "OMB FedRAMP policy memo — Security Authorization of Information Systems in Cloud Computing Environments (Dec 8, 2011)",
          accessed: "2026-07-26",
        },
        role: "The mandate instrument: year-0 for the mandate clock and the rule at yr 5.3 of the tech clock (commercial IaaS in use since the Aug 2006 EC2 public beta; follows Cloud First, Dec 2010).",
      },
      {
        citation: {
          url: "https://use-case-inventory.vercel.app/fedramp/marketplace",
          title: "IFP analysis of the FedRAMP marketplace (snapshot 2026-06-12)",
          accessed: "2026-06-12",
        },
        role: "The data: each step is one CFO Act agency's earliest agency-ATO date on a FedRAMP-authorized service, from IFP's marketplace crosswalk. A floor — services withdrawn before the snapshot aren't counted.",
      },
    ],
  },
  {
    colorVar: "--stamp",
    line: "Federal LLM access (corroborated floor)",
    population: "AI-eligible workers at IFP-profiled agencies",
    sources: [
      {
        citation: {
          url: "https://www.whitehouse.gov/wp-content/uploads/2025/07/Americas-AI-Action-Plan.pdf",
          title: "America's AI Action Plan (July 23, 2025)",
          accessed: "2026-07-26",
        },
        role: "The mandate instrument: the LLM-access mandate marked at yr 2.6 of this pair's clock (which starts at the ChatGPT public release, Nov 30, 2022).",
      },
      {
        citation: {
          url: "https://use-case-inventory.vercel.app/experience",
          title: "IFP web-corroborated agency access evidence (methodology at /experience)",
          accessed: "2026-06-12",
        },
        role: "The data: cumulative share of AI-eligible federal workers with a general-purpose AI tool, weighting each agency by its best dated, web-corroborated share of eligible staff; agencies with only tier evidence count as zero. Evidence dates lag rollouts — the line is a floor. IFP assessments, not OMB data.",
      },
    ],
  },
  {
    colorVar: "--stamp",
    dashed: true,
    line: "Federal LLM access (bullish: agency availability)",
    population: "AI-eligible workers at IFP-profiled agencies",
    sources: [
      {
        citation: {
          url: "https://use-case-inventory.vercel.app/experience",
          title: "IFP web-corroborated agency access evidence (methodology at /experience)",
          accessed: "2026-06-12",
        },
        role: "Same evidence base as the floor line, read bullishly: an agency's full AI-eligible workforce counts from its first dated corroborated rollout — availability, not measured use. The gap between the dashed and solid vermilion lines is the uncertainty band.",
      },
    ],
  },
];

/**
 * Bulleted source list organized by chart line: mandate instrument + data
 * source(s) per line, each with what it contributes to the plotted curve.
 */
export function AdoptionLineSources() {
  return (
    <ul className="space-y-4">
      {LINES.map((entry) => (
        <li key={entry.line}>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground">
            <Swatch colorVar={entry.colorVar} dashed={entry.dashed} />
            {entry.line}{" "}
            <span className="normal-case tracking-normal text-muted-foreground">
              ({entry.population})
            </span>
          </p>
          <ul className="mt-1.5 space-y-1.5 border-l border-border pl-4">
            {entry.sources.map((s) => (
              <li key={s.citation.url + entry.line} className="text-[0.85rem] leading-[1.55] text-muted-foreground">
                <Citation
                  url={s.citation.url}
                  title={s.citation.title}
                  accessed={s.citation.accessed}
                />{" "}
                — {s.role}
              </li>
            ))}
          </ul>
        </li>
      ))}
      <li className="text-[0.8rem] leading-[1.55] text-muted-foreground/80">
        Every plotted point exports with its provenance at{" "}
        <a
          href="/api/adoption-series.csv"
          className="underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
        >
          adoption-series.csv
        </a>
        ; adversarial-verification votes and refuted-claim records for the
        DNSSEC series live in the IFP research archive
        (audit/article/research_2026-07-26).
      </li>
    </ul>
  );
}

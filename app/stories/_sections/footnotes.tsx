/**
 * /stories — footnote apparatus.
 *
 * One entry per external source, reused across claims. `<Fn n>` renders the
 * inline superscript; pass `first` on a number's first occurrence so the
 * footnote's ↩ backlink has a target. Every URL here was either taken from
 * IFP's evidence tables (which store verbatim quotes + confidence ratings)
 * or verified against the live source during compilation (2026-07-03).
 * Where an article's exact headline could not be confirmed, the citation
 * describes the piece instead of quoting a title.
 */

export interface FootnoteEntry {
  n: number;
  /** Full citation text (publication, title, date). */
  cite: string;
  url: string;
  urlLabel: string;
  /** Secondary link (e.g. a supplemental report). */
  extra?: { url: string; label: string };
}

export const FOOTNOTES: FootnoteEntry[] = [
  {
    n: 1,
    cite: "Cybersecurity & Information Systems Information Analysis Center (CSIAC/DTIC), “DHS’s Responsible Use of Generative AI Tools,” Dec. 17, 2024.",
    url: "https://csiac.dtic.mil/articles/dhss-responsible-use-of-generative-ai-tools/",
    urlLabel: "csiac.dtic.mil",
  },
  {
    n: 2,
    cite: "Nextgov/FCW, “DHS generative AI pilot embraces hiccups of emerging tech,” July 2024.",
    url: "https://www.nextgov.com/artificial-intelligence/2024/07/dhs-generative-ai-pilot-embraces-hiccups-emerging-tech/397982/",
    urlLabel: "nextgov.com",
  },
  {
    n: 3,
    cite: "Nextgov/FCW, “DHS launches internal GenAI chatbot to leverage non-public data,” Dec. 2024.",
    url: "https://www.nextgov.com/artificial-intelligence/2024/12/dhs-launches-internal-genai-chatbot-leverage-non-public-data/401733/",
    urlLabel: "nextgov.com",
  },
  {
    n: 4,
    cite: "Axios, “Mayorkas unveils new chatbot for Homeland Security staff,” Dec. 17, 2024.",
    url: "https://www.axios.com/2024/12/17/homeland-security-internal-chatbot-alejandro-mayorkas",
    urlLabel: "axios.com",
  },
  {
    n: 5,
    cite: "FedScoop, “Homeland Security cuts off access to ChatGPT and other commercial AI,” May 23, 2025.",
    url: "https://fedscoop.com/homeland-security-cuts-off-access-to-chatgpt-and-other-commercial-ai/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 6,
    cite: "FedScoop, report on StateChat, Northstar, and FAMSearch, Dec. 11, 2024.",
    url: "https://fedscoop.com/state-department-ai-chatbot-email-drafting-northstar-famsearch/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 7,
    cite: "FedScoop, report on StateChat usage, mobile app, and cable queries.",
    url: "https://fedscoop.com/state-departments-ai-chatbot-mobile-app-cable-queries/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 8,
    cite: "FedScoop, report on State Department agentic-AI plans and StateChat scale, Apr. 14, 2026.",
    url: "https://fedscoop.com/state-department-agentic-ai-plans/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 9,
    cite: "State Magazine, feature on StateChat and enterprise AI, Dec. 2024.",
    url: "https://statemag.state.gov/2024/12/1224feat03/",
    urlLabel: "statemag.state.gov",
  },
  {
    n: 10,
    cite: "Savannah River Nuclear Solutions, “AI pilot programs create efficiencies at SRS” (news release), 2024.",
    url: "https://www.savannahrivernuclearsolutions.com/news/releases/2024/nr24_AI_pilot_programs_create_efficiencies_at_SRS.pdf",
    urlLabel: "savannahrivernuclearsolutions.com (PDF)",
  },
  {
    n: 11,
    cite: "WFXG-TV, “Savannah River Site introduces new AI technology.”",
    url: "https://www.wfxg.com/news/savannah-river-site-introduces-new-ai-technology/article_2d4506ca-95d4-4230-b89b-c29ee945af20.html",
    urlLabel: "wfxg.com",
  },
  {
    n: 12,
    cite: "HPCwire, “Savannah River Site Contractor Expands AI Capabilities to Support DOE Genesis Mission,” May 2026.",
    url: "https://www.hpcwire.com/off-the-wire/savannah-river-site-contractor-expands-ai-capabilities-to-support-doe-genesis-mission/",
    urlLabel: "hpcwire.com",
  },
  {
    n: 13,
    cite: "EFCOG Training Working Group, Joulix briefing slides, Oct. 9, 2025.",
    url: "https://efcog.org/wp-content/uploads/Wgs/Training%20Working%20Group/Meetings/2025/2025-10-09%20EFCOG%20TWG%20Joulix%20Slides.pdf",
    urlLabel: "efcog.org (PDF)",
  },
  {
    n: 14,
    cite: "FedScoop, “Anthropic makes generative AI widely available at major national lab” (LLNL), July 9, 2025.",
    url: "https://fedscoop.com/anthropic-makes-generative-ai-widely-available-at-major-national-lab/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 15,
    cite: "FedScoop, “USDA determined ChatGPT’s risk was ‘high,’ set up board to review generative AI use, documents show,” Dec. 2023.",
    url: "https://fedscoop.com/usda-determined-chatgpt-risk-high-established-board/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 16,
    cite: "Nextgov/FCW, “USDA is using AI — but doesn’t have required controls to manage risks, watchdog finds,” May 2026 (on USDA OIG report 50801-0018-12, May 12, 2026).",
    url: "https://www.nextgov.com/artificial-intelligence/2026/05/usda-using-ai-doesnt-have-required-controls-manage-risks-watchdog-finds/413643/",
    urlLabel: "nextgov.com",
  },
  {
    n: 17,
    cite: "Nextgov/FCW, “SSA rolling out new chatbot for employees,” Apr. 17, 2025.",
    url: "https://www.nextgov.com/artificial-intelligence/2025/04/ssa-rolling-out-new-chatbot-employees/404658/",
    urlLabel: "nextgov.com",
  },
  {
    n: 18,
    cite: "Social Security Administration, “Social Security Announces AI Enhancements for Hearings Recordings” (press release), Mar. 13, 2025.",
    url: "https://www.ssa.gov/news/en/press/releases/2025-03-13.html",
    urlLabel: "ssa.gov",
  },
  {
    n: 19,
    cite: "FedScoop, “CDC official says generative AI already saved agency workers 41,000 hours,” Sept. 2025 (Travis Hoppe, FedTalks).",
    url: "https://fedscoop.com/cdc-official-says-generative-ai-already-saved-agency-workers-41000-hours/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 20,
    cite: "FedScoop, “HHS rolls out ChatGPT across department,” Sept. 9, 2025.",
    url: "https://fedscoop.com/hhs-rolls-out-chatgpt-across-department/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 21,
    cite: "FedScoop, report on HHS department-wide Claude rollout, Dec. 3, 2025.",
    url: "https://fedscoop.com/hhs-rolls-out-claude-anthropic-ai-tool/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 22,
    cite: "Fierce Biotech, “HHS bans Anthropic’s Claude AI tool as Trump seeks full government blacklisting,” Feb. 2026.",
    url: "https://www.fiercebiotech.com/ai-and-machine-learning/hhs-bans-anthropics-claude-ai-tool-trump-seeks-full-government-blacklisting",
    urlLabel: "fiercebiotech.com",
  },
  {
    n: 23,
    cite: "NIH Catalyst, “ChIRP: A ChatGPT Model for the NIH Intramural Community,” Mar.–Apr. 2025.",
    url: "https://irp.nih.gov/catalyst/33/2/chirp-a-chatgpt-model-for-the-nih-intramural-community",
    urlLabel: "irp.nih.gov",
  },
  {
    n: 24,
    cite: "Nextgov/FCW, “FDA unveils Elsa, generative AI tool for staff,” June 2025.",
    url: "https://www.nextgov.com/artificial-intelligence/2025/06/fda-unveils-elsa-generative-ai-tool-staff/405761/",
    urlLabel: "nextgov.com",
  },
  {
    n: 25,
    cite: "FedScoop, “Charles Worthington, top VA tech and AI official, departs agency,” Mar. 12, 2026 (carries the verbatim all-employee VA GPT statement).",
    url: "https://fedscoop.com/charles-worthington-leaves-veterans-affairs/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 26,
    cite: "VA Office of Inspector General, “Review of VHA’s Use of Generative Artificial Intelligence,” Preliminary Result Advisory Memorandum 26-00182-42, Jan. 15, 2026.",
    url: "https://www.vaoig.gov/sites/default/files/reports/2026-01/vaoig-26-00182-42_final.pdf",
    urlLabel: "vaoig.gov (PDF)",
  },
  {
    n: 27,
    cite: "Military.com, “VA Doctors Can Finally Look You in the Eye, Thanks to a New AI Tool,” Dec. 17, 2025.",
    url: "https://www.military.com/benefits/veterans-health-care/2025/12/17/va-doctors-can-finally-look-you-eye-thanks-new-ai-tool.html",
    urlLabel: "military.com",
  },
  {
    n: 28,
    cite: "FedScoop, report on OPM making Copilot Chat and ChatGPT available to its workforce via OneGov, Sept. 19, 2025.",
    url: "https://fedscoop.com/opm-makes-copilot-chatgpt-available-workforce-onegov/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 29,
    cite: "FedScoop, report on OPM dropping Claude and adding Grok and Codex in its AI-use disclosure, Mar. 5, 2026.",
    url: "https://fedscoop.com/opm-drops-claude-adds-grok-codex-ai-use-disclosure/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 30,
    cite: "GSA, “GSA Announces New Partnership with OpenAI, Delivering Deep Discount to ChatGPT Gov-Wide Through MAS” (news release), Aug. 6, 2025.",
    url: "https://www.gsa.gov/about-us/newsroom/news-releases/gsa-announces-new-partnership-with-openai-delivering-deep-discount-to-chatgpt-08062025",
    urlLabel: "gsa.gov",
  },
  {
    n: 31,
    cite: "GSA, “GSA Strikes Another OneGov Deal with Anthropic to Offer Claude AI to all Branches of Gov for Just $1” (news release), Aug. 12, 2025.",
    url: "https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-strikes-onegov-deal-with-anthropic-08122025",
    urlLabel: "gsa.gov",
  },
  {
    n: 32,
    cite: "GSA, GSA–Google Gemini OneGov agreement (news release), Aug. 21, 2025.",
    url: "https://www.gsa.gov/about-us/newsroom/news-releases/gsa-google-announce-gemini-onegov-agreement-08212025",
    urlLabel: "gsa.gov",
  },
  {
    n: 33,
    cite: "FedScoop, “GSA is planning to bring its chatbot to the rest of government,” July 31, 2025.",
    url: "https://fedscoop.com/general-services-administration-gsai-artificial-intelligence-chatbot-federal-government/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 34,
    cite: "FedScoop, report on GSAi’s staged rollout, Mar. 20, 2025.",
    url: "https://fedscoop.com/gsa-generative-ai-tool-doge/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 35,
    cite: "Nextgov/FCW, “GSA to require agencies to pay for USAi after launching it as free service,” Apr. 7, 2026.",
    url: "https://www.nextgov.com/artificial-intelligence/2026/04/gsa-require-agencies-pay-usai-after-launching-it-free-service/412678/",
    urlLabel: "nextgov.com",
  },
  {
    n: 36,
    cite: "FedScoop, report on the Justice Department’s AI inventory.",
    url: "https://fedscoop.com/justice-department-artificial-intelligence-ai-surveillance-inventory-predictive-technology-algorithm-bias/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 37,
    cite: "U.S. Department of Housing and Urban Development, “HUD Artificial Intelligence Strategy,” Sept. 2025.",
    url: "https://www.hud.gov/sites/dfiles/Main/documents/HUD-AI-Strategy.pdf",
    urlLabel: "hud.gov (PDF)",
  },
  {
    n: 38,
    cite: "FedScoop, report on GAO’s review of SBA AI use, May 6, 2026.",
    url: "https://fedscoop.com/small-business-administration-ai-use-cases-gao-report/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 39,
    cite: "U.S. Government Accountability Office, “Artificial Intelligence: IRS Actions Needed to Address Skills Gaps, Information Quality, and Strategic Management,” GAO-26-107522, Mar. 24, 2026.",
    url: "https://www.gao.gov/products/gao-26-107522",
    urlLabel: "gao.gov",
    extra: {
      url: "https://www.gao.gov/products/gao-26-108418",
      label: "supplemental inventory: GAO-26-108418",
    },
  },
  {
    n: 40,
    cite: "FedScoop, “IRS’s AI voicebots and chatbots have room to grow, advisory panel says,” Nov. 2024.",
    url: "https://fedscoop.com/irs-ai-chatbot-voicebot-taxpayer-service/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 41,
    cite: "FedScoop, report on OpenAI expanding ChatGPT Enterprise work with the federal government (Treasury pilot), Nov. 5, 2024.",
    url: "https://fedscoop.com/openai-expands-chatgpt-work-federal-government/",
    urlLabel: "fedscoop.com",
  },
];

/** Inline footnote superscript. Set `first` on a number’s first occurrence
 *  so the footnote list’s ↩ backlink resolves. */
export function Fn({ n, first = false }: { n: number; first?: boolean }) {
  return (
    <sup className="font-mono text-[0.68em]">
      <a
        id={first ? `fnref-${n}` : undefined}
        href={`#fn-${n}`}
        className="text-[var(--stamp)] no-underline hover:underline"
        aria-label={`Footnote ${n}`}
      >
        {n}
      </a>
    </sup>
  );
}

export function FootnoteList() {
  return (
    <ol className="list-decimal space-y-2 pl-6 text-[13px] leading-snug text-muted-foreground">
      {FOOTNOTES.map((f) => (
        <li
          key={f.n}
          id={`fn-${f.n}`}
          className="target:bg-[var(--highlight)]/40"
        >
          {f.cite}{" "}
          <a
            href={f.url}
            className="break-all underline decoration-border underline-offset-2 hover:text-foreground"
            rel="noopener"
          >
            {f.urlLabel}
          </a>
          {f.extra ? (
            <>
              {" · "}
              <a
                href={f.extra.url}
                className="underline decoration-border underline-offset-2 hover:text-foreground"
                rel="noopener"
              >
                {f.extra.label}
              </a>
            </>
          ) : null}{" "}
          <a
            href={`#fnref-${f.n}`}
            aria-label={`Back to reference ${f.n}`}
            className="font-mono no-underline hover:text-foreground"
          >
            ↩
          </a>
        </li>
      ))}
    </ol>
  );
}

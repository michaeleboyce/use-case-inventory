/**
 * /fedramp/coverage/spread — route-local footnote apparatus.
 *
 * Same pattern as app/stories/_sections/footnotes.tsx (route-local by
 * design): a page-specific FOOTNOTES array, an inline <Fn> superscript, and
 * a <FootnoteList> that renders the numbered sources with backlinks. Every
 * URL below was fetched and verified against the cited claim on 2026-07-03.
 */

export interface FootnoteEntry {
  n: number;
  cite: string;
  url: string;
  urlLabel: string;
  extra?: { url: string; label: string };
}

export const FOOTNOTES: FootnoteEntry[] = [
  {
    n: 1,
    cite: "FedRAMP Marketplace, “ChatGPT Enterprise and API Platform” (FR2533155773) — 20x authorization, Moderate, authorized Jan 9, 2026; ledger shows 1 authorization, 0 reuses.",
    url: "https://www.fedramp.gov/marketplace/products/FR2533155773/",
    urlLabel: "fedramp.gov",
  },
  {
    n: 2,
    cite: "FedRAMP Marketplace, “Gemini for Government” (FR2604952026) — 20x authorization, Low, authorized Jan 21, 2026; ledger shows 1 authorization, 0 reuses.",
    url: "https://www.fedramp.gov/marketplace/products/FR2604952026/",
    urlLabel: "fedramp.gov",
  },
  {
    n: 3,
    cite: "FedRAMP Marketplace, “Perplexity Enterprise and API Platform” (FR2604643715) — 20x authorization, Low, authorized Feb 1, 2026; ledger shows 1 authorization, 0 reuses.",
    url: "https://www.fedramp.gov/marketplace/products/FR2604643715/",
    urlLabel: "fedramp.gov",
  },
  {
    n: 4,
    cite: "ExecutiveGov, “OpenAI to Offer ChatGPT at $1 Per Federal Agency” (Aug 7, 2025) — ChatGPT Enterprise for a $1 annual fee per agency via GSA's OneGov Multiple Award Schedule.",
    url: "https://www.executivegov.com/articles/chatgpt-federal-subscription-openai-gsa-gruenbaum",
    urlLabel: "executivegov.com",
  },
  {
    n: 5,
    cite: "GSA newsroom, “GSA, Google Announce Transformative ‘Gemini for Government’ OneGov Agreement” (Aug 21, 2025) — Google's AI stack at $0.47 per agency through 2026.",
    url: "https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-google-announce-gemini-onegov-agreement-08212025",
    urlLabel: "gsa.gov",
  },
  {
    n: 6,
    cite: "GSA newsroom, “GSA and Perplexity Sign First Direct to Government Deal” (Nov 19, 2025) — Perplexity Enterprise Pro for Government at $0.25 per agency over an 18-month term, a first-of-its-kind direct OneGov agreement.",
    url: "https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-perplexity-sign-first-direct-to-gov-deal-11192025",
    urlLabel: "gsa.gov",
  },
  {
    n: 7,
    cite: "Nextgov/FCW, “GSA to require agencies to pay for USAi after launching it as a free service” (Apr 7, 2026) — 15 agencies using USAi, more on a waiting list; cost-recovery pricing begins fiscal 2027.",
    url: "https://www.nextgov.com/artificial-intelligence/2026/04/gsa-require-agencies-pay-usai-after-launching-it-free-service/412678/",
    urlLabel: "nextgov.com",
  },
  {
    n: 8,
    cite: "Google Cloud blog, “Gemini for Government: Build custom AI agents for unclassified work on GenAI.mil” (Mar 10, 2026) — GenAI.mil served 3M+ personnel, passed 1M unique users in just over a month from its Dec 2025 launch, with 5 of 6 military branches designating it their enterprise AI platform. Vendor-reported; Department of War systems sit outside the civilian inventory scope of this site.",
    url: "https://cloud.google.com/blog/topics/public-sector/gemini-for-government-build-custom-ai-agents-for-unclassified-work-on-genaimil",
    urlLabel: "cloud.google.com",
  },
  {
    n: 9,
    cite: "OpenAI, “Providing ChatGPT to the entire U.S. federal workforce” — vendor-reported: since 2024, 90,000+ users across 3,500+ US federal, state, and local government agencies have sent 18M+ messages.",
    url: "https://openai.com/index/providing-chatgpt-to-the-entire-us-federal-workforce/",
    urlLabel: "openai.com",
  },
  {
    n: 10,
    cite: "FedScoop, “Anthropic faces fallout across federal agencies from DOD clash” (Feb 27, 2026) — presidential directive that agencies “immediately cease” all use of Anthropic technology with a six-month phase-out; Defense Secretary Hegseth designated Anthropic a supply-chain risk; GSA removed Anthropic from USAi.gov and terminated its Multiple Award Schedule opportunities.",
    url: "https://fedscoop.com/anthropic-claude-dod-federal-agency-fallout-trump-hegseth/",
    urlLabel: "fedscoop.com",
  },
  {
    n: 11,
    cite: "FedRAMP, “Agency Authorization Playbook” — a FedRAMP authorization does not by itself let an agency use a product: each agency must still issue its own ATO, with a presumption of adequacy for the existing package.",
    url: "https://www.fedramp.gov/resources/documents/Agency_Authorization_Playbook.pdf",
    urlLabel: "fedramp.gov (PDF)",
  },
];

/** Inline superscript footnote reference. Pass `first` on a number's first
 *  occurrence so the footnote's ↩ backlink has a target. */
export function Fn({ n, first = false }: { n: number; first?: boolean }) {
  return (
    <sup id={first ? `fnref-${n}` : undefined} className="ml-px">
      <a
        href={`#fn-${n}`}
        className="font-mono text-[0.72em] text-[var(--stamp)] no-underline hover:underline"
        aria-label={`Footnote ${n}`}
      >
        {n}
      </a>
    </sup>
  );
}

export function FootnoteList() {
  return (
    <ol className="space-y-3">
      {FOOTNOTES.map((f) => (
        <li
          key={f.n}
          id={`fn-${f.n}`}
          className="flex gap-3 text-[0.88rem] leading-[1.5] text-foreground/85"
        >
          <span className="shrink-0 font-mono text-[11px] text-[var(--stamp)]">
            {f.n}.
          </span>
          <span>
            {f.cite}{" "}
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--stamp)] underline underline-offset-2"
            >
              {f.urlLabel}
            </a>
            {f.extra ? (
              <>
                {" · "}
                <a
                  href={f.extra.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--stamp)] underline underline-offset-2"
                >
                  {f.extra.label}
                </a>
              </>
            ) : null}{" "}
            <a
              href={`#fnref-${f.n}`}
              className="font-mono text-[11px] text-muted-foreground no-underline hover:text-[var(--stamp)]"
              aria-label={`Back to reference ${f.n}`}
            >
              ↩
            </a>
          </span>
        </li>
      ))}
    </ol>
  );
}

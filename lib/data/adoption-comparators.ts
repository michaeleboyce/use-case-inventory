// lib/data/adoption-comparators.ts
//
// Hand-verified external comparators for the /figures/adoption-comparators
// figure. These are CHECKED-IN facts (not DB-derived): every comparator cell
// traces to a source URL, an access date, and a verification vote from the
// 2026-07-06/07 deep-research adversarial pass. Do NOT regenerate from the DB.
//
// Provenance of record:
//   - ETL repo: audit/article/research_2026-07-07/comparators.csv
//     (source URLs + 3-vote verification votes for the six comparators and
//     the two RCTs) and audit/article/fact_sheet.md §8 (required phrasings,
//     the do-not-use list, the SR/T/RCT/V metric-type discipline).
//   - US-column public sources (OneGov / USAi / the mandate) reuse the
//     dashboard's own canonical citations in app/stories/_sections/footnotes.tsx
//     and app/about/page.tsx. US inventory-derived cells are IFP analysis of
//     the 2025 Federal AI Use Case Inventory (this dashboard), not OMB data.
//
// The two claims that did NOT survive verification (Singapore default-on
// provisioning, 0-3; the Accenture staged 2.5-year timeline, 1-2) are recorded
// in EXCLUDED_CLAIMS so the figure can show what was deliberately left out.

/** A comparator column. `government` vs `enterprise` only groups the header. */
export interface ComparatorEntity {
  id: string;
  label: string;
  sub: string;
  kind: "government" | "enterprise";
}

/**
 * Cell states for the mechanism-presence matrix.
 *
 *  - `evidenced`   the mechanism is present, with evidence (✓)
 *  - `absent`      the mechanism is evidenced ABSENT — evidence of absence (✗)
 *  - `partial`     present in part / weaker form
 *  - `none`        NOT evidenced — absence of evidence, NOT evidence of
 *                  absence; neutral, never read as a "no"
 *  - `measured-zero` / `no-data`  used only by the inverted coding row (row 9)
 */
export type CellState =
  | "evidenced"
  | "absent"
  | "partial"
  | "none"
  | "measured-zero"
  | "no-data";

export interface MechanismCell {
  state: CellState;
  /** Terse evidence phrase shown in the cell (may be empty for `none`). */
  detail: string;
  /** Key into SOURCES; omitted for `none` cells (nothing to cite). */
  sourceKey?: string;
}

export interface MechanismRow {
  id: string;
  label: string;
  /** One-line gloss under the row label. */
  note?: string;
  /** Row 9 inverts the matrix — the US is the only entity that can answer. */
  inverted?: boolean;
  /** Keyed by ComparatorEntity.id. */
  cells: Record<string, MechanismCell>;
}

export interface SourceRef {
  label: string;
  url?: string;
  accessed?: string;
  /** 3-vote adversarial-panel result, where one applies. */
  vote?: string;
}

/** One figure in the evidence-quality ledger (Panel 2). */
export interface EvidenceItem {
  entity: string;
  figure: string;
  metric: string;
  sourceKey: string;
  /** For the two signed RCT results, drives the direction indicator. */
  sign?: "up" | "down";
}

export interface EvidenceGroup {
  id: "self-reported" | "vendor-reported" | "telemetry" | "rct";
  label: string;
  tag: string;
  /** Reliability gloss shown under the group header. */
  gloss: string;
  items: EvidenceItem[];
}

export interface ExcludedClaim {
  claim: string;
  vote: string;
  sourceKey: string;
  why: string;
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export const ENTITIES: ComparatorEntity[] = [
  { id: "us", label: "US Federal", sub: "the mandate", kind: "government" },
  { id: "uk", label: "UK", sub: "GDS / DWP trials", kind: "government" },
  { id: "au", label: "Australia", sub: "DTA trial", kind: "government" },
  { id: "sg", label: "Singapore", sub: "GovTech / Pair", kind: "government" },
  { id: "accenture", label: "Accenture", sub: "M365 Copilot", kind: "enterprise" },
  { id: "moderna", label: "Moderna", sub: "ChatGPT Enterprise", kind: "enterprise" },
];

// ---------------------------------------------------------------------------
// Panel 1 — mechanism-presence matrix
// ---------------------------------------------------------------------------

export const MECHANISM_ROWS: MechanismRow[] = [
  {
    id: "access",
    label: "Cheap / fast access provisioning",
    note: "Getting a general-purpose tool into staff hands",
    cells: {
      us: { state: "evidenced", detail: "OneGov $0.25–$1 / agency; USAi", sourceKey: "us-onegov" },
      uk: { state: "evidenced", detail: "20K-license cross-government trial", sourceKey: "uk-gds" },
      au: { state: "evidenced", detail: "Licenses live ~6.5 weeks after announcement", sourceKey: "au-dta" },
      sg: { state: "evidenced", detail: "Central Pair Chat", sourceKey: "sg-mddi" },
      accenture: { state: "evidenced", detail: "~743K licenses rolling out", sourceKey: "accenture" },
      moderna: { state: "evidenced", detail: "ChatGPT Enterprise, all digitally-enabled staff", sourceKey: "moderna" },
    },
  },
  {
    id: "platform",
    label: "Central platform / product org",
    note: "A government-built tool, not just a contract",
    cells: {
      us: { state: "partial", detail: "USAi: 15 agencies, FCSF cap, cost-recovery FY2027", sourceKey: "us-usai" },
      uk: { state: "absent", detail: "Departmental tenants; central coordination only", sourceKey: "uk-gds" },
      au: { state: "absent", detail: "Existing per-agency Microsoft contracts", sourceKey: "au-dta" },
      sg: { state: "evidenced", detail: "Pair, centrally built by government", sourceKey: "sg-mddi" },
      accenture: { state: "none", detail: "" },
      moderna: { state: "none", detail: "" },
    },
  },
  {
    id: "training",
    label: "Mandatory workforce AI training",
    note: "Required, and actually enforced",
    cells: {
      us: { state: "absent", detail: "Mandate requires “appropriate training for” — never certified or measured", sourceKey: "us-mandate" },
      uk: { state: "none", detail: "" },
      au: { state: "none", detail: "" },
      sg: { state: "evidenced", detail: "Mandatory course, all ~150K officers, Oct 2025", sourceKey: "sg-mddi" },
      accenture: { state: "partial", detail: "Structured training program; “mandatory” not evidenced", sourceKey: "accenture" },
      moderna: { state: "evidenced", detail: "100% adoption AND proficiency objective", sourceKey: "moderna" },
    },
  },
  {
    id: "champions",
    label: "Funded champions / change-management",
    note: "Staffed program driving uptake",
    cells: {
      us: { state: "none", detail: "" },
      uk: { state: "none", detail: "" },
      au: { state: "none", detail: "" },
      sg: { state: "partial", detail: "Leaderboard + comms cadence", sourceKey: "sg-mddi" },
      accenture: { state: "evidenced", detail: "1-on-1 leader training, group sessions, Viva Engage", sourceKey: "accenture" },
      moderna: { state: "evidenced", detail: "Top-100 champions cohort, office hours, forums, incentives", sourceKey: "moderna" },
    },
  },
  {
    id: "telemetry",
    label: "Visible usage telemetry",
    note: "Someone can see who actually uses it",
    cells: {
      us: { state: "absent", detail: "Inventory counts narrative use cases; no usage reporting", sourceKey: "ifp-inventory" },
      uk: { state: "partial", detail: "Trial-period evaluation telemetry", sourceKey: "uk-gds" },
      au: { state: "partial", detail: "Trial usage metrics", sourceKey: "au-dta" },
      sg: { state: "evidenced", detail: "Cross-agency usage leaderboard", sourceKey: "sg-mddi" },
      accenture: { state: "evidenced", detail: "MAU measured: 89% in a 200K tranche", sourceKey: "accenture" },
      moderna: { state: "partial", detail: "Vendor-reported usage intensity", sourceKey: "moderna" },
    },
  },
  {
    id: "target",
    label: "Executive adoption target + deadline",
    note: "A number to hit, by a date",
    cells: {
      us: { state: "absent", detail: "Mandate has no target or deadline", sourceKey: "us-mandate" },
      uk: { state: "none", detail: "" },
      au: { state: "none", detail: "" },
      sg: { state: "none", detail: "" },
      accenture: { state: "none", detail: "" },
      moderna: { state: "evidenced", detail: "CEO-set 100%-in-6-months", sourceKey: "moderna" },
    },
  },
  {
    id: "self-service",
    label: "Self-service bot / workflow building",
    note: "Staff build their own tools",
    cells: {
      us: { state: "none", detail: "" },
      uk: { state: "none", detail: "" },
      au: { state: "none", detail: "" },
      sg: { state: "evidenced", detail: "20,000+ AIBots; any officer, <15 min", sourceKey: "sg-mddi" },
      accenture: { state: "none", detail: "" },
      moderna: { state: "evidenced", detail: "750 GPTs in 2 months; 40% of WAU creating (vendor-reported)", sourceKey: "moderna" },
    },
  },
  {
    id: "evaluation",
    label: "Published rigorous evaluation",
    note: "A real study, not a press release",
    cells: {
      us: { state: "absent", detail: "Inventory ≠ evaluation; no published federal trial evaluation", sourceKey: "ifp-inventory" },
      uk: { state: "evidenced", detail: "GDS + DWP evaluations on gov.uk", sourceKey: "uk-dwp" },
      au: { state: "evidenced", detail: "DTA full evaluation", sourceKey: "au-dta" },
      sg: { state: "partial", detail: "Parliamentary answers, no evaluation", sourceKey: "sg-mddi" },
      accenture: { state: "absent", detail: "Marketing only", sourceKey: "accenture" },
      moderna: { state: "absent", detail: "Marketing only", sourceKey: "moderna" },
    },
  },
  {
    id: "coding-data",
    label: "Coding-assistant / agent deployment data published",
    note: "The one row where the US inventory inverts the comparison",
    inverted: true,
    cells: {
      us: {
        state: "measured-zero",
        detail:
          "Measured: zero live agents — the only whole-inventory, agent-level census anywhere",
        sourceKey: "ifp-inventory",
      },
      uk: {
        state: "evidenced",
        detail:
          "Time-boxed assistant TRIAL w/ telemetry: ~1,900 licences, 50+ orgs, ~418 daily actives, 15.8% acceptance (56 min/day self-reported)",
        sourceKey: "uk-coding",
      },
      au: {
        state: "none",
        detail: "DTA trial was M365 Copilot, not coding — not comparable",
        sourceKey: "coding",
      },
      sg: {
        state: "partial",
        detail: "70-developer pilot study (22% acceptance, survey outcomes)",
        sourceKey: "sg-coding",
      },
      accenture: {
        state: "evidenced",
        detail: "RCT telemetry (GitHub / Accenture Copilot trial)",
        sourceKey: "github-accenture",
      },
      moderna: { state: "none", detail: "" },
    },
  },
];

/**
 * The reframing this row carries — replaces the earlier blanket "no government
 * has published coding data," which a 2026-07-07 verification pass refuted.
 */
export const CODING_FRAMING =
  "No government anywhere has published sustained, production-scale data for autonomous coding AGENTS. The published government evidence is time-boxed autocomplete/chat ASSISTANT trials (UK, Singapore); the US inventory is the only agent-level census — and the answer is zero live. The US “0” is a measured count, not a mechanism mark.";

// ---------------------------------------------------------------------------
// Panel 2 — evidence-quality ledger ("what the numbers actually are")
// ---------------------------------------------------------------------------

export const EVIDENCE_GROUPS: EvidenceGroup[] = [
  {
    id: "self-reported",
    label: "Self-reported survey",
    tag: "SR",
    gloss: "Survey self-estimates — not measured outcomes. The same caution applies to the US numbers here.",
    items: [
      { entity: "UK GDS", figure: "26 min/day", metric: "time saved, survey midpoints (top-capped)", sourceKey: "uk-gds" },
      { entity: "UK DWP", figure: "19 min/day", metric: "SUR-regression estimate across 8 routine tasks", sourceKey: "uk-dwp" },
      { entity: "Australia", figure: "up to 60 min/day", metric: "self-reported savings on summarising / drafting / searching", sourceKey: "au-dta" },
      { entity: "US VA", figure: "2–3 hrs/week", metric: "VA GPT chat self-report (NOT its coding deployment)", sourceKey: "us-va" },
      { entity: "US CDC", figure: "41,000 hours", metric: "agency self-reported time saved", sourceKey: "us-cdc" },
      { entity: "UK coding trial", figure: "56 min/day", metric: "coding-assistant trial self-report (~28 working days/year)", sourceKey: "uk-coding" },
    ],
  },
  {
    id: "vendor-reported",
    label: "Vendor-reported",
    tag: "V",
    gloss: "Company / platform-reported usage. Not independently audited.",
    items: [
      { entity: "Accenture", figure: "89% MAU", metric: "monthly-active in a measured 200K-license tranche", sourceKey: "accenture" },
      { entity: "Moderna", figure: "120 conv./user/week", metric: "vendor-reported, unaudited", sourceKey: "moderna" },
    ],
  },
  {
    id: "telemetry",
    label: "Telemetry (measured)",
    tag: "T",
    gloss: "Observed from tool dashboards — measured usage, but observational, not causal.",
    items: [
      { entity: "UK coding trial", figure: "15.8%", metric: "code-line acceptance rate (tool telemetry); ~418 daily active users", sourceKey: "uk-coding" },
    ],
  },
  {
    id: "rct",
    label: "Randomized trial (measured)",
    tag: "RCT",
    gloss: "Rigorous method — the result can still be negative. Rigor of measurement, not goodness of outcome.",
    items: [
      { entity: "METR", figure: "−19%", metric: "experienced open-source devs SLOWER with AI while believing +20% faster (early-2025)", sourceKey: "metr", sign: "down" },
      { entity: "GitHub / Accenture", figure: "+8.69% PRs", metric: "+15% merge rate, DevOps telemetry RCT (Cui et al., Management Science 2025 corroboration)", sourceKey: "github-accenture", sign: "up" },
    ],
  },
];

/** The perception-gap the caption turns on: measured vs believed for METR. */
export const METR_PERCEPTION = {
  measured: -19,
  believed: 20,
  gapPoints: 39,
};

// ---------------------------------------------------------------------------
// Source registry — every cell's sourceKey resolves here
// ---------------------------------------------------------------------------

export const SOURCES: Record<string, SourceRef> = {
  "uk-gds": {
    label: "UK GDS — cross-government M365 Copilot experiment, findings report",
    url: "https://www.gov.uk/government/publications/microsoft-365-copilot-experiment-cross-government-findings-report/microsoft-365-copilot-experiment-cross-government-findings-report-html",
    accessed: "2026-07-06",
    vote: "2-1 mechanism · 3-0 outcomes",
  },
  "uk-dwp": {
    label: "UK DWP — evaluation of the M365 Copilot trial",
    url: "https://www.gov.uk/government/publications/an-evaluation-of-dwps-microsoft-copilot-365-trial/an-evaluation-of-dwps-microsoft-365-copilot-trial",
    accessed: "2026-07-06",
    vote: "3-0",
  },
  "au-dta": {
    label: "Australia DTA — whole-of-government Copilot trial + evaluation",
    url: "https://www.digital.gov.au/initiatives/copilot-trial",
    accessed: "2026-07-06",
    vote: "3-0",
  },
  "sg-mddi": {
    label: "Singapore MDDI — PQ response on AI-tool adoption in the public service (Pair Chat, AIBots, leaderboard)",
    url: "https://www.mddi.gov.sg/newsroom/mddi-s-response-to-pq-on-progress-of-adopting-ai-tools-within-public-service/",
    accessed: "2026-07-06",
    vote: "3-0",
  },
  accenture: {
    label: "Microsoft Source — Accenture is rolling out Copilot to a workforce the size of Denver",
    url: "https://news.microsoft.com/source/features/digital-transformation/accenture-is-rolling-out-copilot-to-a-workforce-the-size-of-denver/",
    accessed: "2026-07-06",
    vote: "3-0",
  },
  moderna: {
    label: "OpenAI — Moderna (ChatGPT Enterprise case study)",
    url: "https://openai.com/index/moderna/",
    accessed: "2026-07-06",
    vote: "3-0",
  },
  metr: {
    label: "METR — Measuring the impact of AI on experienced open-source developer productivity (early-2025 RCT)",
    url: "https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/",
    accessed: "2026-07-06",
    vote: "3-0",
  },
  "github-accenture": {
    label: "GitHub — quantifying Copilot's impact in the enterprise with Accenture (DevOps-telemetry RCT)",
    url: "https://github.blog/news-insights/research/research-quantifying-github-copilots-impact-in-the-enterprise-with-accenture/",
    accessed: "2026-07-06",
    vote: "2-1",
  },
  "uk-coding": {
    label: "UK GDS/DSIT — AI coding assistant trial, UK public-sector findings report (Nov 2024–Feb 2025; ~1,900 licences, 15.8% code-line acceptance, 56 min/day self-reported)",
    url: "https://www.gov.uk/government/publications/ai-coding-assistant-trial/ai-coding-assistant-trial-uk-public-sector-findings-report",
    accessed: "2026-07-07",
    vote: "verified 2026-07-07",
  },
  "sg-coding": {
    label: "Singapore GovTech — GitHub Copilot for Business pilot study (70 developers; 22% prompt acceptance, survey outcomes)",
    url: "https://arxiv.org/html/2409.17434v1",
    accessed: "2026-07-07",
    vote: "verified 2026-07-07",
  },
  coding: {
    label: "IFP verification pass (2026-07-07) — no government has published sustained, production-scale data for autonomous coding AGENTS; the published government evidence is time-boxed ASSISTANT trials. Australia's DTA trial was M365 Copilot (office productivity), NOT coding.",
    accessed: "2026-07-07",
    vote: "reformulation verified",
  },
  "us-onegov": {
    label: "GSA OneGov agreements (Anthropic $1; Gemini) + OPM enterprise access via OneGov",
    url: "https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-strikes-onegov-deal-with-anthropic-08122025",
    accessed: "2026-07-06",
    vote: "US public source",
  },
  "us-usai": {
    label: "GSA USAi — moved from free service to agency cost-recovery (Nextgov/FCW)",
    url: "https://www.nextgov.com/artificial-intelligence/2026/04/gsa-require-agencies-pay-usai-after-launching-it-free-service/412678/",
    accessed: "2026-07-06",
    vote: "US public source",
  },
  "us-mandate": {
    label: "OMB M-25-21 — Accelerating Federal Use of AI (the mandate whose own text requires only “appropriate training for”)",
    url: "https://www.whitehouse.gov/wp-content/uploads/2025/04/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf",
    accessed: "2026-07-06",
    vote: "mandate text",
  },
  "ifp-inventory": {
    label: "IFP analysis of the 2025 Federal AI Use Case Inventory (this dashboard) — not OMB data",
    accessed: "2026-07-06",
    vote: "IFP analysis",
  },
  "us-va": {
    label: "US VA — VA GPT self-reported usage (chat tool; ~100K users, 2–3 hrs/week). Flagged (SR) per fact_sheet §8 Beat 3.",
    accessed: "2026-07-06",
    vote: "self-reported (SR)",
  },
  "us-cdc": {
    label: "US CDC — agency self-reported hours saved. Flagged (SR) per fact_sheet §8 Beat 3.",
    accessed: "2026-07-06",
    vote: "self-reported (SR)",
  },
};

// ---------------------------------------------------------------------------
// What was deliberately left out (refuted 2026-07-06/07)
// ---------------------------------------------------------------------------

export const EXCLUDED_CLAIMS: ExcludedClaim[] = [
  {
    claim: "Singapore drove uptake by default-on provisioning — auto-launching Pair on officers' browsers rather than opt-in.",
    vote: "refuted 0-3",
    sourceKey: "sg-mddi",
    why: "No evidence of auto-launch; adoption is opt-in. Absence of a mechanism, not evidence of one.",
  },
  {
    claim: "Accenture's rollout followed a staged 2.5-year timeline: Aug 2023 pilot → 20K → ~743K by Apr 2026.",
    vote: "refuted 1-2",
    sourceKey: "accenture",
    why: "No decision-to-universal timeline is citable for Accenture; use only the point-in-time license count.",
  },
];

/** Companion figure — the depth story this comparison points back to. */
export const COMPANION_FIGURE = {
  href: "/figures/integration-depth",
  title: "How coupled is the government's operating AI?",
};

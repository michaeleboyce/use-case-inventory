/**
 * Article-figure registry — the static, capture-ready twins of the
 * reach-vs-access dashboard charts. Each entry reuses the SAME server
 * assembly and client component as the live page, mounted with
 * `exportMode` (fixed width, no tooltips, labels forced on).
 *
 * Capture: Playwright element screenshot of `#figure-frame`, e.g.
 *   page.locator('#figure-frame').screenshot({ path: 'fig.png' })
 * The route chrome (nav, footer) is irrelevant to an element screenshot.
 *
 * To add a figure: add an entry here — the [slug] route picks it up via
 * generateStaticParams. Keep captions self-contained (IFP attribution +
 * snapshot date-stamp) so the exported image never loses its provenance.
 */

import type { ReactNode } from "react";
import { buildFrontierAccessModel } from "@/app/_view-models/frontier-access";
import { buildAccessTrajectoriesModel } from "@/app/_view-models/access-trajectories";
import { AccessShareSlope } from "@/components/charts/access-share-slope";
import { buildDivergenceTimeline } from "@/app/fedramp/coverage/sleeping-services/_view-model";
import { AdoptionCurveChart } from "@/components/charts/adoption-curve-chart";
import { DecouplingScatter } from "@/components/charts/decoupling-scatter";
import { PeopleWaffle } from "@/components/charts/people-waffle";
import { PeopleMosaic } from "@/components/charts/people-mosaic";
import { IntegrationDepthChart } from "@/components/charts/integration-depth-chart";
import { BureauDivergenceChart } from "@/components/charts/bureau-divergence-chart";
import { AdoptionComparatorsChart } from "@/components/charts/adoption-comparators-chart";
import { DivergenceTimeline } from "@/app/fedramp/coverage/sleeping-services/_sections/divergence-timeline";
import { getBureauDivergence, getIntegrationDepthAnalysis } from "@/lib/db";
import { assembleAdoptionSeries } from "@/app/adoption/_view-model";
import { AdoptionLineSources } from "@/app/adoption/_sections/line-sources";
import { formatNumber } from "@/lib/formatting";

const SNAPSHOT = "2026-06-12";
const ATTRIBUTION = `IFP analysis of the FedRAMP marketplace (snapshot ${SNAPSHOT}) and the 2025 Federal AI Use Case Inventory. Access shares are IFP web-corroborated assessments, not OMB data.`;

export interface FigureDef {
  title: string;
  /** Fixed frame width in px for pixel-stable captures. */
  width: number;
  /** Returns the mounted chart, or null when this DB build lacks the data.
   *  `sources` (optional) renders below the caption — a per-line source
   *  list so exported captures keep full provenance. */
  render: () => { node: ReactNode; caption: string; sources?: ReactNode } | null;
}

export const FIGURES: Record<string, FigureDef> = {
  "decoupling-scatter": {
    title: "Frontier capability in reach vs. staff access",
    width: 1080,
    render: () => {
      const model = buildFrontierAccessModel();
      if (!model) return null;
      return {
        node: (
          <DecouplingScatter
            points={model.scatter}
            medianReach={model.medianReach}
            droppedNoAbbr={model.droppedNoAbbr}
            exportMode
          />
        ),
        caption: `Each dot is one agency: core-AI services in scope of packages it holds an ATO for (x) against IFP's estimated share of eligible staff with a general-purpose AI tool (y); dot area is the AI-eligible workforce; hollow dots are tier-prior imputations. "In scope" reflects the package's authorization, not agency enablement. ${ATTRIBUTION}`,
      };
    },
  },
  "people-waffle": {
    title: "The reach-vs-access gap, in workers",
    width: 1080,
    render: () => {
      const model = buildFrontierAccessModel();
      if (!model) return null;
      return {
        node: <PeopleWaffle waffle={model.waffle} exportMode />,
        caption: `One square ≈ ${formatNumber(model.waffle.unit)} AI-eligible federal workers across ${model.waffle.agencyCount} profiled agencies. Red: no general-purpose tool at an agency already holding an ATO on a package with a core-AI service in scope (${model.waffle.imputedAgencyCount} agency shares tier-imputed). ${ATTRIBUTION}`,
      };
    },
  },
  "people-mosaic": {
    title: "The reach-vs-access gap, built from the agencies",
    width: 1080,
    render: () => {
      const model = buildFrontierAccessModel();
      if (!model) return null;
      const m = model.mosaic;
      return {
        node: <PeopleMosaic mosaic={m} exportMode />,
        caption: `The government-wide worker total assembled from ${m.agencies.length + m.pooled.agencyCount} researched agency profiles — one block per agency, 1 square ≈ ${formatNumber(m.unit)} AI-eligible workers, sorted by access share. Solid black = tool under a web-corroborated share; hollow = tier-prior imputed; red = no tool at an agency holding an ATO on a package with a core-AI service in scope; muted = neither. Uncertainty range: corroborated floor ${m.floorPct}% · tier-prior central ${m.centralPct}% · bullish availability ${m.bullishPct}% of eligible workers. ${ATTRIBUTION}`,
      };
    },
  },
  "access-trajectories": {
    title: "How staff access to a general-purpose AI tool grew, by agency",
    width: 1080,
    render: () => {
      const model = buildAccessTrajectoriesModel();
      if (!model) return null;
      return {
        node: <AccessShareSlope model={model} exportMode />,
        caption: `Each line is one agency's best web-corroborated share of eligible staff with a general-purpose AI tool, plotted at its evidence dates (running best — a later, narrower finding never reads as a rollback). Only agencies with ≥2 dated findings are drawn; ${model.singleAnchorCount} agencies with a single dated finding are omitted (no trajectory to draw), Treasury (flat at ~5% across its window) is omitted as an editorial call, and ${model.climberCount} of the drawn agencies climbed ≥25 points within their evidence window. Evidence dates lag rollouts — every trajectory is a floor. ${ATTRIBUTION}`,
      };
    },
  },
  "divergence-timeline": {
    title: "Two clocks: capability in reach vs. corroborated access",
    width: 1080,
    render: () => {
      const data = buildDivergenceTimeline();
      if (!data) return null;
      return {
        node: <DivergenceTimeline data={data} exportMode />,
        caption: `Cumulative agencies whose first agency ATO covers a package with a core-AI service in scope (ink, step) vs. agencies with dated, web-corroborated evidence of a GenAI staff rollout (red marks — sparse by construction). ${ATTRIBUTION}`,
      };
    },
  },
  "integration-depth": {
    title: "How coupled is the government's operating AI?",
    width: 960,
    render: () => {
      const data = getIntegrationDepthAnalysis();
      if (data.totalPD === 0) return null;
      return {
        node: <IntegrationDepthChart data={data} />,
        caption: `Depth of AI integration across the labeled pilot + deployed population (${formatNumber(
          data.totalPD,
        )} individual use cases). Each bar splits generative-AI (stamp) from classical / non-GenAI (muted); the right column is that depth's GenAI share. Operating GenAI concentrates in shallow, standalone chat (${formatNumber(
          data.totalGenAI,
        )} GenAI rows total) while the deeply-integrated estate is overwhelmingly pre-GenAI classical ML. The coding panel splits each coding-tool taxonomy by live (pilot/deployed) vs not-yet-live — all ${data.codingAgent.count} coding-agent filings are pre-deployment. Integration-depth and coding-tool labels are IFP-adjudicated (2026-07 labeling round), not OMB data. IFP analysis of the 2025 Federal AI Use Case Inventory.`,
      };
    },
  },
  "bureau-divergence": {
    title: "Enterprise access is decided below the department",
    width: 880,
    render: () => {
      const rows = getBureauDivergence();
      if (rows.length === 0) return null;
      return {
        node: <BureauDivergenceChart rows={rows} />,
        caption: `Within-department divergence in enterprise-LLM adoption: each square is one scored bureau (org_ai_maturity rows at sub_agency / office level, rolled up one hop to their parent), filled when that bureau independently clears the enterprise-LLM bar. Parents with ≥3 scored bureaus, sorted by enterprise-LLM share. HHS is a federation where every scored opdiv independently qualifies; DOJ's bureaus uniformly do not; DOE is bimodal across its labs. Scored-bureau counts are FLOORS — a bureau under 5 filed use cases isn't scored, so absence from a strip is not evidence of absence. IFP analysis of the 2025 Federal AI Use Case Inventory.`,
      };
    },
  },
  "adoption-curves": {
    title: "Technology adoption: arrival and mandate on each technology's own clock",
    width: 1080,
    render: () => ({
      node: <AdoptionCurveChart series={assembleAdoptionSeries()} exportMode />,
      caption:
        "Government adoption only — every line is a federal-enterprise population. Apples to apples: each series re-based to years since its TECHNOLOGY entered use (year 0 — HTTPS ≈1994 Netscape SSL; smart-card credentials ≈1995; DNSSEC-bis specs Mar 2005; IaaS 2006 EC2 beta; ChatGPT Nov 2022), first 25 years, with each federal mandate marked as a colored rule on that same clock: M-15-13 at yr 20.6, HSPD-12 at yr 9.2, the FedRAMP memo at yr 5.3, M-08-23 (DNSSEC) at yr 3.5, the LLM-access mandate at yr 2.6. Each successive mandate arrives earlier in its technology's life; a curve left of its rule is pre-mandate adoption, right of it is post-mandate. Populations differ by series and are labeled in the legend; denominator caveats and approximate points are flagged in the per-line source list below. Vermilion pair — federal LLM access from the same IFP evidence base: solid = corroborated floor (workers weighted by each agency's best corroborated share; tier-only agencies count as zero), dashed = bullish availability reading (an agency's full AI-eligible workforce counts from its first dated corroborated rollout — availability, not measured use). Evidence dates lag rollouts; IFP assessments, not OMB data. The interactive chart at /adoption also offers the original mandate-clock view (years since each mandate — post-mandate response speed). IFP analysis; external baselines verified 2026-07-06, DNSSEC 2026-07-26.",
      sources: <AdoptionLineSources />,
    }),
  },
  "adoption-comparators": {
    title: "What fast adopters actually did",
    width: 1120,
    render: () => ({
      node: <AdoptionComparatorsChart />,
      caption:
        "Nine adoption mechanisms across the US federal mandate, four foreign governments (UK, Australia, Singapore), and two enterprise rollouts (Accenture, Moderna), then the actual figures grouped by how they were produced. A dash (–) is absence of evidence — the mechanism was not found in the sources reviewed — NOT evidence of absence; only ✗ is a positive finding that a mechanism is missing. Every comparator cell traces to a source URL, an access date, and a 3-vote adversarial-verification result (see footnotes); the two refuted claims are shown as deliberately excluded. Self-reported figures are survey data, not measured outcomes. US inventory-derived cells are IFP analysis of the 2025 Federal AI Use Case Inventory; external comparator facts verified 2026-07-06/07. Companion: /figures/integration-depth.",
    }),
  },
};

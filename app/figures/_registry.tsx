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
import { buildDivergenceTimeline } from "@/app/fedramp/coverage/sleeping-services/_view-model";
import { AdoptionCurveChart } from "@/components/charts/adoption-curve-chart";
import { DecouplingScatter } from "@/components/charts/decoupling-scatter";
import { PeopleWaffle } from "@/components/charts/people-waffle";
import { IntegrationDepthChart } from "@/components/charts/integration-depth-chart";
import { BureauDivergenceChart } from "@/components/charts/bureau-divergence-chart";
import { DivergenceTimeline } from "@/app/fedramp/coverage/sleeping-services/_sections/divergence-timeline";
import { getBureauDivergence, getIntegrationDepthAnalysis } from "@/lib/db";
import { ADOPTION_SERIES } from "@/lib/data/adoption-series";
import { formatNumber } from "@/lib/formatting";

const SNAPSHOT = "2026-06-12";
const ATTRIBUTION = `IFP analysis of the FedRAMP marketplace (snapshot ${SNAPSHOT}) and the 2025 Federal AI Use Case Inventory. Access shares are IFP web-corroborated assessments, not OMB data.`;

export interface FigureDef {
  title: string;
  /** Fixed frame width in px for pixel-stable captures. */
  width: number;
  /** Returns the mounted chart, or null when this DB build lacks the data. */
  render: () => { node: ReactNode; caption: string } | null;
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
    title: "Technology adoption: years since mandate or introduction",
    width: 1080,
    render: () => ({
      node: <AdoptionCurveChart series={ADOPTION_SERIES} exportMode />,
      caption:
        "Adoption re-based to years since each technology's own mandate (federal series) or introduction (organic series), first 12 years. Populations differ by series: federal HTTPS = live parent .gov domains (IFP-computed from GSA's archived weekly scans); PIV = federal civilian users (OMB FISMA reports); workplace PC = employed US adults (Census CPS); gray context = US households (Our World in Data). Vermilion: the federal LLM-access mandate arrived 2.6 years into the GenAI era. IFP analysis; external baselines verified 2026-07-06.",
    }),
  },
};

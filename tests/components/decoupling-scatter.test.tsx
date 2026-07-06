// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DecouplingScatter } from "@/components/charts/decoupling-scatter";
import type { DecouplingPoint } from "@/app/_view-models/frontier-access";

// The component calls useRouter for click-through; stub it so render works
// outside a Next App Router provider.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

const POINTS: DecouplingPoint[] = [
  {
    agency_id: 1,
    abbr: "GSA",
    name: "General Services Administration",
    reach: 42,
    share: 0.62,
    imputed: false,
    noAssessment: false,
    tier: "most",
    eligible: 12000,
    emphasized: false,
    labeled: true,
  },
  {
    agency_id: 2,
    abbr: "DOL",
    name: "Department of Labor",
    reach: 30,
    share: 0.05,
    imputed: false,
    noAssessment: false,
    tier: "pilot",
    eligible: 8000,
    emphasized: true,
    labeled: true,
  },
  {
    agency_id: 3,
    abbr: "USDA",
    name: "Department of Agriculture",
    reach: 18,
    share: 0.2,
    imputed: true,
    noAssessment: false,
    tier: "partial",
    eligible: 40000,
    emphasized: false,
    labeled: false,
  },
  {
    agency_id: 4,
    abbr: "DOI",
    name: "Department of the Interior",
    reach: 5,
    share: 0,
    imputed: true,
    noAssessment: true,
    tier: null,
    eligible: null,
    emphasized: false,
    labeled: false,
  },
  {
    agency_id: 5,
    abbr: "HUD",
    name: "Housing and Urban Development",
    reach: 25,
    share: 0.03,
    imputed: true,
    noAssessment: false,
    tier: "latent",
    eligible: 6000,
    emphasized: true,
    labeled: false,
  },
];

describe("DecouplingScatter", () => {
  it("renders without crashing and shows the encoding legend", () => {
    render(<DecouplingScatter points={POINTS} medianReach={25} />);
    expect(screen.getByText("corroborated share")).toBeTruthy();
    expect(screen.getByText("IFP tier-imputed (hollow)")).toBeTruthy();
    expect(screen.getByText("high reach, ≤10% access")).toBeTruthy();
  });

  it("omits the dropped-agencies footnote when droppedNoAbbr is 0", () => {
    render(<DecouplingScatter points={POINTS} medianReach={25} />);
    expect(screen.queryByText(/not plotted\./)).toBeNull();
  });

  it("renders the dropped-agencies footnote when droppedNoAbbr > 0", () => {
    render(
      <DecouplingScatter points={POINTS} medianReach={25} droppedNoAbbr={3} />,
    );
    expect(
      screen.getByText(
        "3 agencies without an inventory abbreviation not plotted.",
      ),
    ).toBeTruthy();
  });

  it("renders in exportMode without crashing", () => {
    render(
      <DecouplingScatter points={POINTS} medianReach={25} exportMode />,
    );
    expect(screen.getByText("corroborated share")).toBeTruthy();
  });
});

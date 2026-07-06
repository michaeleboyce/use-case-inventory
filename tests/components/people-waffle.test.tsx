// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PeopleWaffle } from "@/components/charts/people-waffle";
import type { WaffleModel, WaffleSquare } from "@/app/_view-models/frontier-access";

afterEach(cleanup);

function sq(
  state: WaffleSquare["state"],
  abbr: string,
  workers: number,
  imputed = false,
): WaffleSquare {
  return {
    state,
    dominant: { abbr, name: `${abbr} Department` },
    dominantWorkers: workers,
    imputed,
  };
}

// 3 access + 2 reach_only + 1 neither = 6 squares; one imputed.
const MODEL: WaffleModel = {
  unit: 25_000,
  squares: [
    sq("access", "VA", 60_000),
    sq("access", "USDA", 40_000),
    sq("access", "DOI", 20_000),
    sq("reach_only", "TREAS", 45_000, true),
    sq("reach_only", "DOC", 25_000),
    sq("neither", "SBA", 15_000),
  ],
  totals: { access: 120_000, reachOnly: 70_000, neither: 15_000, eligible: 205_000 },
  agencyCount: 6,
  imputedAgencyCount: 1,
};

describe("PeopleWaffle", () => {
  it("renders one square per model square", () => {
    render(<PeopleWaffle waffle={MODEL} />);
    // Every square carries an aria-label with the worker suffix.
    const squares = screen.getAllByLabelText(/workers$|share imputed from tier prior\)$/);
    expect(squares.length).toBe(MODEL.squares.length);
  });

  it("shows all three legend entries", () => {
    render(<PeopleWaffle waffle={MODEL} />);
    expect(
      screen.getAllByText("has a general-purpose AI tool (est.)").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("no tool — agency holds core-AI capability in reach")
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("no tool, no core-AI in reach").length,
    ).toBeGreaterThan(0);
  });

  it("shows the unit note with the formatted unit and counts", () => {
    render(<PeopleWaffle waffle={MODEL} />);
    expect(
      screen.getByText(/25,000 AI-eligible federal workers/),
    ).toBeTruthy();
    expect(
      screen.getByText(/shares for 1 agencies imputed from IFP tier priors/),
    ).toBeTruthy();
  });

  it("opens a popover on focus that names the dominant agency", () => {
    render(<PeopleWaffle waffle={MODEL} />);
    expect(screen.queryByRole("tooltip")).toBeNull();
    const square = screen.getByLabelText(/VA, ~60,000 workers/);
    fireEvent.focus(square);
    const tip = screen.getByRole("tooltip");
    expect(tip).toBeTruthy();
    expect(tip.textContent).toContain("VA Department");
    expect(tip.textContent).toContain("~60,000 workers in this state");
  });

  it("shows the imputed provenance line in the popover for an imputed square", () => {
    render(<PeopleWaffle waffle={MODEL} />);
    const square = screen.getByLabelText(/TREAS.*share imputed from tier prior/);
    fireEvent.focus(square);
    expect(
      screen.getByText("(share imputed from tier prior)"),
    ).toBeTruthy();
  });

  it("compact mode renders no popover and shows the cross-link", () => {
    render(
      <PeopleWaffle waffle={MODEL} compact crossLinkHref="/fedramp/coverage/agencies" />,
    );
    const square = screen.getByLabelText(/VA, ~60,000 workers/);
    fireEvent.focus(square);
    expect(screen.queryByRole("tooltip")).toBeNull();
    const link = screen.getByRole("link", {
      name: /Full breakdown: reach vs\. access/,
    });
    expect(link.getAttribute("href")).toBe("/fedramp/coverage/agencies");
  });

  it("exportMode renders no popover", () => {
    render(<PeopleWaffle waffle={MODEL} exportMode />);
    const square = screen.getByLabelText(/VA, ~60,000 workers/);
    fireEvent.focus(square);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

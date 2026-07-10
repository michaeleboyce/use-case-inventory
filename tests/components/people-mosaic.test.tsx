// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PeopleMosaic } from "@/components/charts/people-mosaic";
import type { MosaicModel } from "@/app/_view-models/frontier-access";

const MODEL: MosaicModel = {
  unit: 25_000,
  agencies: [
    {
      abbr: "VA",
      name: "Veterans Affairs",
      eligible: 50_000,
      share: 0.9,
      imputed: false,
      noAssessment: false,
      reach: 31,
      squares: { access: 2, reachOnly: 0, neither: 0 },
    },
    {
      abbr: "DHS",
      name: "Homeland Security",
      eligible: 50_000,
      share: 0.02,
      imputed: true,
      noAssessment: false,
      reach: 104,
      squares: { access: 0, reachOnly: 2, neither: 0 },
    },
  ],
  pooled: {
    agencyCount: 3,
    eligible: 30_000,
    squares: { access: 0, reachOnly: 1, neither: 0 },
  },
  floorPct: 37.5,
  centralPct: 38.3,
  bullishPct: 41.7,
};

afterEach(cleanup);

describe("PeopleMosaic", () => {
  it("renders one block per agency plus the pooled block", () => {
    const { container } = render(<PeopleMosaic mosaic={MODEL} />);
    expect(screen.getByText("VA")).toBeDefined();
    expect(screen.getByText("DHS")).toBeDefined();
    expect(screen.getByText("+3 others")).toBeDefined();
    // 2 + 2 + 1 squares in total.
    expect(container.querySelectorAll("[data-kind]").length).toBe(5);
  });

  it("states the floor/central/bullish range", () => {
    render(<PeopleMosaic mosaic={MODEL} />);
    expect(screen.getByText("37.5%")).toBeDefined();
    expect(screen.getByText("38.3%")).toBeDefined();
    expect(screen.getByText("41.7%")).toBeDefined();
  });

  it("marks imputed access squares hollow via data-imputed", () => {
    const withImputedAccess: MosaicModel = {
      ...MODEL,
      agencies: [
        {
          ...MODEL.agencies[1],
          squares: { access: 1, reachOnly: 1, neither: 0 },
        },
      ],
    };
    const { container } = render(<PeopleMosaic mosaic={withImputedAccess} />);
    expect(container.querySelectorAll("[data-imputed='1']").length).toBe(1);
  });

  it("shows the agency popover on focus with guardrail wording", () => {
    const { container } = render(<PeopleMosaic mosaic={MODEL} />);
    const vaBlock = container.querySelector("a[href='/fedramp/coverage/agencies/VA']")!
      .parentElement!;
    fireEvent.focus(vaBlock);
    expect(
      screen.getByText(/in scope of packages it holds an ATO for/),
    ).toBeDefined();
  });

  it("exportMode renders labels without links or popovers", () => {
    const { container } = render(<PeopleMosaic mosaic={MODEL} exportMode />);
    expect(container.querySelector("a")).toBeNull();
  });
});

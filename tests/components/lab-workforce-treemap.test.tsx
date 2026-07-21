// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { WorkforceTreemap } from "@/app/fedramp/coverage/lab/_sections/workforce-treemap";
import type { LabAgency } from "@/app/fedramp/coverage/lab/_view-model";

afterEach(cleanup);

const agency = (over: Partial<LabAgency> & Pick<LabAgency, "abbr">): LabAgency => ({
  name: over.abbr,
  eligible: null,
  share: 0,
  imputed: false,
  noAssessment: false,
  reach: 0,
  sleeping: 0,
  voids: 0,
  ...over,
});

const AGENCIES: LabAgency[] = [
  // large, corroborated, high access, core-AI in reach
  agency({ abbr: "VA", name: "Veterans Affairs", eligible: 500_000, share: 0.9, reach: 12, voids: 2 }),
  // large, imputed low share, still has reach
  agency({ abbr: "DHS", name: "Homeland Security", eligible: 300_000, share: 0.02, imputed: true, reach: 5 }),
  // small, no reach
  agency({ abbr: "NSF", name: "National Science Foundation", eligible: 40_000, share: 0.3, reach: 0 }),
  // no profile → excluded + footnoted
  agency({ abbr: "GHOST", name: "No Profile", eligible: null }),
];

describe("WorkforceTreemap", () => {
  it("renders one tile per agency with a positive eligible workforce", () => {
    const { container } = render(<WorkforceTreemap agencies={AGENCIES} />);
    const tiles = container.querySelectorAll("[data-tile]");
    expect(tiles.length).toBe(3);
  });

  it("orders tile areas by eligible headcount", () => {
    const { container } = render(<WorkforceTreemap agencies={AGENCIES} />);
    const areas = [...container.querySelectorAll("[data-tile]")].map((el) =>
      Number(el.getAttribute("data-area")),
    );
    const eligibles = [...container.querySelectorAll("[data-tile]")].map((el) =>
      Number(el.getAttribute("data-eligible")),
    );
    // DOM order follows the largest-first sort, and area tracks eligible.
    expect(eligibles).toEqual([500_000, 300_000, 40_000]);
    const sortedDesc = [...areas].sort((a, b) => b - a);
    expect(areas).toEqual(sortedDesc);
    expect(areas[0]).toBeGreaterThan(areas[2]);
  });

  it("footnotes the count of agencies without a workforce profile", () => {
    const { getByText } = render(<WorkforceTreemap agencies={AGENCIES} />);
    expect(getByText(/1 agency without a workforce profile omitted/)).toBeTruthy();
  });

  it("marks the hatch only on the imputed tile", () => {
    const { container } = render(<WorkforceTreemap agencies={AGENCIES} />);
    const imputed = container.querySelectorAll("[data-imputed]");
    expect(imputed.length).toBe(1);
    expect(imputed[0].getAttribute("data-tile")).toBe("DHS");
    // The hatch overlay itself lives only inside the imputed tile.
    expect(container.querySelectorAll("[data-hatch]").length).toBe(1);
  });

  it("shows the ATO guardrail phrase in the popover on focus", () => {
    const { container, getByRole } = render(
      <WorkforceTreemap agencies={AGENCIES} />,
    );
    const va = container.querySelector('[data-tile="VA"]') as HTMLElement;
    fireEvent.focus(va);
    const tip = getByRole("tooltip");
    expect(tip.textContent).toContain(
      "core-AI services in scope of packages it holds an ATO for",
    );
  });
});

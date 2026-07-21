// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GravityWell } from "@/app/fedramp/coverage/lab/_sections/gravity-well";
import type { LabAgency } from "@/app/fedramp/coverage/lab/_view-model";

afterEach(cleanup);

/** Build a full LabAgency, overriding only the fields a test cares about. */
function mk(over: Partial<LabAgency>): LabAgency {
  return {
    abbr: "USDA",
    name: "Department of Agriculture",
    eligible: 10000,
    share: 0.5,
    imputed: false,
    noAssessment: false,
    reach: 5,
    sleeping: 0,
    voids: 0,
    ...over,
  };
}

const AGENCIES: LabAgency[] = [
  // Full-access, corroborated — hugs the center, solid fill.
  mk({
    abbr: "STATE",
    name: "Department of State",
    share: 1,
    imputed: false,
    noAssessment: false,
    eligible: 30000,
    reach: 9,
  }),
  // Tier-imputed — hollow fill.
  mk({
    abbr: "DOI",
    name: "Department of the Interior",
    share: 0.4,
    imputed: true,
    noAssessment: false,
    eligible: 20000,
    reach: 7,
  }),
  // No assessment — extra-dimmed.
  mk({
    abbr: "SBA",
    name: "Small Business Administration",
    share: 0.2,
    imputed: true,
    noAssessment: true,
    eligible: 4000,
    reach: 2,
  }),
  // Dormant capability — has voids, so it wears a vermilion halo.
  mk({
    abbr: "DOL",
    name: "Department of Labor",
    share: 0.6,
    imputed: false,
    noAssessment: false,
    eligible: 15000,
    reach: 6,
    sleeping: 8,
    voids: 6,
  }),
  // Eligible null — smallest body, no direct label.
  mk({
    abbr: "NULLCO",
    name: "Nullary Bureau",
    share: 0.3,
    imputed: false,
    noAssessment: false,
    eligible: null,
    reach: 1,
  }),
];

describe("GravityWell", () => {
  it("renders one body per agency (queried by data-agency)", () => {
    const { container } = render(<GravityWell agencies={AGENCIES} />);
    const bodies = container.querySelectorAll("circle[data-agency]");
    expect(bodies.length).toBe(AGENCIES.length);
  });

  it("distinguishes hollow (imputed) from solid (corroborated) bodies", () => {
    const { container } = render(<GravityWell agencies={AGENCIES} />);
    const solid = container.querySelector('circle[data-agency="STATE"]');
    const hollow = container.querySelector('circle[data-agency="DOI"]');
    expect(solid?.getAttribute("data-imputed")).toBe("false");
    expect(solid?.getAttribute("fill")).toBe("var(--foreground)");
    expect(hollow?.getAttribute("data-imputed")).toBe("true");
    expect(hollow?.getAttribute("fill")).toBe("var(--background)");
  });

  it("draws a vermilion halo only for the agency with voids > 0", () => {
    const { container } = render(<GravityWell agencies={AGENCIES} />);
    const halos = container.querySelectorAll("circle[data-halo]");
    expect(halos.length).toBe(1);
    expect(halos[0].getAttribute("data-halo")).toBe("6");
    expect(halos[0].getAttribute("stroke")).toBe("var(--stamp)");
  });

  it("shows a popover naming the agency on focus", () => {
    const { container } = render(<GravityWell agencies={AGENCIES} />);
    const body = container.querySelector('circle[data-agency="DOL"]');
    expect(body).not.toBeNull();
    fireEvent.focus(body as Element);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeTruthy();
    expect(tooltip.textContent).toContain("Department of Labor");
    expect(tooltip.textContent).toContain(
      "core-AI services in scope of packages it holds an ATO for",
    );
  });

  it("renders the provenance wording for each assessment state", () => {
    const { container } = render(<GravityWell agencies={AGENCIES} />);
    // No-assessment agency reports "no assessment found".
    fireEvent.focus(
      container.querySelector('circle[data-agency="SBA"]') as Element,
    );
    expect(screen.getByRole("tooltip").textContent).toContain(
      "no assessment found",
    );
  });

  it("renders the legend text", () => {
    render(<GravityWell agencies={AGENCIES} />);
    expect(screen.getByText(/solid = corroborated/)).toBeTruthy();
    expect(screen.getByText(/hollow = tier-imputed/)).toBeTruthy();
    expect(
      screen.getByText(/vermilion ring = unused peer-proven capability/),
    ).toBeTruthy();
    expect(
      screen.getByText(/distance from center = share of staff WITHOUT a tool/),
    ).toBeTruthy();
  });
});

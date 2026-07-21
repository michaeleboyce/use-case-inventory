// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PeerProofArcs } from "@/app/fedramp/coverage/lab/_sections/peer-proof-arcs";
import type { LabAgency, LabPair } from "@/app/fedramp/coverage/lab/_view-model";

afterEach(cleanup);

/**
 * Fixture per the brief: A leads 2 products; B sleeps both (one a void);
 * C leads + sleeps; D only sleeps.
 *
 *   Alpha — leads [A], sleepers [B, C, D], voids [B]
 *   Beta  — leads [A, C], sleepers [B, D], voids []
 *
 * Which yields five aggregated arcs, exactly one of them a void (A→B on Alpha).
 */
const PAIRS: LabPair[] = [
  {
    product: "Alpha",
    gen_ai: true,
    leads: ["A"],
    sleepers: ["B", "C", "D"],
    voids: ["B"],
  },
  {
    product: "Beta",
    gen_ai: false,
    leads: ["A", "C"],
    sleepers: ["B", "D"],
    voids: [],
  },
];

function mkAgency(abbr: string, name: string): LabAgency {
  return {
    abbr,
    name,
    eligible: null,
    share: 0,
    imputed: false,
    noAssessment: false,
    reach: 0,
    sleeping: 0,
    voids: 0,
  };
}

const AGENCIES: LabAgency[] = [
  mkAgency("A", "Agency Alpha"),
  mkAgency("B", "Agency Bravo"),
  mkAgency("C", "Agency Charlie"),
  mkAgency("D", "Agency Delta"),
];

describe("PeerProofArcs", () => {
  it("renders", () => {
    const { container } = render(
      <PeerProofArcs agencies={AGENCIES} pairs={PAIRS} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("draws one node per agency appearing as lead or sleeper", () => {
    const { container } = render(
      <PeerProofArcs agencies={AGENCIES} pairs={PAIRS} />,
    );
    const nodes = container.querySelectorAll("[data-agency]");
    expect(nodes.length).toBe(4);
  });

  it("draws arc paths carrying a void flag, with exactly one void arc", () => {
    const { container } = render(
      <PeerProofArcs agencies={AGENCIES} pairs={PAIRS} />,
    );
    const arcs = container.querySelectorAll("path[data-arc]");
    expect(arcs.length).toBeGreaterThanOrEqual(1);
    const voidArcs = Array.from(arcs).filter(
      (a) => a.getAttribute("data-void") === "true",
    );
    expect(voidArcs.length).toBe(1);
    // The void arc is the A→B link and is stamp-colored.
    const voidArc = voidArcs[0];
    expect(voidArc.getAttribute("data-arc")).toBe("A|B");
    expect(voidArc.getAttribute("stroke")).toBe("var(--stamp)");
  });

  it("shows a popover naming an agency and its proven-products count on focus", () => {
    const { container } = render(
      <PeerProofArcs agencies={AGENCIES} pairs={PAIRS} />,
    );
    const nodeA = container.querySelector('[data-agency="A"]');
    expect(nodeA).not.toBeNull();
    fireEvent.focus(nodeA as Element);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeTruthy();
    // Names the agency (abbr + full name) and reports "2 products proven".
    expect(tooltip.textContent).toContain("A");
    expect(tooltip.textContent).toContain("Agency Alpha");
    expect(tooltip.textContent).toContain("2");
    expect(tooltip.textContent).toMatch(/products\s+proven/);
  });

  it("fills sleep-only agencies with the stamp color and leaders with foreground", () => {
    const { container } = render(
      <PeerProofArcs agencies={AGENCIES} pairs={PAIRS} />,
    );
    const rectFill = (abbr: string) =>
      container
        .querySelector(`[data-agency="${abbr}"] rect`)
        ?.getAttribute("fill");
    // A leads → foreground; D only sleeps → stamp.
    expect(rectFill("A")).toBe("var(--foreground)");
    expect(rectFill("D")).toBe("var(--stamp)");
  });
});

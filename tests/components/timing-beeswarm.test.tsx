// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TimingBeeswarm } from "@/app/fedramp/coverage/sleeping-services/_sections/timing-beeswarm";
import type { SleepingPair } from "@/app/fedramp/coverage/sleeping-services/_shared";

afterEach(cleanup);

/** Build a full SleepingPair, overriding only the fields a test cares about. */
function mk(over: Partial<SleepingPair>): SleepingPair {
  return {
    product: "Acme LLM",
    services: "Acme LLM API",
    capability_category: "genai_platform",
    gen_ai: 1,
    confidence: "strong",
    evidence_tier: "named_offering",
    agency_id: 1,
    agency_abbr: "USDA",
    agency_name: "Department of Agriculture",
    role: "sleeping",
    has_reach: 1,
    first_ato_date: "2023-05-01",
    recency_last90: 0,
    similar_deployed: 0,
    similar_products: null,
    host_packages: "Some Host",
    timing_bucket: "2023_24",
    timing_excluded: false,
    ...over,
  };
}

const PAIRS: SleepingPair[] = [
  // 1 similar-deployed pair, dated 2022 — the earliest, so it sorts first.
  mk({
    product: "Acme LLM",
    agency_abbr: "USDA",
    first_ato_date: "2022-03-01",
    similar_deployed: 1,
    timing_bucket: "2022_or_earlier",
  }),
  // 2 capability voids, dated 2023 / 2024.
  mk({
    product: "Void One",
    agency_abbr: "DOI",
    first_ato_date: "2023-06-01",
    similar_deployed: 0,
    timing_bucket: "2023_24",
  }),
  mk({
    product: "Void Two",
    agency_abbr: "DOL",
    first_ato_date: "2024-09-01",
    similar_deployed: 0,
    timing_bucket: "2023_24",
  }),
  // 1 timing-excluded (post-cutoff) pair — dated, so it is still drawn.
  mk({
    product: "Late Arrival",
    agency_abbr: "GSA",
    first_ato_date: "2026-03-01",
    timing_excluded: true,
    timing_bucket: "post_cutoff",
  }),
  // 1 undated sleeping pair — no usable ATO date, so it is NOT drawn.
  mk({
    product: "No Date Co",
    agency_abbr: "VA",
    first_ato_date: null,
    timing_bucket: "unknown",
  }),
  // 1 lead row — must be filtered out entirely (never drawn or counted).
  mk({
    product: "LeadOnly Corp",
    agency_abbr: "DOD",
    role: "lead",
    first_ato_date: "2023-01-01",
  }),
];

describe("TimingBeeswarm", () => {
  it("draws one dot per dated sleeping pair (leads and undated excluded)", () => {
    const { container } = render(<TimingBeeswarm pairs={PAIRS} />);
    // 4 dated sleeping = 2 voids + 1 similar + 1 excluded. The lead row (also
    // dated) proves filtering, and the undated sleeping row proves the date gate.
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(4);
  });

  it("colors dots by state via data-state", () => {
    const { container } = render(<TimingBeeswarm pairs={PAIRS} />);
    const states = Array.from(container.querySelectorAll("circle")).map((c) =>
      c.getAttribute("data-state"),
    );
    expect(states.filter((s) => s === "void").length).toBe(2);
    expect(states.filter((s) => s === "similar").length).toBe(1);
    expect(states.filter((s) => s === "excluded").length).toBe(1);
    // At least one dot is a stamp-filled capability void.
    const voidCircle = container.querySelector('circle[data-state="void"]');
    expect(voidCircle?.getAttribute("fill")).toBe("var(--stamp)");
  });

  it("footnotes the undated pairs not drawn", () => {
    render(<TimingBeeswarm pairs={PAIRS} />);
    expect(
      screen.getByText(/1 sleeping pairs with no usable ATO date not drawn/),
    ).toBeTruthy();
  });

  it("shows a popover naming agency × product on focus", () => {
    const { container } = render(<TimingBeeswarm pairs={PAIRS} />);
    // Anchors render in date order; the first is the 2022 USDA × Acme LLM pair.
    const firstAnchor = container.querySelector("a");
    expect(firstAnchor).not.toBeNull();
    fireEvent.focus(firstAnchor as Element);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeTruthy();
    expect(screen.getByText("USDA × Acme LLM")).toBeTruthy();
    // The state line lives inside the tooltip ("similar capability deployed"
    // also appears in the legend, so scope the check to the tooltip).
    expect(tooltip.textContent).toContain("similar capability deployed");
  });

  it("filters out lead rows entirely", () => {
    const { container } = render(<TimingBeeswarm pairs={PAIRS} />);
    // The lead product should never appear in any anchor href.
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs.some((h) => h?.includes("leadonly"))).toBe(false);
  });
});

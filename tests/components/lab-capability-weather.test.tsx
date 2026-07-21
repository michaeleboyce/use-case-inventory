// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilityWeather } from "@/app/fedramp/coverage/lab/_sections/capability-weather";
import type { LabEvent } from "@/app/fedramp/coverage/lab/_view-model";

afterEach(cleanup);

// 3 ATOs (two land in 2013-05, one in 2020-01) + 2 rollouts (2024-11 dated,
// and a bare-year "2025" that must bucket to Jan 2025).
const EVENTS: LabEvent[] = [
  { date: "2013-05-10", kind: "ato", abbr: "AAA" },
  { date: "2013-05-20", kind: "ato", abbr: "BBB" },
  { date: "2020-01-02", kind: "ato", abbr: "CCC" },
  { date: "2024-11-05", kind: "rollout", abbr: "DDD" },
  { date: "2025", kind: "rollout", abbr: "EEE" },
];

function cell(
  container: HTMLElement,
  strip: "ato" | "rollout",
  year: number,
  month: number,
): HTMLElement {
  const el = container.querySelector<HTMLElement>(
    `[data-strip="${strip}"][data-year="${year}"][data-month="${month}"]`,
  );
  if (!el) throw new Error(`no ${strip} cell for ${year}-${month}`);
  return el;
}

describe("CapabilityWeather", () => {
  it("renders two grids, one per strip", () => {
    const { container } = render(<CapabilityWeather events={EVENTS} />);
    expect(container.querySelector('[role="grid"][data-strip="ato"]')).toBeTruthy();
    expect(
      container.querySelector('[role="grid"][data-strip="rollout"]'),
    ).toBeTruthy();
  });

  it("buckets the busy 2013-05 ATO cell hotter than the lone 2020-01 cell", () => {
    const { container } = render(<CapabilityWeather events={EVENTS} />);
    const busy = cell(container, "ato", 2013, 5); // 2 events
    const lone = cell(container, "ato", 2020, 1); // 1 event
    expect(busy.getAttribute("data-count")).toBe("2");
    expect(lone.getAttribute("data-count")).toBe("1");
    expect(Number(busy.getAttribute("data-bucket"))).toBeGreaterThan(
      Number(lone.getAttribute("data-bucket")),
    );
  });

  it("lands the bare-year \"2025\" rollout in the January 2025 cell", () => {
    const { container } = render(<CapabilityWeather events={EVENTS} />);
    expect(cell(container, "rollout", 2025, 1).getAttribute("data-count")).toBe("1");
    // and not smeared into any other month of 2025
    expect(cell(container, "rollout", 2025, 6).getAttribute("data-count")).toBe("0");
  });

  it("reports the ~11-year capability→access gap in the summary line", () => {
    render(<CapabilityWeather events={EVENTS} />);
    const summary = screen.getByText(/first capability cell/i);
    expect(summary.textContent).toMatch(/May 2013/);
    expect(summary.textContent).toMatch(/November 2024/);
    expect(summary.textContent).toMatch(/gap: 11 years/);
  });

  it("shows the ChatGPT narrative annotation", () => {
    render(<CapabilityWeather events={EVENTS} />);
    expect(screen.getByText("ChatGPT")).toBeTruthy();
  });
});

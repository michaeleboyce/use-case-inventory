// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GenAiTimelineChart } from "@/components/experience/genai-timeline-chart";
import type { GenAiTimelinePoint } from "@/lib/experience-shared";

afterEach(cleanup);

const POINTS: GenAiTimelinePoint[] = [
  {
    year: "2020",
    counts: { omb: 1, ifp_genai: 3, ifp_llm_access: 2, ifp_enterprise: 0 },
    declared: { omb: 1, ifp_genai: 1, ifp_llm_access: 1, ifp_enterprise: 0 },
  },
  {
    year: "2025",
    counts: { omb: 40, ifp_genai: 49, ifp_llm_access: 30, ifp_enterprise: 10 },
    declared: { omb: 40, ifp_genai: 47, ifp_llm_access: 28, ifp_enterprise: 9 },
  },
  {
    year: "unknown",
    counts: { omb: 5, ifp_genai: 8, ifp_llm_access: 6, ifp_enterprise: 1 },
    declared: { omb: 5, ifp_genai: 4, ifp_llm_access: 3, ifp_enterprise: 1 },
  },
];

describe("GenAiTimelineChart provenance toggle", () => {
  it("defaults to the Total view with no provenance legend", () => {
    render(<GenAiTimelineChart data={POINTS} />);
    expect(
      screen.queryByText("Agency-declared GenAI/Agentic"),
    ).toBeNull();
    // Parseable-year total under the default ifp_genai definition: 3 + 49.
    expect(screen.getByText(/52\s*use cases have a parseable year/)).toBeTruthy();
  });

  it("shows the provenance legend and split caption when toggled", () => {
    render(<GenAiTimelineChart data={POINTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Tag provenance" }));
    expect(screen.getByText("Agency-declared GenAI/Agentic")).toBeTruthy();
    expect(
      screen.getByText("IFP tag beyond agency declaration"),
    ).toBeTruthy();
    expect(
      screen.getByText(/did NOT file as Generative\/Agentic AI/),
    ).toBeTruthy();
  });

  it("disables the provenance view for the OMB definition", () => {
    render(<GenAiTimelineChart data={POINTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Tag provenance" }));
    // Switch definition to OMB — provenance is declared-by-construction.
    fireEvent.click(screen.getByRole("button", { name: "OMB" }));
    const provBtn = screen.getByRole("button", { name: "Tag provenance" });
    expect((provBtn as HTMLButtonElement).disabled).toBe(true);
    // Legend collapses back to the total view.
    expect(screen.queryByText("Agency-declared GenAI/Agentic")).toBeNull();
  });
});

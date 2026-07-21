import { describe, it, expect } from "vitest";
import { ADOPTION_SERIES, getAdoptionSeries } from "@/lib/data/adoption-series";
import {
  introEvent,
  mandateEvent,
  mandateXOnTechClock,
} from "@/components/charts/adoption-curve-chart";
import type { AdoptionSeries } from "@/lib/types/adoption";

/**
 * The tech-clock derivations behind the adoption chart's apples-to-apples
 * view: every series bases at its technology's arrival, and each federal
 * mandate lands at the documented year of that clock (the figure caption
 * cites these numbers — a drift here silently falsifies published copy).
 */
describe("adoption chart clock derivations", () => {
  const https = getAdoptionSeries("https-enforces")!;
  const piv = getAdoptionSeries("piv-login")!;

  it("bases legacy federal series at the technology introduction", () => {
    expect(introEvent(https).date).toBe("1994-10-15");
    expect(introEvent(piv).date).toBe("1995-06-30");
  });

  it("derives the mandate from `start` on legacy federal series", () => {
    expect(mandateEvent(https)?.date).toBe("2015-06-08");
    expect(mandateXOnTechClock(https)!).toBeCloseTo(20.6, 1);
    expect(mandateXOnTechClock(piv)!).toBeCloseTo(9.2, 1);
  });

  it("prefers an explicit `mandate` (the LLM-pair shape) over `start`", () => {
    const llmShaped: AdoptionSeries = {
      id: "llm-test",
      label: "t",
      population: "t",
      metric: "t",
      unit: "percent",
      start: { date: "2022-11-30", label: "ChatGPT released" },
      introduced: { date: "2022-11-30", label: "ChatGPT public release" },
      mandate: { date: "2025-07-23", label: "AI Action Plan" },
      driver: "federal mandate",
      source: { title: "t", url: "https://x", accessed: "2026-01-01" },
      points: [],
    };
    expect(introEvent(llmShaped).date).toBe("2022-11-30");
    expect(mandateEvent(llmShaped)?.date).toBe("2025-07-23");
    expect(mandateXOnTechClock(llmShaped)!).toBeCloseTo(2.6, 1);
  });

  it("gives organic series no mandate marker", () => {
    for (const s of ADOPTION_SERIES.filter((x) => x.driver === "organic")) {
      expect(mandateEvent(s)).toBeNull();
      expect(mandateXOnTechClock(s)).toBeNull();
    }
  });
});

import { describe, it, expect } from "vitest";
import { ADOPTION_SERIES } from "@/lib/data/adoption-series";

/**
 * Data-integrity gate for the checked-in adoption baselines: every series
 * must carry full provenance (source URL + accessed date + population +
 * metric), chronologically ordered points, and values consistent with its
 * unit. These are the fields the chart's honesty depends on — a series that
 * loses its population label or dates silently breaks the page's framing.
 */
describe("lib/data/adoption-series", () => {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  it("has at least the five core baseline series", () => {
    const ids = ADOPTION_SERIES.map((s) => s.id);
    for (const required of [
      "https-enforces",
      "https-supports",
      "workplace-pc",
      "piv-login",
      "fedramp-authorizations",
    ]) {
      expect(ids).toContain(required);
    }
  });

  it.each(ADOPTION_SERIES.map((s) => [s.id, s] as const))(
    "%s carries full provenance",
    (_id, s) => {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.population.length).toBeGreaterThan(0);
      expect(s.metric.length).toBeGreaterThan(0);
      expect(s.source.url).toMatch(/^https?:\/\//);
      expect(s.source.title.length).toBeGreaterThan(0);
      expect(s.source.accessed).toMatch(DATE_RE);
      expect(s.start.date).toMatch(DATE_RE);
      expect(s.start.label.length).toBeGreaterThan(0);
      expect(["federal mandate", "organic"]).toContain(s.driver);
    },
  );

  it.each(ADOPTION_SERIES.map((s) => [s.id, s] as const))(
    "%s points are valid, chronological, and start at/after the clock",
    (_id, s) => {
      expect(s.points.length).toBeGreaterThanOrEqual(2);
      const t0 = Date.parse(s.start.date);
      let prev = -Infinity;
      for (const p of s.points) {
        expect(p.date).toMatch(DATE_RE);
        const t = Date.parse(p.date);
        expect(t).toBeGreaterThan(prev);
        expect(t).toBeGreaterThanOrEqual(t0);
        prev = t;
        if (s.unit === "percent") {
          expect(p.value).toBeGreaterThanOrEqual(0);
          expect(p.value).toBeLessThanOrEqual(100);
        } else {
          expect(p.value).toBeGreaterThan(0);
        }
      }
    },
  );

  it("keeps the two HTTPS metrics on identical dates (same underlying scans)", () => {
    const dates = (id: string) =>
      ADOPTION_SERIES.find((s) => s.id === id)!.points.map((p) => p.date);
    expect(dates("https-supports")).toEqual(dates("https-enforces"));
  });
});

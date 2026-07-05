import { describe, expect, it } from "vitest";
import { formatMla, hostnameOf, mlaDate } from "@/lib/citation";

describe("mlaDate", () => {
  it("formats full ISO dates", () => {
    expect(mlaDate("2025-12-17")).toBe("17 Dec. 2025");
  });
  it("formats year-month", () => {
    expect(mlaDate("2026-05")).toBe("May 2026");
  });
  it("formats bare years", () => {
    expect(mlaDate("2026")).toBe("2026");
  });
  it("passes free-text dates through", () => {
    expect(mlaDate("Spring 2025")).toBe("Spring 2025");
  });
  it("returns null for empty input", () => {
    expect(mlaDate(null)).toBeNull();
    expect(mlaDate("")).toBeNull();
  });
});

describe("hostnameOf", () => {
  it("strips protocol and www", () => {
    expect(hostnameOf("https://www.usda.gov/a/b.pdf")).toBe("usda.gov");
  });
  it("returns null on garbage", () => {
    expect(hostnameOf("not a url")).toBeNull();
  });
});

describe("formatMla", () => {
  it("builds a full citation", () => {
    expect(
      formatMla({
        url: "https://www.fedscoop.com/gsa-ai-rollout/",
        title: "GSA rolls out AI chatbot",
        date: "2025-03-10",
        accessed: "2026-07-01",
      }),
    ).toBe(
      '"GSA rolls out AI chatbot." fedscoop.com, 10 Mar. 2025, www.fedscoop.com/gsa-ai-rollout/. Accessed 1 July 2026.',
    );
  });
  it("omits missing parts and falls back to hostname container", () => {
    expect(
      formatMla({ url: "https://data.opm.gov/x", accessed: "2026-07-01" }),
    ).toBe("data.opm.gov, data.opm.gov/x. Accessed 1 July 2026.");
  });
  it("does not double the title's terminal punctuation", () => {
    expect(
      formatMla({ url: "https://a.gov/r", title: "What is FedRAMP?" }),
    ).toBe('"What is FedRAMP?" a.gov, a.gov/r.');
  });
});

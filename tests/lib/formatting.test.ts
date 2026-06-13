import { describe, expect, it } from "vitest";
import { collapseWhitespace, titleCase } from "@/lib/formatting";
import { chipClasses } from "@/lib/chip-styles";
import { vendorColor } from "@/lib/color-schemes";

describe("titleCase", () => {
  it("title-cases snake_case and whitespace-separated strings", () => {
    expect(titleCase("general_llm")).toBe("General Llm");
    expect(titleCase("agentic")).toBe("Agentic");
    expect(titleCase("two words here")).toBe("Two Words Here");
  });
  it("is null-safe", () => {
    expect(titleCase(null)).toBe("");
    expect(titleCase(undefined)).toBe("");
    expect(titleCase("")).toBe("");
  });
});

describe("collapseWhitespace", () => {
  it("collapses runs of whitespace and trims", () => {
    expect(collapseWhitespace("  a\n\n b   c ")).toBe("a b c");
    expect(collapseWhitespace("single")).toBe("single");
  });
  it("is null-safe", () => {
    expect(collapseWhitespace(null)).toBe("");
    expect(collapseWhitespace(undefined)).toBe("");
  });
});

describe("chipClasses", () => {
  it("composes base + size + tone fragments", () => {
    const cls = chipClasses("stamp", "xs");
    expect(cls).toContain("inline-flex");
    expect(cls).toContain("text-[10px]"); // xs sizing
    expect(cls).toContain("var(--stamp)"); // stamp tone
  });
  it("defaults to ink / sm", () => {
    const cls = chipClasses();
    expect(cls).toContain("text-[11px]"); // sm sizing
  });
});

describe("vendorColor", () => {
  it("returns exact palette hits", () => {
    expect(vendorColor("Microsoft")).toBe("#2563eb");
    expect(vendorColor("Anthropic")).toBe("#f59e0b");
  });
  it("applies name-variant heuristics", () => {
    expect(vendorColor("Azure OpenAI")).toBe("#2563eb"); // microsoft/azure
    expect(vendorColor("Claude 3.5")).toBe("#f59e0b"); // anthropic
    expect(vendorColor("Google Gemini")).toBe("#ef4444");
  });
  it("falls back to slate for unknown vendors", () => {
    expect(vendorColor("Wholly Unknown Vendor")).toBe("#64748b");
  });
});

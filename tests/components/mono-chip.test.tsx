// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MonoChip } from "@/components/editorial";

afterEach(cleanup);

describe("MonoChip", () => {
  it("renders a span (no href) with the shared chip base classes", () => {
    render(<MonoChip tone="stamp">OMB</MonoChip>);
    const el = screen.getByText("OMB");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toContain("inline-flex");
    expect(el.className).toContain("var(--stamp)"); // stamp tone fragment
  });

  it("renders a link when href is provided", () => {
    render(
      <MonoChip href="/use-cases" tone="ink">
        IFP
      </MonoChip>,
    );
    const link = screen.getByRole("link", { name: "IFP" });
    expect(link).toHaveProperty("href");
    expect(link.getAttribute("href")).toBe("/use-cases");
  });

  it("applies the size fragment", () => {
    render(<MonoChip size="xs">X</MonoChip>);
    expect(screen.getByText("X").className).toContain("text-[10px]");
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FrontierGrid } from "@/app/fedramp/coverage/sleeping-services/_sections/frontier-grid";
import type {
  GridColumn,
  GridRow,
} from "@/app/fedramp/coverage/sleeping-services/_shared";

afterEach(cleanup);

// 3 cols × 3 rows, void mass concentrated toward the last row/col so seriation
// MUST permute both axes. Weights (void→2, similar→1, else→0):
//   AAA: [0, 0, 2]   BBB: [0, 2, 1]   CCC: [2, 1, 0]
// Hand-computed seriation: rowOrder [1,2,0] (BBB,CCC,AAA), colOrder [1,0,2]
// (Beta, Alpha, Gamma).
const COLUMNS: GridColumn[] = [
  { product: "Alpha", slug: "alpha", lead_count: 1, reach_count: 3 },
  { product: "Beta", slug: "beta", lead_count: 1, reach_count: 3 },
  { product: "Gamma", slug: "gamma", lead_count: 1, reach_count: 3 },
];

const ROWS: GridRow[] = [
  {
    agency_id: 1,
    agency_abbr: "AAA",
    agency_name: "Agency A",
    cells: [
      { state: "no_reach", detail: null },
      { state: "no_reach", detail: null },
      { state: "sleeping_void", detail: null },
    ],
    sleeping_count: 1,
    void_count: 1,
  },
  {
    agency_id: 2,
    agency_abbr: "BBB",
    agency_name: "Agency B",
    cells: [
      { state: "no_reach", detail: null },
      { state: "sleeping_void", detail: null },
      { state: "sleeping_similar", detail: null },
    ],
    sleeping_count: 2,
    void_count: 1,
  },
  {
    agency_id: 3,
    agency_abbr: "CCC",
    agency_name: "Agency C",
    cells: [
      { state: "sleeping_void", detail: null },
      { state: "sleeping_similar", detail: null },
      { state: "lead", detail: null },
    ],
    sleeping_count: 2,
    void_count: 1,
  },
];

/** Column-header text in render order (skip the Agency / Gap sentinels). */
function headerText(): string {
  return screen.getAllByRole("row")[0].textContent ?? "";
}

/** Body-row agency abbreviations in render order. */
function rowAbbrs(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => ["AAA", "BBB", "CCC"].find((a) => r.textContent?.includes(a)) ?? "");
}

describe("FrontierGrid ordering toggle", () => {
  it("defaults to the seriated (By gap block) view — not props order", () => {
    render(<FrontierGrid columns={COLUMNS} rows={ROWS} leadsByProduct={{}} />);
    expect(
      (screen.getByRole("button", { name: "By gap block" }) as HTMLButtonElement)
        .getAttribute("aria-pressed"),
    ).toBe("true");
    // Seriation swaps Beta ahead of Alpha and reorders the rows.
    const h = headerText();
    expect(h.indexOf("Beta")).toBeLessThan(h.indexOf("Alpha"));
    expect(rowAbbrs()).toEqual(["BBB", "CCC", "AAA"]);
  });

  it("restores exact props order under By severity (the regression guard)", () => {
    render(<FrontierGrid columns={COLUMNS} rows={ROWS} leadsByProduct={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "By severity" }));

    const h = headerText();
    expect(h.indexOf("Alpha")).toBeLessThan(h.indexOf("Beta"));
    expect(h.indexOf("Beta")).toBeLessThan(h.indexOf("Gamma"));
    expect(rowAbbrs()).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("toggles back to the seriated view", () => {
    render(<FrontierGrid columns={COLUMNS} rows={ROWS} leadsByProduct={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "By severity" }));
    fireEvent.click(screen.getByRole("button", { name: "By gap block" }));

    const h = headerText();
    expect(h.indexOf("Beta")).toBeLessThan(h.indexOf("Alpha"));
    expect(rowAbbrs()).toEqual(["BBB", "CCC", "AAA"]);
  });
});

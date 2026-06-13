// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExpandableTable } from "@/components/expandable-table";

afterEach(cleanup);

type Row = { id: string; name: string; n: number };

const ROWS: Row[] = [
  { id: "a", name: "Alpha", n: 3 },
  { id: "b", name: "Bravo", n: 1 },
  { id: "c", name: "Charlie", n: 2 },
];

const COLUMNS = [
  { accessorKey: "name", header: "Name", enableSorting: false },
  { accessorKey: "n", header: "N", enableSorting: true },
] as ColumnDef<Row, unknown>[];

function renderTable(extra: Record<string, unknown> = {}) {
  return render(
    <ExpandableTable
      rows={ROWS}
      columns={COLUMNS}
      getRowKey={(r) => r.id}
      renderExpanded={(r) => <div>detail for {r.name}</div>}
      {...extra}
    />,
  );
}

describe("ExpandableTable", () => {
  it("renders one expandable row per datum, collapsed by default", () => {
    renderTable();
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Bravo")).toBeTruthy();
    // Expanded content not present until toggled.
    expect(screen.queryByText("detail for Alpha")).toBeNull();
  });

  it("reveals the expanded body when a row is clicked, and hides it again", () => {
    renderTable();
    const row = screen.getByText("Alpha").closest("tr")!;
    fireEvent.click(row);
    expect(screen.getByText("detail for Alpha")).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByText("detail for Alpha")).toBeNull();
  });

  it("renders a search input and filters rows when searchable", () => {
    renderTable({
      searchable: {
        placeholder: "Filter…",
        matches: (r: Row, q: string) => r.name.toLowerCase().includes(q),
      },
    });
    const input = screen.getByPlaceholderText("Filter…");
    fireEvent.change(input, { target: { value: "brav" } });
    expect(screen.getByText("Bravo")).toBeTruthy();
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("shows the empty message when there are no rows", () => {
    render(
      <ExpandableTable
        rows={[]}
        columns={COLUMNS}
        getRowKey={(r: Row) => r.id}
        renderExpanded={() => null}
        emptyMessage="Nothing here."
      />,
    );
    expect(screen.getByText("Nothing here.")).toBeTruthy();
  });
});

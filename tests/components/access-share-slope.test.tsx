// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AccessShareSlope } from "@/components/charts/access-share-slope";
import type { AccessTrajectoriesModel } from "@/app/_view-models/access-trajectories";

afterEach(cleanup);

const T = (d: string) => Date.parse(d);

const MODEL: AccessTrajectoriesModel = {
  trajectories: [
    {
      abbr: "GSA",
      name: "General Services Administration",
      anchors: [
        {
          date: "2025-03-20",
          t: T("2025-03-20"),
          share: 0.14,
          tool: "GSAi (stage)",
          sourceTitle: "FedScoop",
        },
        {
          date: "2025-07-31",
          t: T("2025-07-31"),
          share: 0.61,
          tool: "GSAi",
          sourceTitle: "FedScoop",
        },
      ],
      first: 0.14,
      best: 0.61,
      delta: 0.47,
      emphasized: true,
      single: false,
    },
    {
      abbr: "EPA",
      name: "Environmental Protection Agency",
      anchors: [
        {
          date: "2025-10-15",
          t: T("2025-10-15"),
          share: 0.1,
          tool: "govchat",
          sourceTitle: null,
        },
      ],
      first: 0.1,
      best: 0.1,
      delta: 0,
      emphasized: false,
      single: true,
    },
  ],
  mandateT: T("2025-07-23"),
  climberCount: 1,
  singleAnchorCount: 1,
};

describe("AccessShareSlope", () => {
  it("draws only multi-anchor agencies and legends them by color", () => {
    const { container } = render(
      <AccessShareSlope model={MODEL} exportMode />,
    );
    const text = container.textContent ?? "";
    // GSA (2 anchors) is drawn and legended; EPA (single anchor) is not.
    expect(text).toContain("GSA");
    expect(text).not.toContain("EPA");
  });

  it("discloses the omitted single-anchor agencies", () => {
    render(<AccessShareSlope model={MODEL} exportMode />);
    expect(
      screen.getByText(/1 agencies with only one dated finding are not/),
    ).toBeTruthy();
  });
});

import { describe, expect, it } from "vitest";
import {
  DEPLOYED_STAGES_2024,
  LIVE_DEV_STAGES_2024,
  PILOT_STAGES_2024,
  PRE_DEPLOYMENT_STAGES_2024,
  liveStageRank,
  stageBucket,
} from "@/lib/stage-buckets";

describe("stageBucket", () => {
  it("maps the canonical deployed stages to Deployed", () => {
    for (const s of DEPLOYED_STAGES_2024) {
      expect(stageBucket(s)).toBe("Deployed");
    }
  });

  it("maps the canonical pilot stage to Pilot", () => {
    for (const s of PILOT_STAGES_2024) {
      expect(stageBucket(s)).toBe("Pilot");
    }
  });

  it("maps the canonical pre-deployment stages to Pre-deployment", () => {
    for (const s of PRE_DEPLOYMENT_STAGES_2024) {
      expect(stageBucket(s)).toBe("Pre-deployment");
    }
  });

  it("classifies anything containing 'retired' as Retired (highest priority)", () => {
    expect(stageBucket("Retired")).toBe("Retired");
    expect(stageBucket("d) Retired – discontinued")).toBe("Retired");
  });

  it("matches unrecoded substring variants tolerantly", () => {
    expect(stageBucket("c) Deployed – in operation")).toBe("Deployed");
    expect(stageBucket("In production")).toBe("Deployed");
    expect(stageBucket("b) Pilot — implementation and assessment")).toBe(
      "Pilot",
    );
  });

  it("defaults null / blank / unknown to Pre-deployment", () => {
    expect(stageBucket(null)).toBe("Pre-deployment");
    expect(stageBucket(undefined)).toBe("Pre-deployment");
    expect(stageBucket("")).toBe("Pre-deployment");
    expect(stageBucket("Ideation")).toBe("Pre-deployment");
  });
});

describe("liveStageRank", () => {
  it("orders Deployed (2) > Pilot (1) > everything else (0)", () => {
    expect(liveStageRank("Operation and Maintenance")).toBe(2);
    expect(liveStageRank("Implementation and Assessment")).toBe(1);
    expect(liveStageRank("Planned")).toBe(0);
    expect(liveStageRank(null)).toBe(0);
    // Retired is "everything else" for ranking purposes.
    expect(liveStageRank("Retired")).toBe(0);
  });
});

describe("LIVE_DEV_STAGES_2024", () => {
  it("contains the production + implementation stages used by the callout", () => {
    expect(LIVE_DEV_STAGES_2024).toContain("Operation and Maintenance");
    expect(LIVE_DEV_STAGES_2024).toContain("Implementation and Assessment");
  });
});

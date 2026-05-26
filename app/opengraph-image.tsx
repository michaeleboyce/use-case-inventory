import { ImageResponse } from "next/og";

export const alt = "Federal AI Use Case Inventory 2025";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F7F1E1",
          color: "#2A241E",
          fontFamily: "serif",
          padding: 64,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Top eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: "monospace",
            fontSize: 18,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#6B5E4F",
          }}
        >
          <div
            style={{
              padding: "6px 12px",
              background: "#C73E2F",
              color: "#F7F1E1",
              fontWeight: 700,
              letterSpacing: "0.2em",
            }}
          >
            IFP
          </div>
          <span>2025 Federal AI Inventory · OMB M-25-21</span>
        </div>

        {/* Title block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontStyle: "italic",
              fontSize: 108,
              lineHeight: 0.98,
              letterSpacing: "-0.02em",
              color: "#2A241E",
            }}
          >
            Federal AI
          </div>
          <div
            style={{
              fontStyle: "italic",
              fontSize: 108,
              lineHeight: 0.98,
              letterSpacing: "-0.02em",
              color: "#C73E2F",
            }}
          >
            Use Case Inventory
          </div>
        </div>

        {/* Footer stats strip */}
        <div
          style={{
            borderTop: "3px solid #2A241E",
            paddingTop: 22,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            fontFamily: "monospace",
            fontSize: 22,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#2A241E",
          }}
        >
          <span>Agencies · Use cases · Products · Templates</span>
          <span style={{ color: "#6B5E4F" }}>use-case-inventory.vercel.app</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

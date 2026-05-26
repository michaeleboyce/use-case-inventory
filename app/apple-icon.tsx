import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#C73E2F",
          color: "#F7F1E1",
          fontFamily: "monospace",
          padding: 18,
        }}
      >
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            lineHeight: 1,
          }}
        >
          AI
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 14,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          2025
        </div>
      </div>
    ),
    { ...size },
  );
}

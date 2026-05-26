import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#C73E2F",
          color: "#F7F1E1",
          fontSize: 18,
          fontWeight: 800,
          fontFamily: "monospace",
          letterSpacing: "-0.05em",
        }}
      >
        AI
      </div>
    ),
    { ...size },
  );
}

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const alt = "Hustle — The Economy of You";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ display: "flex", width: 180, height: 180, borderRadius: 38,
      background: "#121714", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", width: 140, height: 140, borderRadius: 35,
        background: "#C9F26B", alignItems: "center", justifyContent: "center",
        color: "#121714", fontSize: 104, fontWeight: 900, letterSpacing: -8 }}>
        h.
      </div>
    </div>, size
  );
}

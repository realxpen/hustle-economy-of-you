import { ImageResponse } from "next/og";

// A text-first icon uses the same black / Hustle-orange identity as the app.
// Generated server-side, so no third-party icon requests or external fonts.
export function renderHustlePwaIcon(pixels: number) {
  return new ImageResponse(
    <div style={{
      display: "flex",
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#111111"
    }}>
      <div style={{
        display: "flex",
        width: "79%",
        height: "79%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ff5a1f",
        borderRadius: pixels * 0.15
      }}>
        <span style={{
          color: "#111111",
          fontSize: pixels * 0.55,
          fontWeight: 900,
          lineHeight: 1
        }}>H</span>
      </div>
    </div>,
    { width: pixels, height: pixels }
  );
}

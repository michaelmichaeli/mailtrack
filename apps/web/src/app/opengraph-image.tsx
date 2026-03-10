import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MailTrack — Universal Package Tracking Dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "linear-gradient(135deg, #312e81 0%, #1e1b4b 50%, #0f172a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 18,
              background: "#6366F1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            📦
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: -1,
              }}
            >
              MailTrack
            </span>
            <span style={{ fontSize: 22, color: "#a5b4fc" }}>
              Universal Package Tracking Dashboard
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px", marginTop: 80 }}>
          {[
            "📦 All stores in one",
            "�� Auto email parsing",
            "🔔 Live tracking alerts",
            "🌙 Dark mode",
          ].map((feature) => (
            <div
              key={feature}
              style={{
                padding: "12px 24px",
                borderRadius: 22,
                background: "rgba(99, 102, 241, 0.2)",
                color: "#c7d2fe",
                fontSize: 16,
              }}
            >
              {feature}
            </div>
          ))}
        </div>

        <span
          style={{
            position: "absolute",
            bottom: 60,
            left: 80,
            fontSize: 18,
            color: "#64748b",
          }}
        >
          mailtrack.app
        </span>
      </div>
    ),
    { ...size },
  );
}

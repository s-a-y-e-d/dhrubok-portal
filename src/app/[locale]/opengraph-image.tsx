import { ImageResponse } from "next/og";

export const alt = "Dhrubok Coaching Centre";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", color: "#171717", padding: "72px" }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 600 }}>
        <span style={{ width: 24, height: 24, marginRight: 16, borderRadius: 999, background: "#3ecf8e" }} />
        Dhrubok Coaching Centre
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", maxWidth: 900, fontSize: 72, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-2px" }}>Structured learning. Clear progress.</div>
        <div style={{ display: "flex", marginTop: 28, color: "#404040", fontSize: 28 }}>{locale === "bn" ? "Bangla and English coaching portal" : "A dependable bilingual coaching portal"}</div>
      </div>
      <div style={{ display: "flex", color: "#737373", fontSize: 22 }}>Courses · Admission · Notices · Student portal</div>
    </div>,
    size,
  );
}

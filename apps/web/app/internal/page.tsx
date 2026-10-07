export default function InternalHomePage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#f1efe7",
      color: "#111",
      padding: "clamp(24px, 5vw, 72px)"
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 20,
        alignItems: "center",
        borderBottom: "1px solid #b9b5aa",
        paddingBottom: 18
      }}>
        <a href="/account" style={{ fontWeight: 800 }}>← Your Hustle identity</a>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>HUSTLE · INTERNAL</span>
      </header>

      <section style={{ padding: "64px 0 36px", maxWidth: 960 }}>
        <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".14em", color: "#67635a" }}>
          ADMIN OPERATIONS
        </p>
        <h1 style={{
          fontSize: "clamp(52px, 8vw, 108px)",
          lineHeight: .88,
          letterSpacing: "-.06em",
          margin: "12px 0 24px"
        }}>
          Review.<br />Verify.<br /><em style={{ fontFamily: "Georgia, serif", color: "#ff5a1f", fontWeight: 400 }}>Activate.</em>
        </h1>
        <p style={{ maxWidth: 660, fontSize: 16, lineHeight: 1.6, color: "#605d55" }}>
          Capability approvals stay separate from normal user activity. Open the queue you need below.
          The API still checks your authorized Hustle admin identity before returning any private review data.
        </p>
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 14
      }}>
        <a href="/internal/hustler-reviews" style={{
          display: "grid",
          gap: 18,
          background: "#111",
          color: "#f7f3ea",
          borderRadius: 28,
          padding: 28,
          textDecoration: "none",
          minHeight: 220
        }}>
          <small style={{ letterSpacing: ".12em", fontWeight: 900, color: "#aaa69d" }}>01 · HUSTLER CAPABILITY</small>
          <strong style={{ fontSize: 36, letterSpacing: "-.04em", lineHeight: .95 }}>Review Hustler applications</strong>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: "#c8c4bb" }}>
            Start review, inspect proof, verify identity, approve or reject.
          </span>
          <b>OPEN QUEUE →</b>
        </a>

        <a href="/internal/agent-reviews" style={{
          display: "grid",
          gap: 18,
          background: "#ff5a1f",
          color: "#111",
          borderRadius: 28,
          padding: 28,
          textDecoration: "none",
          minHeight: 220
        }}>
          <small style={{ letterSpacing: ".12em", fontWeight: 900 }}>02 · AGENT CAPABILITY</small>
          <strong style={{ fontSize: 36, letterSpacing: "-.04em", lineHeight: .95 }}>Review Agent applications</strong>
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>
            Verify an Agent before they can receive representation or assisted-onboarding authority.
          </span>
          <b>OPEN QUEUE →</b>
        </a>
      </section>
    </main>
  );
}

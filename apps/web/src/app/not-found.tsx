export default function NotFound() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "bold" }}>404</h1>
        <p style={{ color: "#737373" }}>Page not found</p>
        <a href="/dashboard" style={{ color: "#3b82f6", marginTop: "1rem", display: "inline-block" }}>
          Go to dashboard
        </a>
      </div>
    </div>
  );
}

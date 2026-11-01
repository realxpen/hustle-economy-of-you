// UX051: read-only diagnostics against isolated, public TEST-only origins.
// No user credentials, cookies, mutations, payment calls or response bodies in logs.
const WEB = "https://hustle-payment-preview.realxpens.workers.dev";
const API = "https://hustle-payment-preview-api.realxpens.workers.dev";
const targets = [
  ["auth", WEB + "/auth"],
  ["web_health_proxy", WEB + "/api/isolated/api/v1/health"],
  ["web_anonymous_payment_deny", WEB + "/api/isolated/api/v1/payments/unrelated-preview-probe"],
  ["api_health", API + "/api/v1/health"],
  ["api_anonymous_payment_deny", API + "/api/v1/payments/unrelated-preview-probe"],
];
for (const [name, url] of targets) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: name === "auth" ? "text/html" : "application/json" },
      signal: AbortSignal.timeout(15000)
    });
    const html = name === "auth" && response.status === 200
      ? await response.text() : "";
    const marker = name === "auth" ? {
      expected_private_test_literal_present: html.includes("PRIVATE TEST"),
      auth_heading_present: html.includes("Enter your Hustle."),
      html_type: response.headers.get("content-type")?.split(";")[0] || "unspecified",
      length_bucket: html.length ? (html.length >= 10000 ? "10k+" : "under-10k") : "empty"
    } : {};
    console.log(JSON.stringify({ name, status: response.status, ...marker }));
  } catch (error) {
    console.log(JSON.stringify({ name, status: "unreachable", error_type: error?.name ?? "network-error" }));
  }
}
console.log("READ-ONLY diagnostics complete; no credentials, body content, or transactions emitted.");

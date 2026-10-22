/**
 * Hustle isolated-staging infrastructure smoke endpoint.
 * Publicly reachable, deliberately NOT the connected API or auth proxy.
 * No secrets, database access, identity data, or mutation handlers.
 */
const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff"
};

export default {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...headers, allow: "GET" }
      });
    }
    if (pathname !== "/" && pathname !== "/health") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers
      });
    }
    return new Response(JSON.stringify({
      project: "Hustle",
      environment: "isolated-staging",
      status: "reachable",
      check: "hosting-only",
      connectedApiReady: false,
      liveAuthenticationTested: false,
      bookingWritesEnabled: false,
      financialProvidersEnabled: false
    }), { status: 200, headers });
  }
};

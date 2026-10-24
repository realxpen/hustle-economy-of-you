/**
 * The disposable, explicitly isolated staging environment has no private-file
 * storage provider. It accepts a reviewer-inspectable HTTPS portfolio URL in
 * the existing optional businessInfo field as TEST EVIDENCE ONLY.
 * No remote URL is fetched by the server. This does not verify identity.
 * Production still requires an actual private capability-proof record.
 */
export function hasIsolatedStagingPortfolioEvidence(value: unknown): boolean {
  if (process.env.HUSTLE_RUNTIME_SCOPE !== "isolated-staging" ||
      typeof value !== "string" || value.length > 800 || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.port && !url.hash && host.includes(".") &&
      !host.endsWith(".local") && !host.endsWith(".internal") &&
      host !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(host) &&
      !host.startsWith("[") && !value.includes("\\");
  } catch { return false; }
}

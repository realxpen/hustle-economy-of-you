const LOCAL_WEB_ORIGIN = "http://localhost:3001";

function normalizeOrigin(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getStorefrontWebOrigin() {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_WEB_URL) ??
    normalizeOrigin(process.env.WEB_ORIGIN) ??
    LOCAL_WEB_ORIGIN
  );
}

export function getCanonicalStorefrontUrl(username: string) {
  const normalized = username.trim().replace(/^@/, "");
  return `${getStorefrontWebOrigin()}/u/${encodeURIComponent(normalized)}`;
}

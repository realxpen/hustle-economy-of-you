export function nowIso(): string {
  return new Date().toISOString();
}

export function safeJson(value: unknown): string {
  try { return JSON.stringify(value); } catch { return "{}"; }
}

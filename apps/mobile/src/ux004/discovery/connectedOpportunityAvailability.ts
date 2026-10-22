/**
 * A3.4: safely project authenticated READ-ONLY booking slot results into a
 * local enquiry preview. Availability is momentary, never held or booked here.
 */
import type { BookingSlot, SearchResult, SlotPage } from "../../experience/feed-api";

export function enquiryServiceId(result: SearchResult | null): string | null {
  if (!result || result.kind !== "service" || !result.service) return null;
  const id = result.service.id;
  return typeof id === "string" && id === result.id && /^[A-Za-z0-9_-]{1,128}$/.test(id)
    ? id : null;
}

export function currentEnquirySlots(page: SlotPage | null, now = Date.now()): BookingSlot[] {
  if (page?.mode !== "APPOINTMENT" || !Array.isArray(page.slots)) return [];
  const ids = new Set<string>();
  return page.slots.filter(slot => {
    const at = typeof slot.startAt === "string" ? Date.parse(slot.startAt) : NaN;
    if (!slot.available || slot.remainingCapacity < 1 || !Number.isFinite(at) || at <= now
      || ids.has(slot.startAt)) return false;
    ids.add(slot.startAt);
    return true;
  });
}

export function enquirySlotLabel(instant: string, timezone: string): string | null {
  const millis = Date.parse(instant);
  if (!Number.isFinite(millis)) return null;
  try {
    return new Intl.DateTimeFormat("en-NG", {
      timeZone: timezone, hour: "numeric", minute: "2-digit",
      timeZoneName: "short"
    }).format(new Date(millis));
  } catch {
    return null;
  }
}

/** Calendar query dates are day-only values, never local hours or placeholders. */
export function enquiryNextDays(now = Date.now(), days = 7): string[] {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, n) =>
    new Date(start.getTime() + (n + 1) * 86_400_000).toISOString().slice(0, 10)
  );
}

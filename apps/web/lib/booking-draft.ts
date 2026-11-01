/**
 * Booking details stay in sessionStorage for this tab only. Never include
 * tokens, payment details, user IDs or financial state. The server remains
 * authoritative for availability, the accepted price and the Booking.
 */
export const BOOKING_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
const BOOKING_DRAFT_VERSION = 1;
const SERVICE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type BookingDraftFields = {
  requestedStartAt: string;
  requestedEndAt: string;
  requirements: string;
  location: string;
  notes: string;
  peopleCount?: number;
};

type StoredBookingDraft = BookingDraftFields & {
  version: number;
  serviceId: string;
  savedAt: number;
};

function keyFor(serviceId: string): string | null {
  return SERVICE_ID.test(serviceId) ? `hustle:booking-draft:v1:${serviceId}` : null;
}

function boundedFields(value: unknown): value is BookingDraftFields {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.requestedStartAt === "string" && draft.requestedStartAt.length <= 30 &&
    typeof draft.requestedEndAt === "string" && draft.requestedEndAt.length <= 30 &&
    typeof draft.requirements === "string" && draft.requirements.length <= 4000 &&
    typeof draft.location === "string" && draft.location.length <= 300 &&
    typeof draft.notes === "string" && draft.notes.length <= 2000 &&
    (draft.peopleCount===undefined || (typeof draft.peopleCount==="number" &&
      Number.isSafeInteger(draft.peopleCount)&&draft.peopleCount>=1&&draft.peopleCount<=12));
}

export function readBookingDraft(storage: Storage | null, serviceId: string, now = Date.now()): BookingDraftFields | null {
  const key = keyFor(serviceId);
  if (!key || !storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!boundedFields(parsed)) throw Error("Invalid draft");
    const draft = parsed as StoredBookingDraft;
    if (draft.version !== BOOKING_DRAFT_VERSION || draft.serviceId !== serviceId ||
      !Number.isFinite(draft.savedAt) || draft.savedAt > now || now - draft.savedAt > BOOKING_DRAFT_TTL_MS) {
      throw Error("Expired or different Service draft");
    }
    const { requestedStartAt, requestedEndAt, requirements, location, notes,peopleCount } = draft;
    return { requestedStartAt, requestedEndAt, requirements, location, notes,
      ...(peopleCount===undefined?{}:{peopleCount}) };
  } catch {
    try { storage.removeItem(key); } catch { /* Storage is optional. */ }
    return null;
  }
}

export function saveBookingDraft(
  storage: Storage | null, serviceId: string, fields: BookingDraftFields, now = Date.now()
): boolean {
  const key = keyFor(serviceId);
  if (!key || !storage || !boundedFields(fields) || !Number.isFinite(now)) return false;
  try {
    const record: StoredBookingDraft = { version: BOOKING_DRAFT_VERSION, serviceId, savedAt: now, ...fields };
    storage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    // Private browsing/storage quotas must never block a Booking request.
    return false;
  }
}

export function clearBookingDraft(storage: Storage | null, serviceId: string): void {
  const key = keyFor(serviceId);
  if (!key || !storage) return;
  try { storage.removeItem(key); } catch { /* Nothing to clear. */ }
}

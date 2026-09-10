"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

export type BookingStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "DECLINED"
  | "PAYMENT_PENDING"
  | "FUNDED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "REFUNDED"
  | "CLOSED";

export interface BookingUser {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  location: string | null;
  verified: boolean;
}

export interface BookingRecord {
  id: string;
  serviceId: string;
  clientUserId: string;
  hustlerUserId: string;
  conversationId: string | null;
  status: BookingStatus;
  requestedStartAt: string;
  requestedEndAt: string | null;
  confirmedStartAt: string | null;
  confirmedEndAt: string | null;
  requirements: string;
  location: string | null;
  notes: string | null;
  serviceTitleSnapshot: string;
  agreedPriceMinor: number;
  currency: string;
  pricingTypeSnapshot: "FIXED" | "STARTING_AT" | "HOURLY" | string;
  acceptedAt: string | null;
  declinedAt: string | null;
  paymentPendingAt: string | null;
  fundedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  declineReason: string | null;
  cancellationReason: string | null;
  disputedAt: string | null;
  refundedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: BookingUser;
  hustler: BookingUser;
  service: {
    id: string;
    title: string | null;
    status: string;
    category: string | null;
    deliveryMode: string;
    priceMinor: number | null;
    currency: string;
    pricingType: string;
    location: string | null;
    professionalProfileId: string;
  };
  viewerRole: "CLIENT" | "HUSTLER";
  paymentBoundary: {
    required: boolean;
    funded: boolean;
    phase: string | null;
    message: string | null;
  };
  nextAction: string | null;
}

export interface BookingPage {
  items: BookingRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CreateBookingInput {
  serviceId: string;
  requestedStartAt: string;
  requestedEndAt?: string;
  requirements: string;
  location?: string;
  notes?: string;
  conversationId?: string;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

async function authenticatedFetch(path: string, init?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("You need to sign in again");

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${session.access_token}`);
  if (init?.body) headers.set("content-type", "application/json");

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response;
}

export async function createBooking(input: CreateBookingInput) {
  const response = await authenticatedFetch("/bookings", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<BookingRecord>;
}

export async function listClientBookings(options: { cursor?: string | null; limit?: number } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 20));
  if (options.cursor) params.set("cursor", options.cursor);
  const response = await authenticatedFetch(`/bookings/client?${params.toString()}`);
  return response.json() as Promise<BookingPage>;
}

export async function listHustlerBookings(options: { cursor?: string | null; limit?: number } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 20));
  if (options.cursor) params.set("cursor", options.cursor);
  const response = await authenticatedFetch(`/bookings/hustler?${params.toString()}`);
  return response.json() as Promise<BookingPage>;
}

export async function getBooking(bookingId: string) {
  const response = await authenticatedFetch(`/bookings/${encodeURIComponent(bookingId)}`);
  return response.json() as Promise<BookingRecord>;
}

export async function acceptBooking(
  bookingId: string,
  input: { confirmedStartAt?: string; confirmedEndAt?: string } = {}
) {
  const response = await authenticatedFetch(`/bookings/${encodeURIComponent(bookingId)}/accept`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<BookingRecord>;
}

export async function declineBooking(bookingId: string, reason?: string) {
  const response = await authenticatedFetch(`/bookings/${encodeURIComponent(bookingId)}/decline`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
  return response.json() as Promise<BookingRecord>;
}

export async function cancelBooking(bookingId: string, reason?: string) {
  const response = await authenticatedFetch(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
  return response.json() as Promise<BookingRecord>;
}

export async function startBooking(bookingId: string) {
  const response = await authenticatedFetch(`/bookings/${encodeURIComponent(bookingId)}/start`, {
    method: "POST",
    body: JSON.stringify({})
  });
  return response.json() as Promise<BookingRecord>;
}

export async function completeBooking(bookingId: string) {
  const response = await authenticatedFetch(`/bookings/${encodeURIComponent(bookingId)}/complete`, {
    method: "POST",
    body: JSON.stringify({})
  });
  return response.json() as Promise<BookingRecord>;
}

export function formatBookingPrice(booking: Pick<BookingRecord, "agreedPriceMinor" | "currency" | "pricingTypeSnapshot">) {
  const amount = booking.agreedPriceMinor / 100;
  const formatted = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: booking.currency || "NGN",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);

  if (booking.pricingTypeSnapshot === "STARTING_AT") return `From ${formatted}`;
  if (booking.pricingTypeSnapshot === "HOURLY") return `${formatted} / hour`;
  return formatted;
}

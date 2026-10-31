"use client";

import { authenticatedFetch } from "./api/authenticated-fetch";
import { hasViewerSession, publicReadFetch } from "./api/public-browsing";

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
  timeProposalId: string | null;
  timeProposalStatus: "PENDING" | "ACCEPTED" | "DECLINED" | null;
  timeProposalStartAt: string | null;
  timeProposalEndAt: string | null;
  timeProposalNote: string | null;
  timeProposalCreatedAt: string | null;
  timeProposalRespondedAt: string | null;
  scheduledDurationMinutes: number | null;
  extendedMinutes: number;
  actualStartedAt: string | null;
  actualFinishedAt: string | null;
  requirements: string;
  location: string | null;
  notes: string | null;
  partySize: number;
  venueType: string | null;
  referenceUrls: string[];
  consultationRequested: boolean;
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
    consultationPolicy: "OFF" | "OPTIONAL" | "REQUIRED";
    consultationFeeMinor: number;
    consultationCreditEnabled: boolean;
    maxPartySize: number;
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
  partySize?: number;
  venueType?: "AT_PROVIDER" | "AT_CLIENT" | "EVENT" | "REMOTE";
  referenceUrls?: string[];
  consultationRequested?: boolean;
}

export interface BookingAvailability {
  available: boolean;
  mode: "APPOINTMENT" | "WORK_QUEUE" | "CONSULTATION";
  capacity: number;
  remainingCapacity: number;
  overbooking: boolean;
  turnaroundHours: number;
  startAt: string;
  endAt: string | null;
  reason: string | null;
}

export async function checkBookingAvailability(input: {
  serviceId: string;
  startAt: string;
  endAt?: string;
  partySize?: number;
}) {
  const params = new URLSearchParams({ serviceId: input.serviceId, startAt: input.startAt });
  if (input.partySize) params.set("partySize", String(input.partySize));
  if (input.endAt) params.set("endAt", input.endAt);
  const response = await (await hasViewerSession()
    ? authenticatedFetch(`/bookings/availability?${params.toString()}`)
    : publicReadFetch(`/guest/bookings/availability?${params.toString()}`));
  if (!response.ok) throw new Error(`Booking availability returned ${response.status}`);
  return response.json() as Promise<BookingAvailability>;
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

export async function proposeBookingTime(bookingId: string, input: {
  startAt: string;
  endAt?: string;
  note?: string;
}) {
  const response = await authenticatedFetch(`/bookings/${encodeURIComponent(bookingId)}/propose-time`, {
    method: "POST", body: JSON.stringify(input)
  });
  return response.json() as Promise<BookingRecord>;
}

export async function respondToBookingTime(bookingId: string, input: {
  proposalId: string;
  decision: "ACCEPT" | "DECLINE";
}) {
  const response = await authenticatedFetch(`/bookings/${encodeURIComponent(bookingId)}/respond-time`, {
    method: "POST", body: JSON.stringify(input)
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

export interface FlowTimeSlot {
  startAt: string;
  endAt: string | null;
  available: boolean;
  remainingCapacity: number;
  overbooking: boolean;
}
export interface FlowTimeSlotDay {
  date: string;
  timezone: string;
  mode: "APPOINTMENT" | "WORK_QUEUE" | "CONSULTATION";
  turnaroundHours: number;
  configuredHours?: boolean;
  slots: FlowTimeSlot[];
}

export async function listFlowTimeSlots(serviceId: string, date: string) {
  const params = new URLSearchParams({ serviceId, date });
  const response = await (await hasViewerSession()
    ? authenticatedFetch(`/bookings/slots?${params.toString()}`)
    : publicReadFetch(`/guest/bookings/slots?${params.toString()}`));
  if (!response.ok) throw new Error(`Booking slots returned ${response.status}`);
  return response.json() as Promise<FlowTimeSlotDay>;
}

export async function getServiceDurationInsights(serviceId: string) {
  const response = await authenticatedFetch(`/bookings/duration-insights?serviceId=${encodeURIComponent(serviceId)}`);
  return response.json() as Promise<{
    sampleSize: number;
    medianMinutes: number | null;
    suggestedDurationMinutes: number | null;
    currentDefaultMinutes: number;
  }>;
}

export async function extendBooking(bookingId: string, minutes: number, note?: string) {
  const response = await authenticatedFetch(`/bookings/${encodeURIComponent(bookingId)}/extend`, {
    method: "POST", body: JSON.stringify({ minutes, note })
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

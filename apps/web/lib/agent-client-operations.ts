"use client";

import type { BookingPage, BookingRecord } from "./booking";
import type { MessagingMessage, MessagingParticipant } from "./messaging";
import { authenticatedFetch } from "./api/authenticated-fetch";

export interface AgentBookingRecord extends BookingRecord {
  representedByAgent: true;
  agentAllowedActions: Array<"ACCEPT" | "DECLINE" | "CANCEL" | "START">;
}

export interface AgentBookingPage extends Omit<BookingPage, "items"> {
  items: AgentBookingRecord[];
}

export interface AgentConversationSummary {
  id: string;
  type: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  representedUserId: string;
  principalLastReadAt: string | null;
  otherParticipant: MessagingParticipant | null;
  lastMessage: MessagingMessage | null;
}

export interface AgentConversationPage {
  items: AgentConversationSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AgentMessagePage {
  items: MessagingMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

const base = (principalUserId: string) =>
  `/agent-client/${encodeURIComponent(principalUserId)}`;

export async function listAgentBookings(
  principalUserId: string,
  options: { cursor?: string | null; limit?: number } = {}
) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 20));
  if (options.cursor) params.set("cursor", options.cursor);
  const response = await authenticatedFetch(
    `${base(principalUserId)}/bookings?${params.toString()}`
  );
  return response.json() as Promise<AgentBookingPage>;
}

export async function getAgentBooking(
  principalUserId: string,
  bookingId: string
) {
  const response = await authenticatedFetch(
    `${base(principalUserId)}/bookings/${encodeURIComponent(bookingId)}`
  );
  return response.json() as Promise<AgentBookingRecord>;
}

export async function acceptAgentBooking(
  principalUserId: string,
  bookingId: string,
  input: { confirmedStartAt?: string; confirmedEndAt?: string } = {}
) {
  const response = await authenticatedFetch(
    `${base(principalUserId)}/bookings/${encodeURIComponent(bookingId)}/accept`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return response.json() as Promise<AgentBookingRecord>;
}

export async function declineAgentBooking(
  principalUserId: string,
  bookingId: string,
  reason?: string
) {
  const response = await authenticatedFetch(
    `${base(principalUserId)}/bookings/${encodeURIComponent(bookingId)}/decline`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
  return response.json() as Promise<AgentBookingRecord>;
}

export async function cancelAgentBooking(
  principalUserId: string,
  bookingId: string,
  reason?: string
) {
  const response = await authenticatedFetch(
    `${base(principalUserId)}/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
  return response.json() as Promise<AgentBookingRecord>;
}

export async function startAgentBooking(
  principalUserId: string,
  bookingId: string
) {
  const response = await authenticatedFetch(
    `${base(principalUserId)}/bookings/${encodeURIComponent(bookingId)}/start`,
    { method: "POST", body: JSON.stringify({}) }
  );
  return response.json() as Promise<AgentBookingRecord>;
}

export async function listAgentConversations(
  principalUserId: string,
  options: { cursor?: string | null; limit?: number } = {}
) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 20));
  if (options.cursor) params.set("cursor", options.cursor);
  const response = await authenticatedFetch(
    `${base(principalUserId)}/messages/conversations?${params.toString()}`
  );
  return response.json() as Promise<AgentConversationPage>;
}

export async function getAgentConversation(
  principalUserId: string,
  conversationId: string
) {
  const response = await authenticatedFetch(
    `${base(principalUserId)}/messages/conversations/${encodeURIComponent(conversationId)}`
  );
  return response.json() as Promise<AgentConversationSummary>;
}

export async function listAgentConversationMessages(
  principalUserId: string,
  conversationId: string,
  options: { cursor?: string | null; limit?: number } = {}
) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 50));
  if (options.cursor) params.set("cursor", options.cursor);
  const response = await authenticatedFetch(
    `${base(principalUserId)}/messages/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`
  );
  return response.json() as Promise<AgentMessagePage>;
}

export async function sendAgentMessage(
  principalUserId: string,
  conversationId: string,
  text: string
) {
  const response = await authenticatedFetch(
    `${base(principalUserId)}/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: JSON.stringify({ text }) }
  );
  return response.json() as Promise<MessagingMessage>;
}

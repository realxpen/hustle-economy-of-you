"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

export type MessageContextType = "POST" | "SERVICE" | "PRODUCT";
export type MessageAttachmentType = "IMAGE" | "FILE";

export interface MessagingParticipant {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  location: string | null;
  verified: boolean;
  professionalProfile: {
    headline: string | null;
    primarySkill: string | null;
    category: string | null;
    status: string;
  } | null;
}

export interface MessagingMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string | null;
  attachment: {
    type: MessageAttachmentType;
    storageKey: string;
    fileName: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
  } | null;
  context: {
    type: MessageContextType;
    id: string;
    url: string;
  } | null;
  sender: {
    id: string;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  type: "DIRECT" | string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  viewer: {
    userId: string;
    lastReadAt: string | null;
    unreadCount: number;
  };
  otherParticipant: MessagingParticipant | null;
  lastMessage: MessagingMessage | null;
}

export interface ConversationPage {
  items: ConversationSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface MessagePage {
  items: MessagingMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SendMessageInput {
  text?: string;
  contextType?: MessageContextType;
  contextId?: string;
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

export async function openDirectConversation(recipientUserId: string) {
  const response = await authenticatedFetch("/messaging/conversations/direct", {
    method: "POST",
    body: JSON.stringify({ recipientUserId })
  });
  return response.json() as Promise<{ created: boolean; conversation: ConversationSummary }>;
}

export async function listConversations(options: { cursor?: string | null; limit?: number } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 20));
  if (options.cursor) params.set("cursor", options.cursor);
  const response = await authenticatedFetch(`/messaging/conversations?${params.toString()}`);
  return response.json() as Promise<ConversationPage>;
}

export async function getConversation(conversationId: string) {
  const response = await authenticatedFetch(`/messaging/conversations/${encodeURIComponent(conversationId)}`);
  return response.json() as Promise<ConversationSummary>;
}

export async function listMessages(
  conversationId: string,
  options: { cursor?: string | null; limit?: number } = {}
) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 50));
  if (options.cursor) params.set("cursor", options.cursor);
  const response = await authenticatedFetch(
    `/messaging/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`
  );
  return response.json() as Promise<MessagePage>;
}

export async function sendMessage(conversationId: string, input: SendMessageInput) {
  const response = await authenticatedFetch(
    `/messaging/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return response.json() as Promise<MessagingMessage>;
}

export async function markConversationRead(conversationId: string, messageId?: string | null) {
  const response = await authenticatedFetch(
    `/messaging/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "POST", body: JSON.stringify(messageId ? { messageId } : {}) }
  );
  return response.json() as Promise<{
    conversationId: string;
    lastReadAt: string;
    throughMessageId: string | null;
    unreadCount: number;
  }>;
}

export async function recordMessageContextOpened(conversationId: string, messageId: string) {
  const response = await authenticatedFetch(
    `/messaging/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/context-opened`,
    { method: "POST", body: JSON.stringify({}) }
  );
  return response.json() as Promise<{ recorded: true }>;
}

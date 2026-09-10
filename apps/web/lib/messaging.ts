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
  attachmentType?: MessageAttachmentType;
  attachmentStorageKey?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  attachmentSizeBytes?: number;
  contextType?: MessageContextType;
  contextId?: string;
}

export interface MessageAttachmentUpload {
  type: MessageAttachmentType;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const attachmentBucket = "message-attachments";
const maxAttachmentBytes = 25 * 1024 * 1024;
const allowedAttachmentMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip"
]);

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

export async function setConversationTyping(conversationId: string, typing: boolean) {
  const response = await authenticatedFetch(
    `/messaging/conversations/${encodeURIComponent(conversationId)}/typing`,
    { method: "POST", body: JSON.stringify({ typing }) }
  );
  return response.json() as Promise<{
    conversationId: string;
    typing: boolean;
    expiresAt: string | null;
  }>;
}

export async function getConversationTyping(conversationId: string) {
  const response = await authenticatedFetch(
    `/messaging/conversations/${encodeURIComponent(conversationId)}/typing`
  );
  return response.json() as Promise<{ conversationId: string; typingUserIds: string[] }>;
}

export async function uploadMessageAttachment(
  conversationId: string,
  file: File
): Promise<MessageAttachmentUpload> {
  if (!conversationId.trim()) throw new Error("Conversation is required for an attachment");
  if (!file.size || file.size > maxAttachmentBytes) {
    throw new Error("Attachment must be between 1 byte and 25 MB");
  }
  if (!allowedAttachmentMimeTypes.has(file.type)) {
    throw new Error("That file type is not supported in Hustle messages yet");
  }

  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user?.id) throw new Error("You need to sign in again");

  const safeName = sanitizeFileName(file.name);
  const objectPath = `${conversationId}/${session.user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(attachmentBucket).upload(objectPath, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600"
  });
  if (error) throw new Error(error.message || "Could not upload attachment");

  return {
    type: file.type.startsWith("image/") ? "IMAGE" : "FILE",
    storageKey: `${attachmentBucket}/${objectPath}`,
    fileName: file.name.slice(0, 255),
    mimeType: file.type,
    sizeBytes: file.size
  };
}

export async function deleteMessageAttachment(storageKey: string) {
  const objectPath = attachmentObjectPath(storageKey);
  const { error } = await getSupabaseBrowserClient().storage.from(attachmentBucket).remove([objectPath]);
  if (error) throw new Error(error.message || "Could not remove attachment");
}

export async function createMessageAttachmentUrl(storageKey: string, expiresInSeconds = 600) {
  const objectPath = attachmentObjectPath(storageKey);
  const { data, error } = await getSupabaseBrowserClient().storage
    .from(attachmentBucket)
    .createSignedUrl(objectPath, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Attachment is unavailable");
  return data.signedUrl;
}

function attachmentObjectPath(storageKey: string) {
  const prefix = `${attachmentBucket}/`;
  if (!storageKey.startsWith(prefix)) throw new Error("Invalid message attachment reference");
  const objectPath = storageKey.slice(prefix.length);
  if (!objectPath) throw new Error("Invalid message attachment reference");
  return objectPath;
}

function sanitizeFileName(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (normalized || "attachment").slice(-140);
}

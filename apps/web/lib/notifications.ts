"use client";

import { authenticatedFetch } from "./api/authenticated-fetch";

export type HustleNotification = {
  id: string;
  kind: "MESSAGE" | "BOOKING" | "ORDER" | "APPLICATION" | "REVIEW" | "LIVE" | "SOCIAL" | "SAFETY";
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  items: HustleNotification[];
  nextCursor: string | null;
  hasMore: boolean;
};

export async function getNotifications(cursor?: string | null) {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  const response = await authenticatedFetch(`/notifications?${params}`);
  return response.json() as Promise<NotificationPage>;
}

export async function getUnreadNotificationCount() {
  const response = await authenticatedFetch("/notifications/unread-count");
  return response.json() as Promise<{ count: number }>;
}

export async function readNotification(id: string) {
  const response = await authenticatedFetch(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST"
  });
  return response.json() as Promise<{ id: string; read: true }>;
}

export async function readAllNotifications() {
  const response = await authenticatedFetch("/notifications/read-all", { method: "POST" });
  return response.json() as Promise<{ updatedCount: number }>;
}

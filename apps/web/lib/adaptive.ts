"use client";

import { authenticatedFetch } from "./api/authenticated-fetch";

export type AdaptiveBlueprint = {
  slug: string; version: number; type: string;
  label: string; steps: readonly string[]; features: readonly string[];
};
export type AdaptiveWorkspace = {
  id: string; name: string; slug: string;
  kind: "PERSONAL" | "BUSINESS" | "TEAM" | "AGENCY";
  category: string | null;
};
export type AdaptiveMembership = {
  id: string; role: string; permissions: string[];
  workspace: AdaptiveWorkspace;
};
export type AdaptiveServiceDraft = {
  id: string; title: string; priceMinor: number; currency: string;
  blueprint: { slug: string; version: number; type: string };
};
export type AdaptiveWorkItem = {
  id: string; title: string; source: "BOOKING" | "ORDER" | "ADAPTIVE_DRAFT";
  status: string; updatedAt: string; amountMinor?: number;
  workspaceId?: string; canonicalPath?: string; version?: number; canWrite: boolean;
};
export type AdaptiveInvitation = {
  id: string; role: string; permissions: string[];
  workspace: { id: string; name: string; kind: string };
};
async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authenticatedFetch("/adaptive" + path, options);
  return response.json() as Promise<T>;
}
function post<T>(path: string, data?: Record<string, unknown>) {
  return json<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });
}
export const adaptiveClient = {
  blueprints: () => json<AdaptiveBlueprint[]>("/blueprints"),
  workspaces: () => json<AdaptiveMembership[]>("/workspaces"),
  provisionPersonal: () => post<AdaptiveWorkspace>("/personal"),
  createWorkspace: (name: string, kind: string, category: string) =>
    post<AdaptiveWorkspace>("/workspaces", { name, kind, category }),
  services: (id: string) => json<AdaptiveServiceDraft[]>("/workspaces/" + encodeURIComponent(id) + "/services"),
  createService: (id: string, input: { title: string; blueprint: string; priceMinor: number }) =>
    post<AdaptiveServiceDraft>("/workspaces/" + encodeURIComponent(id) + "/services", input),
  work: (scope?: string) => json<{ items: AdaptiveWorkItem[]; nextCursor: null }>(
    "/work" + (scope ? "?workspaceId=" + encodeURIComponent(scope) : "")
  ),
  createWorkDraft: (id: string, title: string, description: string) =>
    post<AdaptiveWorkItem>("/workspaces/" + encodeURIComponent(id) + "/work-drafts", { title, description }),
  cancelWorkDraft: (id: string, expectedVersion: number) =>
    json<{ id: string; status: string; version: number }>(
      "/work-drafts/" + encodeURIComponent(id) + "/cancel",
      { method: "PATCH", body: JSON.stringify({ expectedVersion }) }
    ),
  invitations: () => json<AdaptiveInvitation[]>("/invitations"),
  invite: (id: string, username: string, role: string, permissions: string[]) =>
    post("/workspaces/" + encodeURIComponent(id) + "/invitations", { username, role, permissions }),
  respond: (id: string, answer: "accept" | "decline") =>
    post("/invitations/" + encodeURIComponent(id) + "/" + answer),
  members: (id: string) => json<{
    id: string; role: string; status: string; permissions: string[];
    user: { username: string | null; displayName: string | null };
  }[]>("/workspaces/" + encodeURIComponent(id) + "/members")
};

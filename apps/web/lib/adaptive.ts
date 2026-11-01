"use client";

import { authenticatedFetch } from "./api/authenticated-fetch";

export type AdaptivePolicyValue = string | number | boolean | string[];
export type AdaptivePolicy = Record<string, AdaptivePolicyValue>;
export type AdaptiveBlueprint = {
  slug: string; version: number; type: string;
  label: string; steps: readonly string[]; features: readonly string[];
  defaults: AdaptivePolicy;
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
  revision: number; policy: AdaptivePolicy; canonicalServiceId?: string | null;
  blueprint: { slug: string; version: number; type: string };
};
export type AdaptiveWorkItem = {
  id: string; title: string; source: "BOOKING" | "ORDER" | "ADAPTIVE_DRAFT";
  status: string; updatedAt: string; amountMinor?: number;
  workspaceId?: string; canonicalPath?: string; version?: number; canWrite: boolean;
};
export type WeeklyShift = { day: number; start: string; end: string };
export type StaffLeave = { id: string; startAt: string; endAt: string; note: string | null };
export type AdaptiveStaff = { id: string; displayName: string; active: boolean; revision: number;
  weeklyHours: WeeklyShift[]; leave: StaffLeave[] };
export type AdaptiveRoster = { stationCapacity: number; rosterEnabled: boolean;
  activeStaff: number; staff: AdaptiveStaff[]; warning: string };
export type AdaptiveItemStage = "AWAITING_INTAKE"|"RECEIVED"|"IN_PROGRESS"|"READY"|"OUT_FOR_DELIVERY"|"DELIVERED"|"COLLECTED";
export type AdaptiveBookingOperation = {
 bookingId:string; bookingStatus:string; viewerRole:"CLIENT"|"HUSTLER"|"TEAM";
 assignment: {id:string;staffId:string;revision:number;staff:{displayName:string;active:boolean}}|null;
 fulfillment: {id:string;status:AdaptiveItemStage;intakeMethod:string;returnMethod:string;
 revision:number;estimatedReadyAt:string|null;actualReadyAt:string|null;clientConfirmedAt:string|null;
 events:{details:{reason?:string;previousEstimate?:string;revisedEstimate?:string};createdAt:string}[]}|null;
 offeredMethods: {handoverMethods:string[];returnMethods:string[]}|null;
};
export type AdaptiveStaffingAlert = {
  bookingId:string;serviceTitle:string;bookingStatus:string;
  confirmedStartAt:string;confirmedEndAt:string|null;
  reason:"UNASSIGNED"|"WORKER_INACTIVE"|"SHIFT_OR_LEAVE_CONFLICT"|"CAPACITY_CONFLICT";
  capacityConflict:boolean;capacity:number;capacityReason:string|null;
  staffId:string|null;staffName:string|null;expectedRevision:number|null;
};
export type AdaptiveStaffingAlerts = {items:AdaptiveStaffingAlert[];rosterEnabled:boolean;limited:boolean;nextCursor:string|null};
export type AdaptiveWorkspaceBooking = {
 id:string;serviceTitleSnapshot:string;status:string;agreedPriceMinor:number;requestedStartAt:string;confirmedStartAt:string|null;
 client:{displayName:string|null;username:string|null};service:{bookingMode:string};
 adaptiveAssignment:{revision:number;staffId:string;staff:{displayName:string}}|null;
 adaptiveItemFulfillment:{revision:number;status:AdaptiveItemStage;intakeMethod:string;returnMethod:string;estimatedReadyAt:string|null;clientConfirmedAt:string|null}|null;
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
  createService: (id: string, input: { title: string; blueprint: string; priceMinor: number; policy: AdaptivePolicy }) =>
    post<AdaptiveServiceDraft>("/workspaces/" + encodeURIComponent(id) + "/services", input),
  updateService: (id: string, draftId: string, input: {title: string; priceMinor: number; policy: AdaptivePolicy; expectedRevision: number}) =>
    json<AdaptiveServiceDraft>("/workspaces/" + encodeURIComponent(id) + "/services/" + encodeURIComponent(draftId),
      { method: "PATCH", body: JSON.stringify(input) }),
  prepareCanonicalService: (workspaceId: string, draftId: string) =>
    post<{ serviceId: string; serviceStatus: string; bookingMode: string; created: boolean; next: string }>(
      "/workspaces/" + encodeURIComponent(workspaceId) + "/services/" + encodeURIComponent(draftId) + "/prepare-canonical"),
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
  staffingAlerts: (workspaceId:string,cursor?:string) =>
    json<AdaptiveStaffingAlerts>("/workspaces/"+encodeURIComponent(workspaceId)+"/staffing-alerts"+(cursor?"?cursor="+encodeURIComponent(cursor):"")),
  workspaceBookings: (id:string) => json<AdaptiveWorkspaceBooking[]>(
    "/workspaces/"+encodeURIComponent(id)+"/booking-operations"),
  bookingOps: (bookingId:string) => json<AdaptiveBookingOperation>(
    "/bookings/"+encodeURIComponent(bookingId)+"/operations"),
  chooseHandover: (bookingId:string,intakeMethod:string,returnMethod:string,expectedRevision?:number) =>
    post("/bookings/"+encodeURIComponent(bookingId)+"/handover",
      {intakeMethod,returnMethod,...(expectedRevision===undefined?{}:{expectedRevision})}),
  assignWorker: (spaceId:string,bookingId:string,staffId:string,expectedRevision?:number) =>
    post("/workspaces/"+encodeURIComponent(spaceId)+"/bookings/"+encodeURIComponent(bookingId)+"/assign",
      {staffId,...(expectedRevision===undefined?{}:{expectedRevision})}),
  advanceItem: (spaceId:string,bookingId:string,to:AdaptiveItemStage,expectedRevision:number) =>
    post("/workspaces/"+encodeURIComponent(spaceId)+"/bookings/"+encodeURIComponent(bookingId)+"/item-progress",
      {to,expectedRevision}),
  reviseItemEta: (spaceId:string,bookingId:string,estimatedReadyAt:string,reason:string,expectedRevision:number) =>
    post("/workspaces/"+encodeURIComponent(spaceId)+"/bookings/"+encodeURIComponent(bookingId)+"/estimate",
      {estimatedReadyAt,reason,expectedRevision}),
  confirmItemReceipt: (bookingId:string,expectedRevision:number) =>
    post("/bookings/"+encodeURIComponent(bookingId)+"/confirm-item-receipt",{expectedRevision}),
  roster: (id: string) => json<AdaptiveRoster>("/workspaces/" + encodeURIComponent(id) + "/roster"),
  rosterSettings: (id: string, input: { stationCapacity: number; rosterEnabled: boolean }) =>
    json<{ stationCapacity: number; rosterEnabled: boolean; affectedExistingBookings: number }>(
      "/workspaces/" + encodeURIComponent(id) + "/roster-settings",
      { method: "PATCH", body: JSON.stringify(input) }),
  addStaff: (id: string, input: { displayName: string; weeklyHours: WeeklyShift[] }) =>
    post<{ staff: AdaptiveStaff; affectedExistingBookings: number }>(
      "/workspaces/" + encodeURIComponent(id) + "/staff", input),
  updateStaff: (id: string, staffId: string, input: { displayName: string; weeklyHours: WeeklyShift[]; active: boolean; expectedRevision: number }) =>
    json<{ staff: AdaptiveStaff; affectedExistingBookings: number }>(
      "/workspaces/" + encodeURIComponent(id) + "/staff/" + encodeURIComponent(staffId),
      { method: "PATCH", body: JSON.stringify(input) }),
  staffLeave: (id: string, staffId: string, input: { startAt: string; endAt: string; note?: string }) =>
    post<{ leave: StaffLeave; affectedExistingBookings: number }>(
      "/workspaces/" + encodeURIComponent(id) + "/staff/" + encodeURIComponent(staffId) + "/leave",input),
  cancelStaffLeave: (id: string, staffId: string, leaveId: string) =>
    post<{ cancelled: boolean; affectedExistingBookings: number }>(
      "/workspaces/" + encodeURIComponent(id) + "/staff/" + encodeURIComponent(staffId) +
      "/leave/" + encodeURIComponent(leaveId) + "/cancel"),
  members: (id: string) => json<{
    id: string; role: string; status: string; permissions: string[];
    user: { username: string | null; displayName: string | null };
  }[]>("/workspaces/" + encodeURIComponent(id) + "/members")
};

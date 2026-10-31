/**
 * Hustle Adaptive Economy v1 shared client contract.
 * Draft: not wired to production. The current preview uses in-memory objects.
 * This file is intentionally dependency-free and can be moved to packages/shared
 * when backend integration begins.
 */
export type UUID = string;
export type ISODate = string;
export type ISODateTime = string;
export type MinorCurrencyAmount = number; // integer, e.g. NGN kobo, never floating-point naira
export type CurrencyCode = "NGN" | "USD" | "GBP" | "EUR";

export type Capability =
  | "hire" | "offer" | "sell" | "create" | "teach"
  | "manage" | "represent" | "learn";

export type BlueprintType =
  | "appointment" | "item" | "project" | "group" | "event"
  | "product" | "digital" | "recurring" | "live";

export type Permission =
  | "services.manage" | "work.manage" | "messages.reply"
  | "schedule.manage" | "finance.view";

// Never implement these as delegated permissions:
export type ProtectedAction =
  | "identity.approve" | "wallet.withdraw" | "payout.change"
  | "escrow.release" | "delegate.grant";

export type WorkspaceKind = "personal" | "business" | "team" | "agency";
export type MembershipRole = "owner" | "manager" | "worker" | "agent" | "accountant" | "assistant";
export type DelegationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export interface Principal {
  id: UUID;
  displayName: string;
  capabilities: Capability[];
  identityVerified: boolean;
}
export interface Workspace {
  id: UUID;
  ownerUserId: UUID;
  kind: WorkspaceKind;
  name: string;
  slug: string;
  category?: string;
  city?: string;
  verification: "unverified" | "pending" | "verified" | "suspended";
  version: number;
}
export interface WorkspaceMembership {
  id: UUID;
  workspaceId: UUID;
  userId: UUID;
  role: MembershipRole;
  permissions: Permission[];
  status: "invited" | "accepted" | "revoked" | "expired";
  acceptedAt?: ISODateTime;
  revokedAt?: ISODateTime;
}
export interface Delegation {
  id: UUID;
  workspaceId: UUID;
  invitingUserId: UUID;
  invitedUserId?: UUID;
  role: MembershipRole;
  permissions: Permission[];
  status: DelegationStatus;
  expiresAt: ISODateTime;
  acceptedAt?: ISODateTime;
}
export interface ServiceBlueprint {
  id: UUID;
  slug: string;
  version: number;
  type: BlueprintType;
  label: string;
  steps: string[];
  features: string[];
  requirementsSchema: Record<string, unknown>;
}
export interface Service {
  id: UUID;
  workspaceId: UUID;
  blueprintId: UUID;
  title: string;
  status: "draft" | "published" | "paused" | "archived";
  basePriceMinor: MinorCurrencyAmount;
  currency: CurrencyCode;
  policy: Record<string, unknown>;
  requirementsSchema: Record<string, unknown>;
  version: number;
}
export type WorkOrderStatus =
  | "requested" | "awaiting_approval" | "accepted"
  | "in_progress" | "ready" | "out_for_delivery"
  | "delivered" | "review" | "completed"
  | "disputed" | "cancelled" | "declined";
export interface WorkOrder {
  id: UUID;
  workspaceId: UUID;
  serviceId?: UUID;
  opportunityId?: UUID;
  clientUserId: UUID;
  blueprintType: BlueprintType;
  title: string;
  status: WorkOrderStatus;
  version: number;
  agreementVersion: number;
  requirements: Record<string, unknown>;
  handoverTerms: Record<string, unknown>;
  expectedReadyAt?: ISODateTime;
  dueAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export type WorkEventType =
  | "work.requested" | "work.accepted" | "work.declined"
  | "work.started" | "work.ready" | "work.out_for_delivery"
  | "work.delivered" | "work.completed" | "work.cancelled"
  | "work.disputed" | "work.reopened" | "quote.accepted"
  | "resource.held" | "resource.hold_expired" | "agent.grant_revoked";
export interface WorkEvent {
  id: UUID;
  workOrderId: UUID;
  actorUserId?: UUID;
  type: WorkEventType | string;
  fromStatus?: WorkOrderStatus;
  toStatus?: WorkOrderStatus;
  version: number;
  payload: Record<string, unknown>;
  createdAt: ISODateTime;
}
export interface Opportunity {
  id: UUID;
  createdBy: UUID;
  workspaceId?: UUID;
  title: string;
  description: string;
  category?: BlueprintType;
  visibility: "private" | "invited" | "public";
  status: "draft" | "open" | "shortlisted" | "closed" | "cancelled";
  budgetMinor?: MinorCurrencyAmount;
  currency: CurrencyCode;
  publicArea?: string;
}
export interface ResourceBooking {
  id: UUID;
  resourceId: UUID;
  workOrderId: UUID;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  state: "held" | "confirmed" | "released" | "cancelled";
  holdExpiresAt?: ISODateTime;
}
export interface QuoteLine {
  kind: "service" | "materials" | "travel" | "collection" | "delivery" | "fitting" | "event" | "discount" | "tax" | "other";
  description: string;
  quantity: number;
  unitMinor: MinorCurrencyAmount;
  lineMinor: MinorCurrencyAmount;
}
export interface Quote {
  id: UUID;
  workOrderId: UUID;
  version: number;
  totalMinor: MinorCurrencyAmount;
  consultationCreditMinor: MinorCurrencyAmount;
  lines: QuoteLine[];
  currency: CurrencyCode;
  status: "draft" | "offered" | "accepted" | "declined" | "expired" | "superseded";
  expiresAt?: ISODateTime;
  acceptedAt?: ISODateTime;
}
export interface Evidence {
  id: UUID;
  workOrderId: UUID;
  submittedBy: UUID;
  type: "photo" | "video" | "document" | "receipt" | "signed_handover" | "review";
  status: "submitted" | "client_confirmed" | "disputed" | "retracted";
  permissionToPublish: boolean;
  createdAt: ISODateTime;
}
export interface Paginated<T> {
  items: T[];
  nextCursor?: string;
}
export interface ApiError {
  code: "UNAUTHORIZED" | "FORBIDDEN" | "CONFLICT" | "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL";
  message: string;
  retryable?: boolean;
  currentVersion?: number;
}
export interface RequestOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
}
export interface HustleAdaptiveRepository {
  getCapabilities(): Promise<Capability[]>;
  addCapability(capability: Capability): Promise<Capability[]>;
  listWorkspaces(): Promise<Workspace[]>;
  createWorkspace(input: Pick<Workspace, "name" | "kind" | "category">, options: RequestOptions): Promise<Workspace>;
  listBlueprints(): Promise<ServiceBlueprint[]>;
  listServices(workspaceId: UUID): Promise<Service[]>;
  draftService(workspaceId: UUID, input: Omit<Service, "id" | "workspaceId" | "status" | "version">, options: RequestOptions): Promise<Service>;
  createOpportunity(input: Omit<Opportunity, "id" | "createdBy" | "status">, options: RequestOptions): Promise<Opportunity>;
  listWorkOrders(workspaceId: UUID): Promise<Paginated<WorkOrder>>;
  createWorkOrder(input: Pick<WorkOrder, "workspaceId" | "blueprintType" | "title" | "requirements"> & {serviceId?: UUID; opportunityId?: UUID}, options: RequestOptions): Promise<WorkOrder>;
  transitionWork(workOrderId: UUID, toStatus: WorkOrderStatus, expectedVersion: number, options: RequestOptions): Promise<WorkOrder>;
  requestDelegation(workspaceId: UUID, invitee: string, role: MembershipRole, permissions: Permission[], options: RequestOptions): Promise<Delegation>;
  acceptDelegation(invitationId: UUID): Promise<Delegation>;
  revokeDelegation(invitationId: UUID): Promise<Delegation>;
  listEvents(workOrderId: UUID): Promise<WorkEvent[]>;
  getNotificationPreferences(): Promise<Record<string, unknown>>;
}
/**
 * Security notes:
 * - Repository calls must attach current JWT (not service-role secrets).
 * - Workspace permissions and status transitions are validated again server-side.
 * - Never trust view-only client permission checks.
 * - Quote acceptance and money movement require separate authoritative endpoints.
 * - UI prototype types do not grant entitlement to any backend records.
 */

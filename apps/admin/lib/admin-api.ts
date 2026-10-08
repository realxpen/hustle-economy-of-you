export type SafetyStatus = "OPEN" | "UNDER_REVIEW" | "ACTIONED" | "DISMISSED";

export type SafetyUser = {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type SafetyReport = {
  id: string;
  subjectType: "BOOKING" | "ORDER" | "PROFILE" | "CONVERSATION";
  subjectId: string;
  reporterUserId: string;
  targetUserId: string;
  category: string;
  details: string;
  status: SafetyStatus;
  moderationNote: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  target: SafetyUser;
  reporter: SafetyUser;
};

export type AdminSafetyOverview = {
  reports: {
    total: number;
    open: number;
    underReview: number;
    actioned: number;
    dismissed: number;
  };
  privateFeedbackCount: number;
  activeBlockRelationships: number;
  usersNeedingReview: Array<{ target: SafetyUser; count: number }>;
  recentReports: SafetyReport[];
};

export type UserSafetySummary = {
  user: SafetyUser & {
    createdAt: string;
    capabilities: Array<{ capability: string; status: string }>;
    reputation: unknown;
  };
  assessment: "REVIEW_RECOMMENDED" | "NO_ESTABLISHED_PATTERN";
  policy: { automaticPunitiveAction: false; statement: string };
  reports: {
    total: number;
    uniqueReporters: number;
    statusCounts: Record<string, number>;
    categoryCounts: Record<string, number>;
    contextCounts: Record<string, number>;
    recent: SafetyReport[];
  };
  privateFeedback: {
    total: number;
    wouldWorkAgain: number;
    wouldNotWorkAgain: number;
    averageExperienceRating: number | null;
    issueCounts: Record<string, number>;
    recent: Array<{
      id: string;
      subjectType: string;
      subjectId: string;
      wouldWorkAgain: boolean;
      experienceRating: number | null;
      issueCategories: string[];
      privateNote: string | null;
      transactionStatusSnapshot: string;
      createdAt: string;
      author: SafetyUser;
    }>;
  };
  platformEvidence: {
    blocksReceived: number;
    bookings: { total: number; cancelledByUser: number; disputed: number; refunded: number };
    orders: {
      asBuyer: number;
      asSeller: number;
      buyerCancelled: number;
      buyerRefunded: number;
      sellerCancelled: number;
      sellerRefunded: number;
    };
  };
  indicators: Array<{
    code: string;
    level: "INFORMATIONAL" | "REVIEW";
    label: string;
    explanation: string;
    evidence: Record<string, number | string | boolean>;
  }>;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function adminFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(`${apiBase}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string }; message?: string } | null;
    throw new Error(body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const getSafetyOverview = (token: string) =>
  adminFetch<AdminSafetyOverview>(token, "/admin/trust-safety/overview");

export const listSafetyReports = (token: string, status?: SafetyStatus) =>
  adminFetch<SafetyReport[]>(token, `/admin/trust-safety/reports?limit=100${status ? `&status=${status}` : ""}`);

export const getUserSafetySummary = (token: string, userId: string) =>
  adminFetch<UserSafetySummary>(token, `/admin/trust-safety/users/${encodeURIComponent(userId)}/summary`);

export const updateSafetyReport = (
  token: string,
  reportId: string,
  input: { status: SafetyStatus; moderationNote?: string }
) => adminFetch<SafetyReport>(token, `/admin/trust-safety/reports/${encodeURIComponent(reportId)}`, {
  method: "PATCH",
  body: JSON.stringify(input)
});


export type OperationsOverview = {
  generatedAt: string;
  users: {
    total: number;
    activeCapabilities: Record<string, number>;
  };
  applications: {
    hustler: Record<string, number>;
    agent: Record<string, number>;
    needsReview: number;
  };
  marketplace: {
    bookings: Record<string, number>;
    orders: Record<string, number>;
  };
  finance: {
    paymentAttempts: Record<string, number>;
    escrow: Record<string, number>;
    payouts: Record<string, number>;
    refunds: Record<string, number>;
  };
  safety: {
    reports: Record<string, number>;
    unresolved: number;
  };
  content: {
    posts: number;
    stories: number;
    liveSessions: number;
  };
  audit: {
    systemEvents: number;
  };
};

export type AdminCapability = {
  capability: string;
  status: string;
  enabledAt: string;
  updatedAt: string;
};

export type AdminUserListItem = {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  onboardingCompleted: boolean;
  avatarUrl: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
  capabilities: AdminCapability[];
  hustlerApplication: {
    id: string;
    status: string;
    identityVerificationStatus: string;
    submittedAt: string | null;
    reviewedAt: string | null;
  } | null;
  agentApplication: {
    id: string;
    status: string;
    identityVerificationStatus: string;
    submittedAt: string | null;
    reviewedAt: string | null;
  } | null;
  professionalProfile: {
    id: string;
    status: string;
    primarySkill: string | null;
    category: string | null;
    publishedAt: string | null;
  } | null;
  reputation: {
    ratingSum: number;
    reviewCount: number;
    verifiedReviewCount: number;
    bookingReviewCount: number;
    orderReviewCount: number;
    lastReviewAt: string | null;
    updatedAt: string;
  } | null;
};

export type AdminUserDetail = {
  user: AdminUserListItem;
  activity: {
    bookings: { asClient: number; asHustler: number };
    orders: { asBuyer: number; asSeller: number };
    content: { posts: number; services: number; products: number };
    conversations: number;
  };
  trustSafety: {
    reportsReceived: number;
    blocksCreated: number;
    blocksReceived: number;
  };
  agent: {
    activeRepresentationsAsAgent: number;
    activeAgentsRepresentingUser: number;
  };
};

export type AdminApplicationQueues = {
  hustler: Array<{
    id: string;
    status: string;
    primarySkill: string | null;
    category: string | null;
    identityVerificationStatus: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    user: {
      id: string;
      displayName: string | null;
      username: string | null;
      email: string | null;
      phone: string | null;
    };
  }>;
  agent: Array<{
    id: string;
    status: string;
    operatingArea: string | null;
    organizationName: string | null;
    identityVerificationStatus: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    user: {
      id: string;
      displayName: string | null;
      username: string | null;
      email: string | null;
      phone: string | null;
    };
  }>;
};

export type AdminBookingItem = {
  id: string;
  status: string;
  serviceTitleSnapshot: string;
  agreedPriceMinor: number;
  currency: string;
  requestedStartAt: string;
  confirmedStartAt: string | null;
  fundedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  disputedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; displayName: string | null; username: string | null };
  hustler: { id: string; displayName: string | null; username: string | null };
};

export type AdminOrderItem = {
  id: string;
  status: string;
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  paidAt: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  buyer: { id: string; displayName: string | null; username: string | null };
  seller: { id: string; displayName: string | null; username: string | null };
  _count: { items: number };
};

export type AdminFinancialSnapshot = {
  payments: Array<{
    id: string;
    subjectType: string;
    subjectId: string;
    payerUserId: string;
    beneficiaryUserId: string;
    provider: string;
    providerReference: string;
    status: string;
    amountMinor: number;
    currency: string;
    confirmedAt: string | null;
    domainAppliedAt: string | null;
    failedAt: string | null;
    failureCode: string | null;
    failureReason: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  escrows: Array<{
    id: string;
    subjectType: string;
    subjectId: string;
    paymentAttemptId: string;
    beneficiaryUserId: string;
    amountMinor: number;
    currency: string;
    status: string;
    heldAt: string | null;
    releasedAt: string | null;
    refundedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  payouts: Array<{
    id: string;
    userId: string;
    currency: string;
    amountMinor: number;
    status: string;
    provider: string;
    providerReference: string | null;
    requestedAt: string;
    confirmedAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  refunds: Array<{
    id: string;
    subjectType: string;
    subjectId: string;
    paymentAttemptId: string;
    requestedByUserId: string | null;
    currency: string;
    amountMinor: number;
    status: string;
    providerReference: string | null;
    requestedAt: string;
    confirmedAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type AdminAuditEvent = {
  id: string;
  name: string;
  source: string;
  payload: unknown;
  occurredAt: string;
  createdAt: string;
};

export const getOperationsOverview = (token: string) =>
  adminFetch<OperationsOverview>(token, "/admin/operations/overview");

export const searchAdminUsers = (
  token: string,
  query = "",
  limit = 30
) =>
  adminFetch<AdminUserListItem[]>(
    token,
    `/admin/operations/users?limit=${limit}${query ? `&q=${encodeURIComponent(query)}` : ""}`
  );

export const getAdminUserDetail = (token: string, userId: string) =>
  adminFetch<AdminUserDetail>(
    token,
    `/admin/operations/users/${encodeURIComponent(userId)}`
  );

export const getAdminApplicationQueues = (token: string, limit = 50) =>
  adminFetch<AdminApplicationQueues>(
    token,
    `/admin/operations/applications?limit=${limit}`
  );

export const listAdminBookings = (
  token: string,
  status?: string,
  limit = 50
) =>
  adminFetch<AdminBookingItem[]>(
    token,
    `/admin/operations/bookings?limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ""}`
  );

export const listAdminOrders = (
  token: string,
  status?: string,
  limit = 50
) =>
  adminFetch<AdminOrderItem[]>(
    token,
    `/admin/operations/orders?limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ""}`
  );

export const getAdminFinancialSnapshot = (token: string, limit = 30) =>
  adminFetch<AdminFinancialSnapshot>(
    token,
    `/admin/operations/finance?limit=${limit}`
  );

export const listAdminAuditEvents = (
  token: string,
  name = "",
  limit = 100
) =>
  adminFetch<AdminAuditEvent[]>(
    token,
    `/admin/operations/audit?limit=${limit}${name ? `&name=${encodeURIComponent(name)}` : ""}`
  );


export type AdminApplicationProof = {
  id: string;
  applicationId: string;
  type: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: string;
};

export type AdminReviewUser = {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  capabilities?: AdminCapability[];
  assistedRegistration?: {
    id: string;
    status: string;
    consentMethod: string;
    consentNote?: string | null;
    consentConfirmedAt: string;
    claimedAt?: string | null;
    agent: {
      id: string;
      displayName: string | null;
      username: string | null;
      email: string | null;
    };
  } | null;
};

export type AdminReviewRecord = {
  id: string;
  userId: string;
  status: string;
  identityVerificationStatus: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  user: AdminReviewUser;
  reviewer?: {
    id: string;
    displayName: string | null;
    username: string | null;
    email: string | null;
  } | null;
  proofs: AdminApplicationProof[];
  primarySkill?: string | null;
  category?: string | null;
  experienceSummary?: string | null;
  yearsExperience?: number | null;
  businessName?: string | null;
  businessInfo?: string | null;
  motivation?: string | null;
  operatingArea?: string | null;
  organizationName?: string | null;
  organizationInfo?: string | null;
};

export type AdminProofReadUrl = {
  url: string;
  expiresInSeconds: number;
  proof: {
    id: string;
    fileName: string;
    type: string;
    mimeType: string;
    sizeBytes: number | null;
  };
};

export const getHustlerAdminReview = (token: string, applicationId: string) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/hustler-reviews/${encodeURIComponent(applicationId)}`
  );

export const startHustlerAdminReview = (token: string, applicationId: string) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/hustler-reviews/${encodeURIComponent(applicationId)}/start`,
    { method: "POST" }
  );

export const setHustlerAdminVerification = (
  token: string,
  applicationId: string,
  status: "VERIFIED" | "REJECTED"
) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/hustler-reviews/${encodeURIComponent(applicationId)}/verification`,
    { method: "POST", body: JSON.stringify({ status }) }
  );

export const getHustlerAdminProofReadUrl = (
  token: string,
  applicationId: string,
  proofId: string
) =>
  adminFetch<AdminProofReadUrl>(
    token,
    `/hustler-reviews/${encodeURIComponent(applicationId)}/proofs/${encodeURIComponent(proofId)}/read-url`,
    { method: "POST" }
  );

export const approveHustlerAdminApplication = (
  token: string,
  applicationId: string,
  notes?: string
) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/hustler-reviews/${encodeURIComponent(applicationId)}/approve`,
    { method: "POST", body: JSON.stringify({ notes: notes || null }) }
  );

export const rejectHustlerAdminApplication = (
  token: string,
  applicationId: string,
  rejectionReason: string,
  notes?: string
) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/hustler-reviews/${encodeURIComponent(applicationId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        rejectionReason,
        notes: notes || null
      })
    }
  );

export const getAgentAdminReview = (token: string, applicationId: string) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/admin/agent-applications/${encodeURIComponent(applicationId)}`
  );

export const startAgentAdminReview = (token: string, applicationId: string) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/admin/agent-applications/${encodeURIComponent(applicationId)}/start`,
    { method: "POST" }
  );

export const setAgentAdminVerification = (
  token: string,
  applicationId: string,
  status: "VERIFIED" | "REJECTED"
) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/admin/agent-applications/${encodeURIComponent(applicationId)}/verification`,
    { method: "POST", body: JSON.stringify({ status }) }
  );

export const getAgentAdminProofReadUrl = (
  token: string,
  applicationId: string,
  proofId: string
) =>
  adminFetch<AdminProofReadUrl>(
    token,
    `/admin/agent-applications/${encodeURIComponent(applicationId)}/proofs/${encodeURIComponent(proofId)}/read-url`,
    { method: "POST" }
  );

export const approveAgentAdminApplication = (
  token: string,
  applicationId: string,
  notes?: string
) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/admin/agent-applications/${encodeURIComponent(applicationId)}/approve`,
    { method: "POST", body: JSON.stringify({ notes: notes || null }) }
  );

export const rejectAgentAdminApplication = (
  token: string,
  applicationId: string,
  rejectionReason: string,
  notes?: string
) =>
  adminFetch<AdminReviewRecord>(
    token,
    `/admin/agent-applications/${encodeURIComponent(applicationId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        rejectionReason,
        notes: notes || null
      })
    }
  );

export const suspendAdminCapability = (
  token: string,
  userId: string,
  capability: "HUSTLER" | "AGENT",
  reason: string
) =>
  adminFetch<AdminUserDetail>(
    token,
    `/admin/operations/users/${encodeURIComponent(userId)}/capabilities/${capability}/suspend`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );

export const reactivateAdminCapability = (
  token: string,
  userId: string,
  capability: "HUSTLER" | "AGENT",
  reason: string
) =>
  adminFetch<AdminUserDetail>(
    token,
    `/admin/operations/users/${encodeURIComponent(userId)}/capabilities/${capability}/reactivate`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );


export type MarketplaceCaseSubjectType = "BOOKING" | "ORDER";
export type MarketplaceCaseStatus = "OPEN" | "IN_REVIEW" | "WAITING_INFORMATION" | "RESOLVED" | "CLOSED";
export type MarketplaceCasePriority = "LOW" | "NORMAL" | "HIGH";
export type MarketplaceCasePerson = {
  id: string;
  displayName: string | null;
  username: string | null;
};
export type MarketplaceCaseListItem = {
  id: string;
  subjectType: MarketplaceCaseSubjectType;
  subjectId: string;
  title: string;
  summary: string;
  status: MarketplaceCaseStatus;
  priority: MarketplaceCasePriority;
  openedByUserId: string;
  assignedToUserId: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  openedBy: MarketplaceCasePerson;
  assignedTo: MarketplaceCasePerson | null;
  _count: { notes: number };
};
export type MarketplaceCaseDetail = Omit<MarketplaceCaseListItem, "_count"> & {
  notes: Array<{
    id: string;
    caseId: string;
    authorUserId: string;
    body: string;
    createdAt: string;
    author: MarketplaceCasePerson;
  }>;
  subject: {
    id: string;
    status: string;
    currency: string;
    createdAt: string;
    agreedPriceMinor?: number;
    totalMinor?: number;
    serviceTitleSnapshot?: string;
    clientUserId?: string;
    hustlerUserId?: string;
    buyerUserId?: string;
    sellerUserId?: string;
    payment: {
      id: string;
      status: string;
      amountMinor: number;
      currency: string;
      escrow: {
        status: string;
        amountMinor: number;
        currency: string;
      } | null;
    } | null;
  };
};
export type MarketplaceCasePage = {
  items: MarketplaceCaseListItem[];
  hasMore: boolean;
  nextCursor: string | null;
};
export type MarketplaceCaseOverview = {
  byStatus: Record<string, number>;
  openByPriority: Record<string, number>;
};

export const getMarketplaceCaseOverview = (token: string) =>
  adminFetch<MarketplaceCaseOverview>(token, "/admin/operations/cases/overview");

export const listMarketplaceCases = (
  token: string,
  options: { status?: string; subjectType?: string; cursor?: string | null; limit?: number } = {}
) => {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 30));
  if (options.status) params.set("status", options.status);
  if (options.subjectType) params.set("subjectType", options.subjectType);
  if (options.cursor) params.set("cursor", options.cursor);
  return adminFetch<MarketplaceCasePage>(token, `/admin/operations/cases?${params.toString()}`);
};

export const getMarketplaceCase = (token: string, caseId: string) =>
  adminFetch<MarketplaceCaseDetail>(token, `/admin/operations/cases/${encodeURIComponent(caseId)}`);

export const createMarketplaceCase = (
  token: string,
  input: {
    subjectType: MarketplaceCaseSubjectType;
    subjectId: string;
    title: string;
    summary: string;
    priority: MarketplaceCasePriority;
  }
) => adminFetch<MarketplaceCaseDetail>(token, "/admin/operations/cases", {
  method: "POST",
  body: JSON.stringify(input)
});

export const claimMarketplaceCase = (token: string, caseId: string) =>
  adminFetch<MarketplaceCaseDetail>(
    token, `/admin/operations/cases/${encodeURIComponent(caseId)}/claim`,
    { method: "POST" }
  );

export const releaseMarketplaceCase = (token: string, caseId: string) =>
  adminFetch<MarketplaceCaseDetail>(
    token, `/admin/operations/cases/${encodeURIComponent(caseId)}/release`,
    { method: "POST" }
  );

export const updateMarketplaceCase = (
  token: string,
  caseId: string,
  input: { status?: MarketplaceCaseStatus; priority?: MarketplaceCasePriority; reason: string }
) => adminFetch<MarketplaceCaseDetail>(
  token, `/admin/operations/cases/${encodeURIComponent(caseId)}`,
  { method: "PATCH", body: JSON.stringify(input) }
);

export const addMarketplaceCaseNote = (
  token: string,
  caseId: string,
  body: string
) => adminFetch<MarketplaceCaseDetail>(
  token, `/admin/operations/cases/${encodeURIComponent(caseId)}/notes`,
  { method: "POST", body: JSON.stringify({ body }) }
);

export const getMarketplaceCaseViewer = (token: string) =>
  adminFetch<{ userId: string }>(token, "/admin/operations/cases/viewer");


export type ModerationSubjectType = "POST" | "SERVICE" | "PRODUCT";
export type ModerationState = "CLEAR" | "HELD";
export type ModerationPerson = {
  id: string;
  username: string | null;
  displayName: string | null;
};
export type ModerationContent = {
  id: string;
  subjectType: ModerationSubjectType;
  title: string;
  status: string;
  moderationState: ModerationState;
  updatedAt?: string;
  owner: ModerationPerson;
};
export type ModerationAction = {
  id: string;
  subjectType: ModerationSubjectType;
  subjectId: string;
  ownerUserId: string;
  actorUserId: string;
  action: "HOLD" | "RELEASE";
  reason: string;
  previousStatus: string;
  resultingStatus: string;
  createdAt: string;
  actor: ModerationPerson;
};
export type ModerationDetail = {
  subjectType: ModerationSubjectType;
  subject: Omit<ModerationContent, "subjectType">;
  history: ModerationAction[];
};
export type ModerationOverview = {
  holds: Record<ModerationSubjectType, number>;
  recent: ModerationAction[];
};

export const getModerationOverview = (token: string) =>
  adminFetch<ModerationOverview>(token, "/admin/operations/moderation/overview");

export const listModerationContent = (
  token: string,
  type: ModerationSubjectType,
  state?: ModerationState | "",
  limit = 40
) =>
  adminFetch<ModerationContent[]>(
    token,
    `/admin/operations/moderation/content?type=${type}&limit=${limit}${state ? `&state=${state}` : ""}`
  );

export const getModerationDetail = (token: string, type: ModerationSubjectType, id: string) =>
  adminFetch<ModerationDetail>(
    token,
    `/admin/operations/moderation/${type}/${encodeURIComponent(id)}`
  );

export const applyModerationHold = (
  token: string, type: ModerationSubjectType, id: string, reason: string
) => adminFetch<ModerationDetail>(
  token, `/admin/operations/moderation/${type}/${encodeURIComponent(id)}/hold`,
  { method: "POST", body: JSON.stringify({ reason }) }
);

export const releaseModerationHold = (
  token: string, type: ModerationSubjectType, id: string, reason: string
) => adminFetch<ModerationDetail>(
  token, `/admin/operations/moderation/${type}/${encodeURIComponent(id)}/release`,
  { method: "POST", body: JSON.stringify({ reason }) }
);

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

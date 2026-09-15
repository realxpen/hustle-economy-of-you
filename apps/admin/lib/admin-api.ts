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

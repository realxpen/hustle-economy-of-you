"use client";

import { authenticatedFetch } from "./api/authenticated-fetch";

export type EnforcementAppealActionType =
  | "CONTENT_HOLD"
  | "CAPABILITY_SUSPENSION";
export type EnforcementAppealStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "DECIDED"
  | "CLOSED";
export type EnforcementAppealDecision = "UPHELD" | "OVERTURNED";

export type AppealPerson = {
  id: string;
  displayName: string | null;
  username: string | null;
};

export type EligibleAppealTarget = {
  actionType: EnforcementAppealActionType;
  enforcementRef: string;
  targetKind: string;
  targetId: string;
  label: string;
  enforcementReason: string;
  enforcedAt: string;
  originalActor: AppealPerson;
  existingAppeal: {
    id: string;
    status: EnforcementAppealStatus;
  } | null;
};

export type EnforcementAppeal = {
  id: string;
  actionType: EnforcementAppealActionType;
  enforcementRef: string;
  targetKind: string;
  targetId: string;
  reason: string;
  status: EnforcementAppealStatus;
  decision: EnforcementAppealDecision | null;
  decisionReason: string | null;
  submittedAt: string;
  reviewStartedAt: string | null;
  decidedAt: string | null;
  closedAt: string | null;
  appellant: AppealPerson;
  originalActor: AppealPerson;
  reviewer: AppealPerson | null;
};

export async function getEligibleAppeals() {
  const response = await authenticatedFetch("/appeals/eligible");
  return response.json() as Promise<{
    content: EligibleAppealTarget[];
    capability: EligibleAppealTarget[];
  }>;
}

export async function getMyEnforcementAppeals() {
  const response = await authenticatedFetch("/appeals/mine");
  return response.json() as Promise<EnforcementAppeal[]>;
}

export async function submitEnforcementAppeal(
  actionType: EnforcementAppealActionType,
  enforcementRef: string,
  reason: string
) {
  const response = await authenticatedFetch("/appeals", {
    method: "POST",
    body: JSON.stringify({ actionType, enforcementRef, reason })
  });
  return response.json() as Promise<EnforcementAppeal>;
}

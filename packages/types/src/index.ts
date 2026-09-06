export type DependencyState = "connected" | "not_configured" | "unavailable";

export interface FoundationHealth {
  service: "hustle-api";
  status: "ok" | "degraded";
  environment: string;
  timestamp: string;
  dependencies: {
    database: DependencyState;
    redis: DependencyState;
    auth: DependencyState;
    storage: DependencyState;
  };
}

export interface AnalyticsEvent<TPayload = Record<string, unknown>> {
  name: string;
  occurredAt: string;
  source: "mobile" | "web" | "admin" | "api";
  anonymousId?: string;
  userId?: string;
  payload?: TPayload;
}

export type Capability = "CLIENT" | "HUSTLER" | "AGENT";
export type CapabilityStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface HustleCapability {
  capability: Capability;
  status: CapabilityStatus;
  enabledAt: string;
}

export interface HustleAccount {
  id: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  displayName: string | null;
  username: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  capabilities: HustleCapability[];
  createdAt: string;
  updatedAt: string;
}

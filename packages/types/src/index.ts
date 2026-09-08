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

export type HustlerApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export type VerificationStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED";

export type HustlerProofType =
  | "PORTFOLIO"
  | "IDENTITY_DOCUMENT"
  | "CERTIFICATE"
  | "BUSINESS_DOCUMENT"
  | "OTHER";

export interface HustlerApplicationProof {
  id: string;
  applicationId: string;
  type: HustlerProofType;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: string;
}

export interface HustlerApplication {
  id: string;
  userId: string;
  status: HustlerApplicationStatus;
  primarySkill: string | null;
  category: string | null;
  experienceSummary: string | null;
  yearsExperience: number | null;
  businessName: string | null;
  businessInfo: string | null;
  identityVerificationStatus: VerificationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerId: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  proofs: HustlerApplicationProof[];
}

export interface SaveHustlerApplicationInput {
  primarySkill?: string | null;
  category?: string | null;
  experienceSummary?: string | null;
  yearsExperience?: number | null;
  businessName?: string | null;
  businessInfo?: string | null;
}

export type ProfessionalProfileStatus = "DRAFT" | "PUBLISHED";

export interface ProfessionalProfile {
  id: string;
  userId: string;
  headline: string | null;
  coverUrl: string | null;
  primarySkill: string | null;
  secondarySkills: string[];
  category: string | null;
  professionalSummary: string | null;
  yearsExperience: number | null;
  status: ProfessionalProfileStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveProfessionalProfileInput {
  headline?: string | null;
  coverUrl?: string | null;
  primarySkill?: string | null;
  secondarySkills?: string[];
  category?: string | null;
  professionalSummary?: string | null;
  yearsExperience?: number | null;
}

export interface PublicProfessionalProfile {
  user: {
    id: string;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
    verified: boolean;
    capabilities: HustleCapability[];
  };
  profile: ProfessionalProfile;
}

export type ServiceStatus = "DRAFT" | "PUBLISHED" | "PAUSED";
export type ServicePricingType = "FIXED" | "STARTING_AT" | "HOURLY";
export type ServiceDeliveryMode = "REMOTE" | "PHYSICAL" | "BOTH";

export interface Service {
  id: string;
  professionalProfileId: string;
  title: string | null;
  category: string | null;
  description: string | null;
  mediaUrls: string[];
  priceMinor: number | null;
  currency: string;
  pricingType: ServicePricingType;
  deliveryMode: ServiceDeliveryMode;
  location: string | null;
  availabilityNote: string | null;
  deliveryTime: string | null;
  requirements: string | null;
  status: ServiceStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveServiceInput {
  title?: string | null;
  category?: string | null;
  description?: string | null;
  mediaUrls?: string[];
  priceMinor?: number | null;
  pricingType?: ServicePricingType;
  deliveryMode?: ServiceDeliveryMode;
  location?: string | null;
  availabilityNote?: string | null;
  deliveryTime?: string | null;
  requirements?: string | null;
}

export interface PublicService {
  service: Service;
  owner: {
    id: string;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
    verified: boolean;
    professionalProfile: {
      id: string;
      headline: string | null;
      primarySkill: string | null;
      secondarySkills: string[];
      category: string | null;
      professionalSummary: string | null;
      yearsExperience: number | null;
    };
  };
}

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

export type ProductType = "PHYSICAL" | "DIGITAL";
export type ProductStatus = "DRAFT" | "PUBLISHED" | "PAUSED";

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  optionValues: Record<string, string> | null;
  priceOverrideMinor: number | null;
  inventoryQuantity: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  professionalProfileId: string;
  title: string | null;
  description: string | null;
  category: string | null;
  mediaUrls: string[];
  type: ProductType;
  priceMinor: number | null;
  currency: string;
  trackInventory: boolean;
  inventoryQuantity: number | null;
  deliveryInformation: string | null;
  status: ProductStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
}

export interface SaveProductInput {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  mediaUrls?: string[];
  type?: ProductType;
  priceMinor?: number | null;
  trackInventory?: boolean;
  inventoryQuantity?: number | null;
  deliveryInformation?: string | null;
}

export interface SaveProductVariantInput {
  name?: string;
  sku?: string | null;
  optionValues?: Record<string, string>;
  priceOverrideMinor?: number | null;
  inventoryQuantity?: number | null;
  isActive?: boolean;
}

export type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type PostMediaType = "IMAGE" | "VIDEO";

export interface PostMedia {
  id: string;
  postId: string;
  type: PostMediaType;
  storageKey: string | null;
  mediaUrl: string | null;
  position: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  createdAt: string;
}

export interface PostServiceAttachment {
  postId: string;
  serviceId: string;
  createdAt: string;
  service: Service;
}

export interface PostProductAttachment {
  postId: string;
  productId: string;
  createdAt: string;
  product: Product;
}

export interface Post {
  id: string;
  professionalProfileId: string;
  caption: string | null;
  category: string | null;
  location: string | null;
  tags: string[];
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: PostMedia[];
  serviceAttachments: PostServiceAttachment[];
  productAttachments: PostProductAttachment[];
}

export interface SavePostInput {
  caption?: string | null;
  category?: string | null;
  location?: string | null;
  tags?: string[];
}

export interface AddPostMediaInput {
  type: PostMediaType;
  storageKey?: string | null;
  mediaUrl?: string | null;
  position?: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

export interface PublicPost {
  post: Post;
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

"use client";

import type { PublicTrustSummary } from "./trust";

export interface StorefrontUser {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  verified: boolean;
}

export interface StorefrontProfile {
  id: string;
  headline: string | null;
  coverUrl: string | null;
  primarySkill: string | null;
  secondarySkills: string[];
  category: string | null;
  professionalSummary: string | null;
  yearsExperience: number | null;
  publishedAt: string | null;
}

export interface StorefrontService {
  id: string;
  title: string | null;
  category: string | null;
  description: string | null;
  mediaUrls: string[];
  priceMinor: number | null;
  currency: string;
  pricingType: "FIXED" | "STARTING_AT" | "HOURLY";
  deliveryMode: "REMOTE" | "PHYSICAL" | "BOTH";
  location: string | null;
  availabilityNote: string | null;
  deliveryTime: string | null;
  publishedAt: string | null;
}

export interface StorefrontProductVariant {
  id: string;
  name: string;
  optionValues: Record<string, string> | null;
  priceOverrideMinor: number | null;
  inventoryQuantity: number | null;
}

export interface StorefrontProduct {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  mediaUrls: string[];
  type: "PHYSICAL" | "DIGITAL";
  priceMinor: number | null;
  currency: string;
  trackInventory: boolean;
  inventoryQuantity: number | null;
  deliveryInformation: string | null;
  publishedAt: string | null;
  variants: StorefrontProductVariant[];
  inStock: boolean;
}

export interface StorefrontPost {
  id: string;
  caption: string | null;
  category: string | null;
  location: string | null;
  tags: string[];
  publishedAt: string | null;
  media: Array<{
    id: string;
    type: "IMAGE" | "VIDEO";
    mediaUrl: string | null;
    position: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
  }>;
  serviceAttachments: Array<{
    service: Pick<StorefrontService, "id" | "title" | "priceMinor" | "currency" | "pricingType">;
  }>;
  productAttachments: Array<{
    product: Pick<StorefrontProduct, "id" | "title" | "priceMinor" | "currency">;
  }>;
  _count: {
    likes: number;
    comments: number;
  };
}

export interface PublicStorefront {
  user: StorefrontUser;
  profile: StorefrontProfile;
  socialProof: {
    followerCount: number;
  };
  counts: {
    services: number;
    products: number;
    posts: number;
    verifiedReviews: number;
  };
  services: StorefrontService[];
  products: StorefrontProduct[];
  posts: StorefrontPost[];
  trust: PublicTrustSummary;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

export async function getPublicStorefront(username: string): Promise<PublicStorefront> {
  const response = await fetch(
    `${apiBase}/storefronts/${encodeURIComponent(username.replace(/^@/, ""))}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    if (response.status === 404) throw new Error("This Hustle storefront is not published yet.");
    throw new Error(await parseError(response));
  }
  return response.json() as Promise<PublicStorefront>;
}

export function formatStorefrontMoney(amountMinor: number | null, currency = "NGN") {
  if (amountMinor === null) return "Price on request";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2
  }).format(amountMinor / 100);
}

export function formatStorefrontServicePrice(service: Pick<StorefrontService, "priceMinor" | "currency" | "pricingType">) {
  const value = formatStorefrontMoney(service.priceMinor, service.currency);
  if (service.priceMinor === null) return value;
  if (service.pricingType === "STARTING_AT") return `From ${value}`;
  if (service.pricingType === "HOURLY") return `${value} / hour`;
  return value;
}

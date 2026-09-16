import type { Metadata } from "next";
import type { ReactNode } from "react";

import { StorefrontDistributionDock } from "../../../components/storefront/storefront-distribution-dock";
import { getCanonicalStorefrontUrl, getStorefrontWebOrigin } from "../../../lib/storefront-url";

type StorefrontMetadataPayload = {
  user: {
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
    location: string | null;
    verified: boolean;
  };
  profile: {
    headline: string | null;
    coverUrl: string | null;
    professionalSummary: string | null;
    primarySkill: string | null;
  };
  counts: {
    services: number;
    products: number;
    posts: number;
    verifiedReviews: number;
  };
  products: Array<{ mediaUrls: string[] }>;
  posts: Array<{ media: Array<{ type: "IMAGE" | "VIDEO"; mediaUrl: string | null }> }>;
  trust: {
    reputation: {
      averageRating: number | null;
      verifiedReviewCount: number;
    };
  };
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function firstSocialImage(storefront: StorefrontMetadataPayload) {
  if (storefront.profile.coverUrl) return storefront.profile.coverUrl;
  if (storefront.user.avatarUrl) return storefront.user.avatarUrl;
  for (const product of storefront.products) {
    if (product.mediaUrls[0]) return product.mediaUrls[0];
  }
  for (const post of storefront.posts) {
    const image = post.media.find((item) => item.type === "IMAGE" && item.mediaUrl);
    if (image?.mediaUrl) return image.mediaUrl;
  }
  return null;
}

function descriptionFor(storefront: StorefrontMetadataPayload) {
  const base = storefront.profile.professionalSummary?.trim()
    || storefront.profile.headline?.trim()
    || `View @${storefront.user.username ?? "this Hustler"} on Hustle.`;
  const proof = storefront.trust.reputation.verifiedReviewCount > 0
    ? ` ${storefront.trust.reputation.verifiedReviewCount} verified review${storefront.trust.reputation.verifiedReviewCount === 1 ? "" : "s"}.`
    : "";
  const offers = ` ${storefront.counts.services} service${storefront.counts.services === 1 ? "" : "s"}, ${storefront.counts.products} product${storefront.counts.products === 1 ? "" : "s"}, ${storefront.counts.posts} published work item${storefront.counts.posts === 1 ? "" : "s"}.`;
  return `${base}${proof}${offers}`.replace(/\s+/g, " ").slice(0, 220);
}

async function loadStorefront(username: string): Promise<StorefrontMetadataPayload | null> {
  try {
    const response = await fetch(
      `${apiBase}/storefronts/${encodeURIComponent(username.replace(/^@/, ""))}`,
      { cache: "no-store" }
    );
    if (!response.ok) return null;
    return response.json() as Promise<StorefrontMetadataPayload>;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const normalized = username.replace(/^@/, "");
  const storefront = await loadStorefront(normalized);
  const canonical = getCanonicalStorefrontUrl(normalized);

  if (!storefront) {
    return {
      metadataBase: new URL(getStorefrontWebOrigin()),
      title: `@${normalized} on Hustle`,
      description: "View this Hustle storefront.",
      alternates: { canonical },
      robots: { index: false, follow: false }
    };
  }

  const displayName = storefront.user.displayName ?? `@${storefront.user.username ?? normalized}`;
  const headline = storefront.profile.headline ?? storefront.profile.primarySkill ?? "Hustler";
  const title = `${displayName} — ${headline} | Hustle`;
  const description = descriptionFor(storefront);
  const image = firstSocialImage(storefront);
  const rating = storefront.trust.reputation.averageRating;

  return {
    metadataBase: new URL(getStorefrontWebOrigin()),
    title,
    description,
    alternates: { canonical },
    keywords: [
      displayName,
      headline,
      storefront.profile.primarySkill ?? "Hustler",
      "Hustle",
      "The Economy of You"
    ],
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "Hustle — The Economy of You",
      ...(image ? { images: [{ url: image, alt: `${displayName} on Hustle` }] } : {})
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {})
    },
    other: {
      "hustle:storefront": "true",
      "hustle:username": storefront.user.username ?? normalized,
      "hustle:verified_reviews": String(storefront.counts.verifiedReviews),
      ...(rating !== null ? { "hustle:rating": rating.toFixed(2) } : {})
    }
  };
}

export default async function StorefrontLayout({
  children,
  params
}: Readonly<{
  children: ReactNode;
  params: Promise<{ username: string }>;
}>) {
  const { username } = await params;
  return <>
    {children}
    <StorefrontDistributionDock username={username.replace(/^@/, "")} />
  </>;
}

"use client";

import { authenticatedFetch } from "./api/authenticated-fetch";

export type CreatorActivationSnapshot = {
  identity: {
    displayName: string | null;
    username: string | null;
    hustlerActive: boolean;
    professionalProfilePublished: boolean;
  };
  counts: {
    posts: number;
    publishedPosts: number;
    drafts: number;
    linkedPublishedPosts: number;
    publishedServices: number;
    publishedProducts: number;
    completedBookings: number;
  };
  recentPosts: Array<{
    id: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    caption: string | null;
    publishedAt: string | null;
    mediaCount: number;
    publishedOfferReferences: number;
  }>;
  readOnly: true;
};

/** The backend resolves owner identity from the signed-in session, never a userId query. */
export async function getCreatorActivation(): Promise<CreatorActivationSnapshot> {
  const response = await authenticatedFetch("/creator-activation", { cache: "no-store" });
  return response.json() as Promise<CreatorActivationSnapshot>;
}

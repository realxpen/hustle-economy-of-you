"use client";

import type {
  Product,
  ProductVariant,
  SaveProductInput,
  SaveProductVariantInput
} from "@hustle/types";
import { getSupabaseBrowserClient } from "./supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface PublicProduct {
  product: Product & { inStock: boolean };
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

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

async function authenticatedFetch(path: string, init?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("You need to sign in again");

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${session.access_token}`);
  if (init?.body) headers.set("content-type", "application/json");

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) throw new Error(await parseError(response));
  return response;
}

export async function getMyProducts(): Promise<Product[]> {
  const response = await authenticatedFetch("/products/mine");
  return response.json() as Promise<Product[]>;
}

export async function getMyProduct(productId: string): Promise<Product> {
  const response = await authenticatedFetch(`/products/mine/${encodeURIComponent(productId)}`);
  return response.json() as Promise<Product>;
}

export async function createProduct(input: SaveProductInput): Promise<Product> {
  const response = await authenticatedFetch("/products", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<Product>;
}

export async function saveProduct(productId: string, input: SaveProductInput): Promise<Product> {
  const response = await authenticatedFetch(`/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<Product>;
}

export async function createProductVariant(productId: string, input: SaveProductVariantInput): Promise<ProductVariant> {
  const response = await authenticatedFetch(`/products/${encodeURIComponent(productId)}/variants`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<ProductVariant>;
}

export async function saveProductVariant(productId: string, variantId: string, input: SaveProductVariantInput): Promise<ProductVariant> {
  const response = await authenticatedFetch(`/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<ProductVariant>;
}

export async function deleteProductVariant(productId: string, variantId: string): Promise<{ deleted: true; id: string }> {
  const response = await authenticatedFetch(`/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`, {
    method: "DELETE"
  });
  return response.json() as Promise<{ deleted: true; id: string }>;
}

export async function publishProduct(productId: string): Promise<Product> {
  const response = await authenticatedFetch(`/products/${encodeURIComponent(productId)}/publish`, { method: "POST" });
  return response.json() as Promise<Product>;
}

export async function pauseProduct(productId: string): Promise<Product> {
  const response = await authenticatedFetch(`/products/${encodeURIComponent(productId)}/pause`, { method: "POST" });
  return response.json() as Promise<Product>;
}

export async function deleteProduct(productId: string): Promise<{ deleted: true; id: string }> {
  const response = await authenticatedFetch(`/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
  return response.json() as Promise<{ deleted: true; id: string }>;
}

export async function getPublicProduct(productId: string): Promise<PublicProduct> {
  const response = await fetch(`${apiBase}/products/${encodeURIComponent(productId)}`, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) throw new Error("This product is not currently public.");
    throw new Error(await parseError(response));
  }
  return response.json() as Promise<PublicProduct>;
}

export function formatProductPrice(product: Pick<Product, "priceMinor" | "currency">, variant?: Pick<ProductVariant, "priceOverrideMinor">) {
  const minor = variant?.priceOverrideMinor ?? product.priceMinor;
  if (minor === null) return "Price not set";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: product.currency || "NGN",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2
  }).format(minor / 100);
}

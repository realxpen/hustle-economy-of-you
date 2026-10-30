"use client";

import type {
  Product,
  ProductVariant,
  SaveProductInput,
  SaveProductVariantInput
} from "@hustle/types";
import { authenticatedFetch } from "./api/authenticated-fetch";
import { publicReadFetch } from "./api/public-browsing";

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
  const response = await publicReadFetch(`/products/${encodeURIComponent(productId)}`);
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

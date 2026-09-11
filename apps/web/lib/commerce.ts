"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export interface CommerceUser {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  location: string | null;
  verified: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  productVariantId: string | null;
  quantity: number;
  productTitle: string;
  variantName: string | null;
  seller: CommerceUser;
  productType: "PHYSICAL" | "DIGITAL";
  currency: string;
  unitPriceMinor: number;
  lineTotalMinor: number;
  inventoryAvailable: number | null;
  available: boolean;
  availabilityReason: string | null;
  productUrl: string;
}

export interface Cart {
  id: string;
  userId: string;
  version: number;
  items: CartItem[];
  itemCount: number;
  totals: Array<{ currency: string; subtotalMinor: number }>;
  updatedAt: string;
}

export interface CheckoutGroup {
  seller: CommerceUser;
  currency: string;
  requiresDelivery: boolean;
  subtotalMinor: number;
  items: Array<{
    cartItemId: string;
    productId: string;
    productVariantId: string | null;
    productTitle: string;
    variantName: string | null;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    currency: string;
    productType: "PHYSICAL" | "DIGITAL";
    inventoryAvailable: number | null;
  }>;
}

export interface CheckoutPreview {
  cartId: string;
  itemCount: number;
  groups: CheckoutGroup[];
  inventoryPolicy: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productVariantId: string | null;
  productTitleSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string | null;
  optionValuesSnapshot: Record<string, unknown> | null;
  productTypeSnapshot: "PHYSICAL" | "DIGITAL";
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  inventorySource: "NONE" | "PRODUCT" | "VARIANT";
  createdAt: string;
}

export interface OrderRecord {
  id: string;
  buyerUserId: string;
  sellerUserId: string;
  status: OrderStatus;
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  deliveryName: string | null;
  deliveryPhone: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryCountry: string | null;
  deliveryNote: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  buyer: CommerceUser;
  seller: CommerceUser;
  items: OrderItem[];
  viewerRole: "BUYER" | "SELLER";
  paymentBoundary: {
    phase: string | null;
    paid: boolean;
    message: string | null;
  };
  nextAction: string | null;
}

export interface OrderPage {
  items: OrderRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CheckoutInput {
  deliveryName?: string;
  deliveryPhone?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryCountry?: string;
  deliveryNote?: string;
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

export async function getCart() {
  const response = await authenticatedFetch("/cart");
  return response.json() as Promise<Cart>;
}

export async function addCartItem(input: { productId: string; productVariantId?: string; quantity: number }) {
  const response = await authenticatedFetch("/cart/items", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<Cart>;
}

export async function updateCartItem(itemId: string, quantity: number) {
  const response = await authenticatedFetch(`/cart/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    body: JSON.stringify({ quantity })
  });
  return response.json() as Promise<Cart>;
}

export async function removeCartItem(itemId: string) {
  const response = await authenticatedFetch(`/cart/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
  return response.json() as Promise<Cart>;
}

export async function clearCart() {
  const response = await authenticatedFetch("/cart", { method: "DELETE" });
  return response.json() as Promise<{ cleared: true; removedItems: number; cart: Cart }>;
}

export async function getCheckoutPreview() {
  const response = await authenticatedFetch("/cart/checkout/preview", { method: "POST" });
  return response.json() as Promise<CheckoutPreview>;
}

export async function checkout(input: CheckoutInput) {
  const response = await authenticatedFetch("/cart/checkout", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<{
    orders: OrderRecord[];
    paymentBoundary: { phase: string; status: "PENDING"; message: string };
  }>;
}

function orderParams(options: { cursor?: string | null; limit?: number } = {}) {
  const params = new URLSearchParams({ limit: String(options.limit ?? 20) });
  if (options.cursor) params.set("cursor", options.cursor);
  return params.toString();
}

export async function listBuyerOrders(options: { cursor?: string | null; limit?: number } = {}) {
  const response = await authenticatedFetch(`/orders/buyer?${orderParams(options)}`);
  return response.json() as Promise<OrderPage>;
}

export async function listSellerOrders(options: { cursor?: string | null; limit?: number } = {}) {
  const response = await authenticatedFetch(`/orders/seller?${orderParams(options)}`);
  return response.json() as Promise<OrderPage>;
}

export async function getOrder(orderId: string) {
  const response = await authenticatedFetch(`/orders/${encodeURIComponent(orderId)}`);
  return response.json() as Promise<OrderRecord>;
}

export function formatMoney(minor: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2
  }).format(minor / 100);
}

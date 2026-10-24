"use client";

import type {
  PublicService,
  SaveServiceInput,
  Service
} from "@hustle/types";
import { authenticatedFetch } from "./api/authenticated-fetch";
import { isolatedWebMode } from "./auth/isolated-web-auth";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

export async function getMyServices(): Promise<Service[]> {
  const response = await authenticatedFetch("/services/mine");
  return response.json() as Promise<Service[]>;
}

export async function getMyService(serviceId: string): Promise<Service> {
  const response = await authenticatedFetch(`/services/mine/${encodeURIComponent(serviceId)}`);
  return response.json() as Promise<Service>;
}

export async function createService(input: SaveServiceInput): Promise<Service> {
  const response = await authenticatedFetch("/services", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<Service>;
}

export async function saveService(serviceId: string, input: SaveServiceInput): Promise<Service> {
  const response = await authenticatedFetch(`/services/${encodeURIComponent(serviceId)}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<Service>;
}

export async function publishService(serviceId: string): Promise<Service> {
  const response = await authenticatedFetch(`/services/${encodeURIComponent(serviceId)}/publish`, {
    method: "POST"
  });
  return response.json() as Promise<Service>;
}

export async function pauseService(serviceId: string): Promise<Service> {
  const response = await authenticatedFetch(`/services/${encodeURIComponent(serviceId)}/pause`, {
    method: "POST"
  });
  return response.json() as Promise<Service>;
}

export async function deleteService(serviceId: string): Promise<{ deleted: true; id: string }> {
  const response = await authenticatedFetch(`/services/${encodeURIComponent(serviceId)}`, {
    method: "DELETE"
  });
  return response.json() as Promise<{ deleted: true; id: string }>;
}

export async function getPublicService(serviceId: string): Promise<PublicService> {
  const response = isolatedWebMode
    ? await authenticatedFetch(`/services/${encodeURIComponent(serviceId)}`)
    : await fetch(`${apiBase}/services/${encodeURIComponent(serviceId)}`, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) throw new Error("This service is not currently public.");
    throw new Error(await parseError(response));
  }
  return response.json() as Promise<PublicService>;
}

export function formatServicePrice(service: Pick<Service, "priceMinor" | "currency" | "pricingType">) {
  if (service.priceMinor === null) return "Price not set";
  const amount = service.priceMinor / 100;
  const formatted = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: service.currency || "NGN",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);

  if (service.pricingType === "STARTING_AT") return `From ${formatted}`;
  if (service.pricingType === "HOURLY") return `${formatted} / hour`;
  return formatted;
}

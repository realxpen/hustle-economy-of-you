"use client";

import { authenticatedFetch } from "./api/authenticated-fetch";

export type AttributionPreference = {
  enabled: boolean;
  enabledSince: string | null;
  explanation: string;
};

export async function getAttributionPreference(): Promise<AttributionPreference> {
  const response = await authenticatedFetch("/events/attribution-consent");
  return response.json() as Promise<AttributionPreference>;
}

export async function setAttributionPreference(enabled: boolean): Promise<AttributionPreference> {
  const response = await authenticatedFetch("/events/attribution-consent", {
    method: "PUT",
    body: JSON.stringify({ enabled })
  });
  return response.json() as Promise<AttributionPreference>;
}

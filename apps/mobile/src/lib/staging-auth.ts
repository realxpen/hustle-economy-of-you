import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export function isExpoStagingSelected() {
  return process.env.EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER === "expo-better-auth";
}

export function validateExpoStagingConfiguration() {
  if (process.env.EXPO_PUBLIC_HUSTLE_APP_VARIANT !== "preview" ||
      process.env.EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE !== "isolated-staging" ||
      process.env.EXPO_PUBLIC_HUSTLE_DEMO === "true") {
    throw new Error("The test login requires the isolated preview app.");
  }
  if (process.env.EXPO_PUBLIC_API_URL !== "https://hustle-isolated-staging-api.vercel.app/api/v1" ||
      process.env.EXPO_PUBLIC_HUSTLE_AUTH_URL !== "https://hustle-isolated-staging-api.vercel.app/api/auth" ||
      process.env.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS !== "false" ||
      process.env.EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES !== "true") {
    throw new Error("The isolated test login is not configured.");
  }
}

let client: ReturnType<typeof makeClient> | undefined;
function makeClient() {
  validateExpoStagingConfiguration();
  return createAuthClient({
    baseURL: process.env.EXPO_PUBLIC_HUSTLE_AUTH_URL,
    plugins: [expoClient({ scheme: "hustle-preview", storagePrefix: "hustle-staging",
      cookiePrefix: "hustle-staging", storage: SecureStore, disableCache: true })]
  });
}
export function getStagingAuth() { return client ??= makeClient(); }

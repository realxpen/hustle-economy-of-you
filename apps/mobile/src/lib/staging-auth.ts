import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";

export function isExpoStagingSelected() {
  return process.env.EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER === "expo-better-auth";
}

export function validateExpoStagingConfiguration() {
  // APP_VARIANT exists in app.config.js, not in the installed JavaScript runtime.
  // Require the embedded isolated preview identity instead of a Node-only env var.
  const appId = Platform.OS === "android" ? Constants.expoConfig?.android?.package
    : Platform.OS === "ios" ? Constants.expoConfig?.ios?.bundleIdentifier : null;
  if (appId !== "com.hustle.economyofyou.preview.staging" ||
      process.env.EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER !== "expo-better-auth" ||
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

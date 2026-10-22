// Expo config for Hustle's cloud-only PREVIEW variant.
// The normal app.json identity is unchanged unless APP_VARIANT=preview.
// EAS project IDs are public identifiers, but must be linked by the owner.
module.exports = ({ config }) => {
  const isPreview = process.env.APP_VARIANT === "preview";
  // Expo project IDs are public. Pin the owner-verified preview project to avoid
  // mixing environments or depending on a redundant GitHub secret/variable.
  const previewProjectId = "b52b03ef-37f1-4bdf-ab42-5c80e5988ec4";
  const projectId = isPreview ? previewProjectId : (process.env.EXPO_PROJECT_ID || config.extra?.eas?.projectId);
  const base = {
    ...config,
    ...(projectId ? { extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } } } : {})
  };
  if (!isPreview) return base;
  const isStaging = process.env.EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE === "isolated-staging";
  return {
    ...base,
    owner: "xpen",
    name: isStaging ? "Hustle Staging" : "Hustle Preview",
    scheme: "hustle-preview",
    android: {
      ...base.android,
      package: isStaging ? "com.hustle.economyofyou.preview.staging" : "com.hustle.economyofyou.preview"
    },
    ios: {
      ...base.ios,
      bundleIdentifier: isStaging ? "com.hustle.economyofyou.preview.staging" : "com.hustle.economyofyou.preview"
    }
  };
};

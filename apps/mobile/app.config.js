// Expo config for Hustle's cloud-only PREVIEW variant.
// The normal app.json identity is unchanged unless APP_VARIANT=preview.
// EAS project IDs are public identifiers, but must be linked by the owner.
module.exports = ({ config }) => {
  const isPreview = process.env.APP_VARIANT === "preview";
  const projectId = process.env.EXPO_PROJECT_ID || config.extra?.eas?.projectId;
  const base = {
    ...config,
    ...(projectId ? { extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } } } : {})
  };
  if (!isPreview) return base;
  return {
    ...base,
    name: "Hustle Preview",
    android: {
      ...base.android,
      package: "com.hustle.economyofyou.preview"
    },
    ios: {
      ...base.ios,
      bundleIdentifier: "com.hustle.economyofyou.preview"
    }
  };
};

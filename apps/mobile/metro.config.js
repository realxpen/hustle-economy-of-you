// Expo SDK 54 npm-workspace safeguard: one React dispatcher for both
// the app and React Native's renderer. The root workspace has React 19.2.x
// for Next.js, while the mobile workspace uses React 19.1.0 for RN 0.81.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Force EVERY React import (including React Native's imports from the
// hoisted root node_modules) through the mobile workspace's React package.
// "extraNodeModules" is only a fallback in Metro, not a hard alias.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    const mobileReactModule = require.resolve(moduleName, { paths: [__dirname] });
    return context.resolveRequest(context, mobileReactModule, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

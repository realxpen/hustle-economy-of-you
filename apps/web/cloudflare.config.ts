import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "hustle-ios-pwa-staging",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-24",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      // Non-secret staging-only gate. Production must never deploy this Worker.
      HUSTLE_ISOLATED_PWA_GATE: bindings.text("isolated-staging"),
      NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH: bindings.text("true"),
    },
  }),
});

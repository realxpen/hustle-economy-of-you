import { bindings, defineConfig, defineWorker } from "cf/config";

// Opt-in build flag used ONLY by the separate, manually approved AWS preview
// workflow. Default remains the current Cloudflare -> Vercel Worker.
const awsPreviewBuild = process.env.HUSTLE_AWS_PREVIEW_BUILD === "true";

export default defineConfig({
  worker: defineWorker({
    name: awsPreviewBuild ? "hustle-ios-pwa-aws-test" : "hustle-ios-pwa-staging",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-24",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      // Vinext's generated metadata route can return 404 in the deployed
      // Worker. Let Cloudflare's static-assets binding serve the AWS-specific
      // PWA manifest without invoking SSR. Regular staging stays unchanged.
      runWorkerFirst: awsPreviewBuild
        ? ["/*", "!/_next/static/*", "!/*/_next/static/*", "!/aws-test.webmanifest"]
        : ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      // Non-secret staging-only gate. Production must never deploy this Worker.
      HUSTLE_ISOLATED_PWA_GATE: bindings.text("isolated-staging"),
      NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH: bindings.text("true"),
      // Separate origins/host-only cookies; never retrofit the working Worker.
      HUSTLE_API_BACKEND_TARGET: bindings.text(
        awsPreviewBuild ? "aws-lambda-isolated-staging" : "vercel-isolated-staging"
      ),
      NEXT_PUBLIC_HUSTLE_AWS_PREVIEW: bindings.text(awsPreviewBuild ? "true" : "false"),
    },
  }),
});

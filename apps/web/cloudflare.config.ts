import { bindings, defineConfig, defineWorker } from "cf/config";

// Opt-in build flag used ONLY by the separate, manually approved AWS preview
// workflow. Default remains the current Cloudflare -> Vercel Worker.
const awsPreviewBuild = process.env.HUSTLE_AWS_PREVIEW_BUILD === "true";
// Only the independently approved, manual normal-staging cutover sets this.
// Default and rollback builds remain pinned to Vercel.
const stagingAwsCutoverBuild = process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD === "true";
const paymentPreviewBuild = process.env.HUSTLE_PAYMENT_PREVIEW_BUILD === "true";
if ([awsPreviewBuild, stagingAwsCutoverBuild, paymentPreviewBuild].filter(Boolean).length > 1) {
  throw new Error("AWS preview, staging cutover and isolated payment-preview builds are mutually exclusive");
}
if (!paymentPreviewBuild &&
    (process.env.HUSTLE_API_BACKEND_TARGET === "payment-preview" ||
     process.env.HUSTLE_ISOLATED_PWA_GATE === "payment-preview")) {
  throw new Error("Payment preview flags must never build or overwrite ordinary staging");
}
if (paymentPreviewBuild &&
    (process.env.HUSTLE_API_BACKEND_TARGET !== "payment-preview" ||
     process.env.HUSTLE_ISOLATED_PWA_GATE !== "payment-preview" ||
     process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH !== "true")) {
  throw new Error("Payment preview build requires its exact isolated API and web auth flags");
}

export default defineConfig({
  worker: defineWorker({
    name: paymentPreviewBuild ? "hustle-payment-preview" :
      awsPreviewBuild ? "hustle-ios-pwa-aws-test" : "hustle-ios-pwa-staging",
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
      HUSTLE_ISOLATED_PWA_GATE: bindings.text(paymentPreviewBuild ? "payment-preview" : "isolated-staging"),
      NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH: bindings.text("true"),
      // Separate origins/host-only cookies; never retrofit the working Worker.
      HUSTLE_API_BACKEND_TARGET: bindings.text(
        paymentPreviewBuild ? "payment-preview" :
        stagingAwsCutoverBuild
          ? "aws-lambda-isolated-staging"
          : awsPreviewBuild ? "aws-lambda-isolated-staging" : "vercel-isolated-staging"
      ),
      NEXT_PUBLIC_HUSTLE_AWS_PREVIEW: bindings.text(awsPreviewBuild ? "true" : "false"),
      // This is a fixed, non-secret API Worker origin, never the existing
      // staging API. No environment-provided arbitrary URL is accepted.
      HUSTLE_PAYMENT_PREVIEW_API_ORIGIN: bindings.text(
        paymentPreviewBuild ? "https://hustle-payment-preview-api.realxpens.workers.dev" : ""
      ),
      NEXT_PUBLIC_HUSTLE_PAYMENT_PREVIEW: bindings.text(paymentPreviewBuild ? "true" : "false"),
    },
  }),
});

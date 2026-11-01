# Hustle — UI Preview (V1 Posts + Stories)

**Approved V1 design prototype with isolated-staging authentication connected for Milestone 1.** Feed, Stories, discovery, bookings, wallets, moderation, and commerce still use clearly marked demonstration state. The preview must never reach production accounts, financial systems, or the parent database. Do not merge this prototype into production as the full application.

## Design decisions
- Preserve the approved V1 visual style, layout, and bottom navigation.
- **Home contains ordinary professional posts**, photo posts, carousels, and Hire / Buy action previews.
- **Stories are separate:** tap a creator's circular avatar to view their full-screen story.
- The final arrow in the story row opens **Explore Stories**, which displays additional story creators and filters.
- The prototype uses demo data. Interactions never send messages, book, pay, or write to production services.
- Main app: `realxpen/hustle-economy-of-you`; this branch is for visual review only.

## Cloudflare Workers — connected static preview

This is a **Cloudflare Workers Builds** deployment (the build log invokes `npx wrangler deploy`), not a Pages project.

The preview branch includes a root `wrangler.jsonc` with `assets.directory: "./ui-preview/dist"`. The V1 UI remains static HTML/CSS/JS. An optional same-origin Cloudflare Worker entrypoint now handles **only isolated identity/session/account calls**; no database credentials or payment adapters run in the Worker.

### Worker build settings
1. **Verify Git branch** is `preview/hustle-v1-posts-stories`, NOT `main`.
2. **Root directory:** `ui-preview`. This isolates the static prototype from the monorepo's root npm workspaces.
3. **Build command:** `exit 0`.
4. **Deploy command:** `npx wrangler deploy --config wrangler.jsonc`. This forces Wrangler to load `ui-preview/wrangler.jsonc` instead of auto-detecting the monorepo.
5. **Config assets directory:** `./dist` (relative to `ui-preview/wrangler.jsonc`).
6. The Wrangler `name` is now `hustle-economy-of-you` to match the founder-approved URL. Cloudflare Workers Builds may require that it match the existing Worker name. If Cloudflare reports a name mismatch, use the exact Worker name in the configuration.
7. **Retry with latest preview branch commit.** A previous build may have checked out an old commit. Confirm current build's commit includes `ui-preview/wrangler.jsonc`. Cloudflare will provide the real `workers.dev` URL after success.

**Alternate deploy command when Cloudflare root must remain empty:** `npx wrangler deploy --cwd ui-preview --config wrangler.jsonc`; keep build command `exit 0`.

The repository's root `package.json` can cause unnecessary dependency installation when builds start at the root. This is not needed for the static preview. Future optimizations may set root directory to `ui-preview` and move the Wrangler config accordingly.

### Alternate Cloudflare Pages setup
If creating a genuine **Pages** project instead of **Workers**, use this branch, set root directory empty, set build command `exit 0`, and set output directory `ui-preview/dist`. Pages uses a different deployment mechanism from Workers.

## Preview acceptance
- Default Home shows a regular post, not the Stories viewer.
- Story circles open a full-screen story; closing returns to the Feed.
- The story-row arrow opens Explore Stories; story tiles open their viewer; Back returns to Feed.
- Feed posts show like, comments/replies, carousel controls, save-to-collection and consultation previews.
- iPhone viewport is responsive and works without a local file download.

## Storage
`dist/index.html` intentionally includes embedded example image assets. Cloudflare can deploy it **without npm, paid AI credits, database keys or environment variables**.

## Security
- Public design preview: use **fictional demonstration profiles and content only**.
- Never add secrets, service credentials, production endpoints or personal user data.
- Only the authentication and personal profile transport uses isolated backend APIs. No real payment, booking, messaging, or live-video integration is enabled.
- Never redeploy the live Worker without the founder-approved release gate and verification that Cloudflare Builds targets this exact branch and Worker.

## Reference
The source preview was verified locally with an automated browser smoke check on the five ordinary posts, story navigation, Explore Stories, like, comments, carousel, and consultation interactions. The site still requires an actual Cloudflare Pages deployment before its public URL exists.

## Milestone 1: connected identity (proposed)

See `ui-preview/CONNECTED_AUTH_V1.md`. The **old 123456 demonstration verification is no longer a valid sign-in mechanism** in the new source. Instead, invited email/password identity flows through the Worker first-party proxy to the existing isolated test API, then saves the canonical CLIENT account and onboarding profile. Other modules remain explicitly demo content. CI is not a live deployment or human device acceptance.

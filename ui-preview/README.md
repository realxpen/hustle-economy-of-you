# Hustle — UI Preview (V1 Posts + Stories)

**Standalone, front-end-only interactive prototype.** This branch is intentionally isolated from the real Hustle mobile app, services, database, payments, and deployments. Do not merge it into production as an implementation.

## Design decisions
- Preserve the approved V1 visual style, layout, and bottom navigation.
- **Home contains ordinary professional posts**, photo posts, carousels, and Hire / Buy action previews.
- **Stories are separate:** tap a creator's circular avatar to view their full-screen story.
- The final arrow in the story row opens **Explore Stories**, which displays additional story creators and filters.
- The prototype uses demo data. Interactions never send messages, book, pay, or write to production services.
- Main app: `realxpen/hustle-economy-of-you`; this branch is for visual review only.

## Cloudflare Pages — connect once to get a stable iPhone link
1. Open https://dash.cloudflare.com/ and select **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Connect GitHub and authorize `realxpen/hustle-economy-of-you` (select only the repository necessary).
3. Choose the **production branch** `preview/hustle-v1-posts-stories` for this separate Pages project. **Do not deploy the default `main` branch**.
4. **Framework preset:** None.
5. **Root directory (advanced):** `ui-preview`
6. **Build command:** `exit 0` (or leave empty if Pages permits).
7. **Build output directory:** `dist`
8. Deploy. Cloudflare supplies the actual URL; do not guess it.
9. For automatic future iterations, keep this project connected to the preview branch only.

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
- The static app is UI-only; no payment, authentication, messaging, or live-video integration.

## Reference
The source preview was verified locally with an automated browser smoke check on the five ordinary posts, story navigation, Explore Stories, like, comments, carousel, and consultation interactions. The site still requires an actual Cloudflare Pages deployment before its public URL exists.

# Hustle — Connected creator publishing + discovery milestone (staging only)

**Status:** Code proposed and CI pending; no hosted publication has been authorized, deployed or tested. The first real Waydroid preview reached authenticated Home on 2026-10-23 with no posts. This milestone replaces the inactive central Create alert with an actual native owner-post workflow.

## Integrated route
- Native central **Create** tab → skill/category, 4,000-character caption, optional general location and a publicly hosted **HTTPS image URL** → existing Nest AuthGuard-protected owner `POST /api/v1/posts` → canonical owner `GET /api/v1/posts/mine/:id` → image `POST /posts/:id/media` → published `POST /posts/:id/publish`.
- No synthetic posts, seeded media, private production identities, or payment/booking actions. **Photo/video upload from a device is not implemented**; requires approved storage and an independent media boundary. Users must own or have the right to display the externally hosted image. Never enter private file URLs.
- Real server publication enforces author ownership, required caption/category/image, media public URL and moderation clear status. The author can inspect **My posts**, including canonical drafts and published posts. The Feed backend deliberately excludes the viewing user's own posts; a **second invited test account** is required to verify peer discovery.
- On an unacknowledged POST or timeout the client **never automatically repeats** create/media/publish. It requires a manual owner-list review and user-selected draft to continue. A definitive pre-auth staging 403 is distinguished from ambiguous network completion. Drafts are server-owned; local text is session memory only. Sign-out changes the keyed React tree and clears private composer/inbox state.

## Isolated staging write boundary
The public staging server continues denying all post writes **by default**. The new `HUSTLE_STAGING_CONTENT_PUBLISH_ENABLED=true` applies only when intentionally configured on the dedicated isolated child API project and the reviewed API code is deployed. When enabled it permits ONLY:
- `POST /api/v1/posts`
- `POST /api/v1/posts/:postId/media`
- `POST /api/v1/posts/:postId/publish`

All Nest identity checks and post ownership/moderation logic still apply. DELETE, EDIT, archive, arbitrary uploads, bookings, payments, payouts, escrow and other unsafe routes remain denied. Parent/staging production databases and production provider settings are unchanged. The server-side flag and a new staging API deployment remain an **explicit owner-review/release gate**, not something CI automatically activates.

## Acceptance gates
1. Mobile TypeScript, actual client state-machine tests (duplicate prevention, ambiguous acknowledgement, canonical owner posts, image validation, exact routes), server policy negative/positive tests, existing mobile/auth/foundation CI and Android build all pass on the same exact branch head. A green mock test is not a hosted publication test.
2. Review and merge native inbox PR #200 first. This change is branched from #200 and must not be merged straight into an out-of-date base. Keep prior #201 alternative ABI pipeline separate; do not merge both packaging approaches without reconciliation.
3. Approve nonproduction server flag/deployment separately after the staged PRs are merged and safety probes still pass. Enable only the isolated child; no external provider data.
4. Two consenting allowlisted disposable testers: first publishes their own legitimately hosted image (no private info); second sees the published post in **For You/Search**, opens profile, and optionally initiates a service enquiry only if an actual published test service exists. First user's own feed may remain empty. Then review state, logout and resume on Waydroid/Android. No booking or real-money checkout.
5. Limitations: image link is a temporary bridge, not native upload; test-service publication/verification, media hosting and transaction enablement remain separate. Don't claim populated staging data without live proof.

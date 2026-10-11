# UX Build 3 — Creator, Stories, Live and Profile Acceptance

Date: 2026-10-11
Status: PR #98 MERGED 2026-10-11 (b1b0a69f3fd9e97619080151cf1a78591058b68d); Foundation CI 38160837071 SUCCESS on final head f4b6b5127800e1d1b6a6b9ec597fa4473dedfc52. Owner production Web release and signed-in device/real media acceptance PENDING.

## Implemented source behavior
- Professional profile editable preview no longer displays an unconditional "HUSTLER · VERIFIED" badge. ACTIVE Hustler capability and verified contact status are separate, conditional signals.
- Creator-navigation links Post → Story → Live → Storefront; no account role switch and no new capability requirements.
- Post editor checklist shows caption, category and media readiness, prevents accidental duplicate publish and has retryable post-loading failure.
- Story composer checks image/video format and 10 MB/50 MB limits before network upload, offers image/video or text preview, releases blob URL after use, and marks draft separate from 24-hour publish.
- Story viewer prevents cross-route old content, private replies and old view-count updates. Existing real reaction/reply/share and API event semantics remain.
- Live room creation labels the room as preparation, not broadcasting. Control UI shows native media/backup URL readiness, and Start requires actual media connection or saved playback source, not a blank room. Live viewer/control change routes without rendering previous session identity.
- Existing real story attachments, pinned Live offers and messaging/booking/commerce remain canonical.

## Manual owner acceptance — NOT COMPLETED
- [ ] Anonymous first visit, signed-in Client Post, Story (TEXT/IMAGE/VIDEO) and Hustler/Live eligibility appropriate to real API, with one identity.
- [ ] Post draft save, media URL add/remove, published offer attach/detach, proof preview and public post; no fake media. Test long captions/tags and zero references.
- [ ] Story portrait/landscape images and video, keyboard/file-input change, invalid types, zero-byte/oversized file, local preview, no blob URL leaks, 24-hour expiration.
- [ ] Story private replies and reactions only for authorized users, owner/private counts and signed-out view behavior; rapidly switching story IDs must not leak another user's replies.
- [ ] Live DRAFT without media cannot start; native transport supported with actual publisher connection before Go Live. Without native transport, a legitimate saved playback fallback is required. Editing unsaved fallback cannot start; viewers see only real streams, real pinned offers, real chat and status.
- [ ] Expired/ENDED Live and Story states, mobile safe area, iPhone Safari enlarged text, 320/360/390/430/768/1024/1440 CSS pixels.
- [ ] Professional editor active Hustler + no verified contact must NOT show Verified; email/phone verified shows only scoped CONTACT VERIFIED; profile publish/unpublish remains API-governed; visitors see actual trust signals.
- [ ] Prior Build 1/2 runtime acceptance in Knowledge/QA/CORE_OPPORTUNITY_JOURNEY_ACCEPTANCE.md and Knowledge/QA/TRANSACTION_MESSAGING_UX_BUILD2_ACCEPTANCE.md still pending.
- [ ] Owner manually releases Web after review. No autonomous production deployment, real broadcasting or real payments.

CI/type checks verify source and builds, not actual browser previews, transport readiness, or backend authorizations.

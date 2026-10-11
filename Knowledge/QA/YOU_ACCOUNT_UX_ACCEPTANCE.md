# You (/account) Adaptive UX Acceptance — 2026-10-11

Status: FEATURE IMPLEMENTED, CI/runtime/deploy pending.

## Design acceptance
- [ ] 320, 360, 375, 390, 430 CSS pixel iPhone Safari, Android Chrome, 768/1024/1440 desktop; no horizontal overflow, text clipping, chip/tag cloud or bottom dock overlap.
- [ ] Browser normal and enlarged text 100%/125%/150%/200%; profile name may wrap naturally without covering avatar/edit; interactive controls >=44px.
- [ ] System/Light/Dark appearance maintains contrast in profile hero, capability labels, Trust/activity tabs, transaction-backed ReviewCard and Privacy component.
- [ ] Identity matches actual API account displayName, username, location. No placeholder balances, orders, bookings, ratings or followers.
- [ ] Client/Agent/Hustler capabilities reflect server-provided status. No role toggles; no access to Agent workspace without ACTIVE AGENT, no Hustler-managed offerings without ACTIVE HUSTLER.
- [ ] Contact unverified never displays Verified; email or phone verified may display *Contact verified* only (not work/reputation verified).
- [ ] Real routes work: Edit profile, bookings, orders, inbox, wallet, notifications, search/marketplace, Posts, Stories, conditional Hustler management, Agent grant management and appeals.
- [ ] Privacy expander contains the real persisted attribution opt-in (defaults off), can toggle and error/retry; no analytics preferences invented or changed by redesign.
- [ ] Trust expander loads real private reports, blocks and verified transaction reviews on demand; no private activity leaks into public profile; contrast and read-only admin boundary honored.
- [ ] Error from account endpoint offers retry and sign-in path; a transient network error does not automatically redirect to auth. Sign-out is explicit, catches errors and never claims sign-out on failure.
- [ ] Footer and fixed six-destination mobile navigation remain separated with iOS Safari safe area; reduced-motion has no hover shifts.

## Implementation evidence
New scoped /account page.module.css, rewritten account page.tsx, semantic token-based Trust activity and Review styles, and CI test script. Uses actual @hustle/types account and canonical existing routes; no transaction/permission mutations.
Sign-in-dependent browser screenshots after owner-controlled deployment remain required. CI is not a completed UX/device acceptance.

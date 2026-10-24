# Isolated staging: real Hustler activation through reviewed publication

Date: 2026-10-24. Status: proposed PR, not deployed or live validated.

## Intent
The October 24 iPhone Explore search produced a real zero-result state. Read-only Neon inspection found zero published profiles, services, posts and products on the disposable staging child. Do not seed invented professional results or borrow production identities.

## Staging-only workflow
1. An explicitly invited test account signs in through first-party Better Auth and syncs the existing Client account. It sets a real username via the existing profile editor.
2. In **Become a Hustler**, submit actual skill, category, experience and a genuine public HTTPS portfolio URL in the existing `businessInfo` field. The URL is explicitly TEST EVIDENCE ONLY; the app does not claim it proves identity. No files are uploaded or copied from private production storage.
3. A separate authorized administrator (preconfigured exact application user ID in `HUSTLE_ADMIN_USER_IDS`) signs in with an independently invited test account and visits `/internal/hustler-reviews`. It must inspect the portfolio independently and make a conscientious, explicit verification decision. It cannot approve its own application, and approve requires status UNDER_REVIEW, VERIFIED and portfolio evidence.
4. Only after ACTIVE HUSTLER activation can the owner save/publish their professional profile and publish a genuine Service using the existing flows and backend permissions. The client can then search for its actual skill and navigate to its public professional profile and Service.
5. Compare People/Services/Top results and record verified user-facing evidence. If no actual willing provider exists, leave zero results as-is.

## Boundaries
- No self-approval or preloaded fake Hustlers; no production credential, storage, AWS or payments.
- Runtime must remain `HUSTLE_RUNTIME_SCOPE=isolated-staging` pinned to the disposable child database, with the isolated-web two-flag proxy gate enabled. Never enable these staging API write routes in production.
- Existing AdminGuard (`HUSTLE_ADMIN_USER_IDS`) and CapabilityGuard retain control. Without a separate administrator, activation intentionally stalls, rather than self-enabling HUSTLER.
- Production continues requiring actual uploaded proof records; staging's optional HTTPS portfolio link alternative is disabled unless the runtime scope is **exactly** isolated-staging.
- The proxy restricts request methods, paths, same-origin JSON, no redirects, max 10 KB, bearer session, no arbitrary hosts. Staging API denies all other writes including booking, checkout, payment, wallet, escrow, media, admin operations and deletion.
- Do not treat a staging human verification marker as actual KYC, real-world identity certification or production approval.
- No database writes, migrations, deploys, credential changes or test accounts were performed by creating this PR.

## Gates
1. Exact-head Foundation CI and Cloudflare compatibility pass. No staging deploy occurs on merge.
2. Separately approved isolated staging API deploy (Vercel) + isolated Cloudflare web deploy; confirm both deployments contain the matching allowlists.
3. Two real, invited, distinct test accounts with configured reviewer authorization; manual approved data and storefront publication.
4. iPhone search results verified against the actual records via Top, People and Services. No payment or booking operations.

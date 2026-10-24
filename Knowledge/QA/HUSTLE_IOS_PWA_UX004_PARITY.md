# Hustle — iPhone Home Screen PWA using existing Figma + UX004 Mobile

**Status:** Proposed code; developer CI and hosted iPhone acceptance are separate gates. No production release has been requested or performed.

## Provenance — do not redesign Hustle
- Design file: [Hustle Mobile V1](https://www.figma.com/design/psxnn95X8nPqEEp7IvEw5s), especially **2:18 Home — For You Infinite Feed** and **6:2 Explore — Search + Map Discovery**. The visual target is the accepted UX004 **Hybrid** mobile system, not the earlier Next.js marketing/web chrome.
- Native implementation is in `apps/mobile/src/experience/MobileExperience.tsx` (plus its newer staged Inbox/Create work): dark immersive media feed, cream utility screens, #121714 ink, #F7F6F2 paper, #C9F26B lime, floating five-icon capsule.
- Web reuses the **existing working Next.js feed, search, real post-creation route, conversation and account pages**. There are no fabricated posts, fabricated offers or separate hand-built demo flows. It maps those existing routes to the same five visual destinations on installed iPhone PWA.
- Figma is the visual specification, not an executable app. React Native components cannot be dropped directly into Next.js without a React Native Web + authentication/storage compatibility boundary. Sharing the documented design system and existing real backend pages is the narrowest safe parity solution without spawning a second prototype.

## Native-match route map on iPhone standalone only
| Native UX004 tab | Existing Next.js PWA route |
| --- | --- |
| Home | `/home` — real full-screen immersive feed, LIVE / For You / Nearby |
| Explore | `/search` — cream search, skills and real published search results |
| Create (+) | `/posts/new` — existing web publisher, subject to server auth/capabilities |
| Inbox | `/messages` — existing web messages, no mocked conversations |
| You | `/account` — existing web account and its settings/Activity links |

Browser/desktop keeps its existing six-destination web navigation, preserving older responsive and business workflows. Only `(display-mode: standalone)` with a mobile viewport enables the five-item native dock. Live and Map are **not** newly implemented by this change.

## Install identity and privacy
- Next.js App Router `app/manifest.ts` sets standalone, scope `/`, start URL `/home`, name/icon, dark background. iPhone 180×180 PNG icon and SVG icon are served by Next, not temporary Figma URLs. Apple web-app metadata uses translucent status bar and `viewport-fit=cover` to respect iPhone notches and home indicator.
- The PWA continues loading fresh online data from existing web APIs. **No service worker caches sign-in responses, payments, conversations, cookies, API JSON or personalized pages.** This initial version is deliberately **online-first, not an offline-first clone**.
- Importantly, current web uses **Supabase authentication**, whereas the connected isolated native preview uses **Better Auth**. Matching the interface does **not** mean the two builds share accounts or sessions today. Do not imply that a native invited tester can log into web with the same session without separately verifying a compatible backend.
- No changes to production auth, secrets, payment, escrow, booking, database schemas, or native APK/Expo configurations.

## Test and release gates
1. GitHub Foundation CI: compile Next.js and mobile packages, run `check-ios-pwa-parity.cjs`, and Chromium mobile `pwa-standalone-smoke.cjs` against local Next, checking manifest, image routes, CSS native dock and feed/Explore. **Chromium emulation does not establish iOS Safari acceptance.**
2. Review PR, deploy **nonproduction preview**, confirm HTTPS URL is `READY` and can actually be opened in iPhone Safari. The existing `staging-hustle-web` Vercel project currently has SSO protection and recent canceled deployments; neither a URL nor an installed PWA can be promised until resolved through the normal approved Vercel project settings/deployment pipeline.
3. On iPhone: open the verified HTTPS preview in **Safari**, tap Share → Add to Home Screen → Add, launch the Hustle icon, check dark feed, five-tab dock, cream Explore, Create/Inbox/You, safe areas and swipe scrolling. Do not assume Expo Go and PWA identities are interchangeable.
4. For separate native iPhone testing, Expo Go SDK54 with an intentionally started Expo development server remains the native track. For Android/Waydroid, use the reviewed native test APK. One design, different runtime packaging.

Presentation styling now covers all **five** primary routes (Home, Explore, Create, Inbox, You), preserving the existing web functionality in each. Exact component-by-component behavioral parity, including native uploads, native SecureStore login and privileged flows, remains subject to the React Native/Web authentication and capability adapters.

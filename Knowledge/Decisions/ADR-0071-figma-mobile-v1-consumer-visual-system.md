# ADR-0071 — Figma Mobile V1 as Hustle consumer visual reference

Date: 2026-10-27
Status: Proposed for code review
Reference: https://www.figma.com/design/psxnn95X8nPqEEp7IvEw5s/Hustle-%E2%80%94-Mobile-Experience-V1?node-id=0-1
Scope: Consumer Expo/React Native and Web/PWA. No Auth, API, payment, database or production change.

## Latest founder direction
The founder considers Hustle's tester-facing UI/UX inconsistent and wants one clean, production-quality visual language derived from this Figma Mobile Experience V1 file. This supersedes older conflicting **consumer visual** orange/pale choices, but not prior product, security, finance, trust, or platform approvals.

## Evidence from the actual Figma file
Page 01 has 12 designed mobile frames, each 390x844: Welcome, For You Feed, Hustler Profile, Service Booking, Next Video, Explore/Search/Map, Comments, Save to Collection, Share, Creator Preview, Attached Service and Attached Product. Page 02 contains reusable semantic colors, dimension variables, Inputs, Cards, Chips, Sheets, Icons and Floating Navigation. Page 03 is currently an empty placeholder.

Light: paper #F7F6F2, white #FFFFFF, raised #E4EFD7, text #181A18, secondary #778074, ink #18281E and borders #E3E8DF. Accent: #C9F26B. Dark: background #0E1210, card #27372C, secondary #BCD0BF, border #405046. Semantic danger #BA5555, success #47704A. Spacing 4/8/12/16/24, card radius 20, input 16 and pill 28.

Figma's stacked illustrated feed is placeholder artwork, not a license to replace real provider content. Dates, prices, reviews and verified labels in the mockup are illustrative and cannot be claimed without real data.

## Implementation decision
- Dark immersive Feed/Live, warm cream/white utility surfaces, sheet parity, and lime primary emphasis, without a global theme flip for unseen payment/admin pages.
- Expo uses semantic tokens in apps/mobile/src/ux004/theme/colors.ts. Web consumer scopes mirror those values in apps/web/app/figma-mobile-v1.css. An offline CI test checks those two sources remain aligned.
- Browser mobile uses the existing six canonical destinations; installed iPhone PWA and Expo retain five destinations. Both are drawn as a dark capsule with a lime selection. Auth guards, Create's actual route and unread counts stay live.
- Connected Android reuses UX004 semantic colors and 48dp navigation targets. Existing live API connections, media, search, consultation and booking are unchanged.
- Existing web appearance preferences remain functional. The old --h-orange semantic custom property is retained only as an intermediate compatibility alias within migrated consumer screens; new components should use --hf-* tokens.
- All meaningful financial, trust and availability states remain backend-authoritative. The accent is not the success or verified status color.

## Verification and release gate
This first milestone unifies core palette/nav/component measurements; **it does not claim that all 12 screens are pixel-identical**. The Figma mockup contains abstract placeholder media, and the live app has different real data, surfaces and interaction states.

Required before declaring tester-ready: build/typecheck/CI; responsive screenshot comparison at 320, 360, 390, 768 and 1440 CSS px; installed iPhone PWA and native Android navigation + safe-area; feed 2+ posts; keyboard/open sheet; booking availability truth; sign-in and error/empty states; no overflow, unreadable buttons or broken CTAs. Do not deploy, merge without review, or enable payments based on a static style contract.

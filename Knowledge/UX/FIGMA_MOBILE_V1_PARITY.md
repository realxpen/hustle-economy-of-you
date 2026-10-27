# Figma Mobile Experience V1 — screen coverage and tester QA

Design: https://www.figma.com/design/psxnn95X8nPqEEp7IvEw5s/Hustle-%E2%80%94-Mobile-Experience-V1?node-id=0-1

Figma is the reference for visual styling, not a source of real users, media, balances, verified status, availability, or payment outcomes. This is a parity tracker. A passing token check **does not equal visual acceptance**.

| Figma node | Screen | Existing product route / implementation | Remaining visual and functional acceptance |
|---|---|---|---|
| 2:2 | Welcome | Web /, /auth; mobile sign-in | Brand/CTA structure, member flow, small phones |
| 2:18 | For You infinite feed | Web /home; MobileExperience; DemoExperience | Authentic media, rail, tabs, scrim, linked offer |
| 2:54 | Hustler profile | Web public profile, mobile creator sheet | Work-first profile, verified data, contact/hire |
| 2:88 | Service booking | Web booking/new; mobile connected booking | Real slots, requirements, consent and keyboard |
| 4:37 | Next feed video | Feed paging | Paging, back restores active post |
| 6:2 | Explore/Search/Map | Web /search; mobile Explore | Search, location disclaimers and results |
| 8:2 | Comments / replies | Mobile and web comments | Thread correctness, keyboard, focus, dismiss |
| 8:62 | Save collection | Mobile save sheet; web saved posts | Real vs demo-only state clearly marked |
| 8:118 | Share / link | Native and web share | Deep link routes to correct content |
| 8:172 | Creator preview | Profile routes/sheets | Actual identity data, no invented claims |
| 8:226 | Attached service | Offer sheet / service detail | Active offer and consultation-to-book |
| 8:277 | Attached product | Product sheet / product detail | Real listing and checkout boundary |

Design tokens & navigation are aligned in the first PR. The rest needs screenshot evidence at phone 320/360/390, tablet 768 and desktop 1440, plus Android and iPhone PWA. Existing backends and working journeys cannot be replaced by non-interactive Figma exports.

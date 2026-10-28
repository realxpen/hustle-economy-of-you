# UX018 — iOS 27 installed-PWA blur: controlled CSS experiment

Date: 2026-10-28 (Nigeria). Owner: Hustle design-quality acceptance.

## Verified baseline

- **Safari on founder's iPhone:** Feed wordmark and Search icon sharp.
- **Installed Home Screen PWA:** same Feed header blurred/washed out, while LIVE / For You / Nearby remain sharp.
- **PR #253 / UX017:** merged as `8d7438a64933886c0556140a54ac1559532a1dd7`, staging workflow [40681898759](https://github.com/realxpen/hustle-economy-of-you/actions/runs/40681898759) passed before the founder's 1:00 PM screenshot, and the blur remained. The initial fixed opaque 8px strip is therefore a **failed device experiment**.
- This effect is known to occur in iOS 27 installed PWAs. References:
  - [Danny Moerkerke, Sept 30, 2026](https://modernwebweekly.substack.com/p/so-whats-up-with-the-ios27-blur)
  - [OJapp's iOS 27 experiments](https://tips.ojapp.app/en/ios-27-pwa-top-blur-workaround-2/)
  - [Reports on black-translucent status-bar style](https://www.reddit.com/r/PWA/comments/1w5mqj1/ios_27_beta_blurs_the_top_edge_of_installed_pwas/)
- The iPhone is the only device that can establish whether the system-level effect is removed; Chromium CI cannot.

## UX018 experiment

Keep existing `standaloneStatusBarGuard` DOM element. In its `display-mode:standalone` rule, change only the strip's paint/compositing recipe to the reported variant:

- 11px height at top 0, 100% width
- solid `#0E1210` background with `-webkit-background-clip:text` and `background-clip:text`
- highest stacking order but `pointer-events:none`
- hidden in Safari/browser and desktop; existing status-bar meta unchanged

**Do not claim this is fixed** just because the static source assertion and CI pass. The effect is OS-rendered, unstable between devices/versions, and users may see different results after app process restart.

## Staging/device verification gate

1. Wait for both PR workflows to be green, merge into `main` only after source review.
2. Deploy the exact merged SHA to isolated staging through the protected AWS cutover workflow.
3. On the same iPhone, fully close and reopen **installed** Hustle, then screenshot top 150px immediately on launch and after switching away/back. Also open same route in Safari.
4. Compare: legibility of hustle logo, search icon and iOS status bar; no changed header height, shifted feed tabs, blocked taps, or white strip.
5. Record `PASSED` only if both screenshot states are sharp. If still blurred, log `FAILED` and **do not run another blind CSS PR**: consider controlled metadata/default reinstall test or an OS-bug-safe layout alternative, with founder permission since reinstall may clear per-app data.

No API, auth, social, backend, finance, booking, or native Android change. Do not deploy to production.

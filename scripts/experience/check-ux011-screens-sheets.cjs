#!/usr/bin/env node
"use strict";
/** Source contracts complement, but never replace, runtime/device/screenshot QA. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const native = read("apps/mobile/src/experience/MobileExperience.tsx");
const demo = read("apps/mobile/src/experience/DemoExperience.tsx");
const chrome = read("apps/mobile/src/ux004/components/SheetChrome.tsx");
const chip = read("apps/mobile/src/ux004/components/SkillChip.tsx");
const header = read("apps/mobile/src/ux004/components/ScreenHeader.tsx");
const card = read("apps/mobile/src/ux004/components/SurfaceCard.tsx");
const listing = read("apps/web/app/search/search.module.css");
const storefront = read("apps/web/app/u/[username]/page.module.css");
const service = read("apps/web/app/services/[serviceId]/page.module.css");
const product = read("apps/web/app/products/[productId]/page.module.css");
const booking = read("apps/web/app/bookings/bookings.module.css");
const inbox = read("apps/web/app/messages/messages.module.css");
const quick = read("apps/web/components/commerce/offer-quick-view.module.css");
const quickView = read("apps/web/components/commerce/offer-quick-view.tsx");
const check=(condition,message)=>assert.ok(condition,message);

// Shared native UI is pure and cannot import networking, payment or auth.
for (const [name,source] of Object.entries({chrome,chip,header,card})) {
  assert.doesNotMatch(source,/fetch\s*\(|axios|mobileApi|createClient|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|escrow|payment\.release/,
    "UI primitive must not access backend or payment: "+name);
}
check(chrome.includes("layout.minTapTarget"),"Sheet close controls must be 48dp");
check(chrome.includes('accessibilityRole="button"')&&chrome.includes('accessibilityRole="header"'),"Sheet needs semantic heading/close");
check(chrome.includes("closeStyle"),"Demo retains approved accessible close target");
check(chip.includes("layout.minTapTarget"),"Chips must preserve minimum tap target");
check(chip.includes("accessibilityState={{ selected: active }}"),"Chips expose selected state");
check(header.includes("eyebrow?: string"),"Utility screens need shared eyebrow");
check(card.includes("borderColor: colors.line"),"Shared cards need semantic border");
for(const [name,source] of Object.entries({native,demo})){
  check(source.includes("SheetChrome"),name+" should render common sheet chrome");
  check(source.includes("SkillChip"),name+" should render common Explore chips");
  check(source.includes("ScreenHeader"),name+" should use common Explore page header");
  check(source.includes('title="Explore"'),name+" missing Explore page header");
}
check((native.match(/<ScrollView style=\{styles\.sheet\} nestedScrollEnabled/g)||[]).length === 2,
  "Connected social and opportunity sheets must scroll on small phones");
check(native.includes("KeyboardAvoidingView")&&native.includes("keyboardShouldPersistTaps"),
  "Connected sheets must not trap keyboard/focus");
check(native.includes("currentEnquirySlots")&&native.includes("mobileApi.slots"),
  "Live appointment slot selection must remain source-backed");
check(native.includes("EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS"),
  "Booking request must remain behind its existing gate");
check(demo.includes("OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS"),
  "Demo safety disclosure must remain");
check(demo.includes("styles.sheetCloseTarget"),"Demo close target must remain accessible");
check(demo.includes("onRequestClose={requestDismissSheet}"),"Android Back must dismiss demo sheet");
for(const [name,css] of Object.entries({listing,storefront,service,product,booking,inbox,quick})){
  check(css.includes("UX011"),"Missing reviewed UX011 style scope: "+name);
  check(css.includes("--hf-"),"Must use Figma tokens: "+name);
  check(css.includes("@media(max-width:"),"Phone layouts required: "+name);
}
check(quick.includes(".backdrop")&&quick.includes(".sheet")&&quick.includes(".close")&&quick.includes(".actions"),
  "Offer modal must have complete surface/close/action styling");
check(quick.includes("max-height:90dvh")&&quick.includes("safe-area-inset-bottom"),
  "Popup must fit available mobile height above device safe area");
check(quickView.includes('role="dialog"')&&quickView.includes('aria-modal="true"'),
  "Quick view must remain a real accessible dialog");
check(quickView.includes('event.key === "Escape"')&&quickView.includes('event.key !== "Tab"'),
  "Quick view must preserve Escape and focus trap");
check(quickView.includes("getPublicService")&&quickView.includes("getPublicProduct"),
  "Quick view must use real canonical offers");
check(booking.includes(".payment")&&booking.includes(".success"),
  "Semantic booking state styling must not be removed");
console.log("PASS UX011: shared Figma chrome/chips/header/cards; Explore, profile, service/product, booking, inbox and modal source boundaries.");
console.log("Pending: side-by-side visual QA, Android/iPhone touch & keyboard, real content and staged conversions.");

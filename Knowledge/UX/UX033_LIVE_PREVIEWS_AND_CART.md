# UX033 — Live previews and safe Cart activation

The founder wants LIVE to behave like the regular full-height, swipeable Discovery feed, but show only active broadcast previews. The normal For You, Nearby and Connections feeds also surface genuine Live previews alongside posts. Tap preview to open the full Live room with video, comments and attached-offer interaction.

The founder published a real product but Cart still showed a Supabase-only auth error. UX033 changes Commerce to the existing shared authenticated client and enables exact Cart read/add/change/remove/clear routes in both isolated-staging policies, retaining AuthGuard. Checkout preview, Order creation, payments, Wallet and escrow routes remain denied.

The preview displays actual host, viewer count, pinned published Product or Service, and its real currency price. No synthetic listings or numbers. Public, explicitly browser-playable HTTPS media can display as silent autoplay; a native LiveKit-only broadcast does not expose a preview without an authorized viewer token, so its genuine host avatar is used instead. No preview has comments or full stream interaction.

For You may interleave up to three active sessions with posts. Nearby requires the Live host's location to match the returned viewer location; Connections conservatively requires a confirmed followed creator in the loaded feed. It does not invent follow relationships or location and is not yet a fully server-ranked hybrid recommendation pipeline.

Acceptance: anonymous access must not mutate Cart; signed-in staging account can Add to Cart, Open Cart and change/remove/clear items. Checkout must remain blocked. A genuinely active Live appears in LIVE, opens its full room and shows attached offers, and can appear in matching ordinary feeds. Empty LIVE is a real empty state. No production deployment or real payments.

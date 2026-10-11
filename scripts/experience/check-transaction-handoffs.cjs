#!/usr/bin/env node
/** Static Web journey invariants. No requests, production writes or credentials.
 * These supplement, never replace, signed-in browser/device and sandbox tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const booking = read("apps/web/app/bookings/[bookingId]/page.tsx");
const order = read("apps/web/app/orders/[orderId]/page.tsx");
const cart = read("apps/web/app/cart/page.tsx");
const checkout = read("apps/web/app/checkout/page.tsx");
const start = read("apps/web/app/messages/start/page.tsx");
const thread = read("apps/web/app/messages/[conversationId]/page.tsx");
const returnPath = read("apps/web/lib/transaction-return.ts");
const journey = read("apps/web/components/commerce/transaction-journey.tsx");
const bookingForm = read("apps/web/app/bookings/new/[serviceId]/page.tsx");
const tests = [
  [booking.includes('TransactionJourney kind="BOOKING"'), "Booking status journey"],
  [order.includes('TransactionJourney kind="ORDER"'), "Order status journey"],
  [booking.includes("withTransactionReturnTo("), "Booking to conversation"],
  [order.includes("withTransactionReturnTo("), "Order to conversation"],
  [booking.includes('role="alert"') || booking.includes('kind="error"'), "Booking recovery"],
  [order.includes('kind="error"'), "Order recovery"],
  [booking.includes("requestVersion.current"), "Stale Booking response protection"],
  [order.includes("requestVersion.current"), "Stale Order response protection"],
  [thread.includes("storedConversation?.id === conversationId"), "No wrong-thread identity"],
  [thread.includes("conversationIdRef.current !== conversationId"), "Ignore old thread response"],
  [thread.includes("transactionHandoff"), "Return to transaction inside conversation"],
  [start.includes('nextParams.set("returnTo", safeReturn)'), "Preserve safe return through start"],
  [returnPath.includes("safeTransactionReturnTo("), "Transaction path is validated"],
  [returnPath.includes("safeTransaction.test(value)"), "Reject unknown navigation paths"],
  [journey.includes('if (status === "PENDING") return 0'), "Pending Order is creation not payment"],
  [journey.includes('if (status === "FUNDED") return 2'), "Booking funding only from funded state"],
  [journey.includes('if (status === "PAID") return 1'), "Order paid step from server status"],
  [booking.includes("funded={booking.paymentBoundary.funded}"), "Booking takes authoritative funding evidence"],
  [order.includes("paid={order.paymentBoundary.paid}"), "Order takes authoritative payment evidence"],
  [journey.includes("props.paymentRequired && !props.funded"), "Never mark unfunded booking paid"],
  [journey.includes('index === 1 && !props.paid'), "Never mark unconfirmed Order paid"],
  [cart.includes("unavailableItems.length === 0"), "Prevent unavailable cart next step"],
  [cart.includes("window.confirm("), "Confirmation for destructive Cart clear"],
  [cart.includes('kind="error"'), "Cart loading recovery"],
  [checkout.includes("setPreview(null)"), "Never leave stale checkout preview actionable"],
  [checkout.includes('Create unpaid Order'), "Checkout cannot claim paid order"],
  [bookingForm.includes("bookingConsult"), "Consult before sending service booking"],
  [read("apps/web/app/orders/page.tsx").includes("checkout=created") || read("apps/web/app/orders/page.tsx").includes('"created"'), "Multi order routes to unpaid order list"],
];
for(const [ok,what] of tests) assert.ok(ok, what);
console.log("Transaction + Messaging Web UX contract passed ("+tests.length+" checks).");

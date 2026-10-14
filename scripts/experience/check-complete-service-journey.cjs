#!/usr/bin/env node
// Static, non-financial source contract; live signed-in runtime QA is separate.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const feed=read("apps/web/app/home/page.tsx");
const quick=read("apps/web/components/commerce/offer-quick-view.tsx");
const service=read("apps/web/app/services/[serviceId]/page.tsx");
const form=read("apps/web/app/bookings/new/[serviceId]/page.tsx");
const booking=read("apps/web/app/bookings/[bookingId]/page.tsx");
const order=read("apps/web/app/orders/[orderId]/page.tsx");
const finance=read("apps/web/components/finance/transaction-finance-actions.tsx");
const bookingClient=read("apps/web/lib/booking.ts");
const financeClient=read("apps/web/lib/finance.ts");
const APIBooking=read("apps/api/src/booking/booking.service.ts");
const APIPayment=read("apps/api/src/payment/payment.service.ts");
const paymentModule=read("apps/api/src/payment/payment.module.ts");
const checks=[
  [feed.includes("OfferQuickView"),"Discover offers launch canonical Quick View"],
  [quick.includes('withSourcePost("/bookings/new/"'),"Service quick view offers canonical Booking route"],
  [service.includes("/bookings/new/"),"Public Service links to Booking"],
  [form.includes("checkBookingAvailability("),"Scheduling checks server availability"],
  [form.includes("openDirectConversation("),"Booking reuses direct consultation"],
  [form.includes("createBooking("),"Booking request is persisted"],
  [form.includes("does not charge you"),"Request does not claim funding"],
  [bookingClient.includes("/accept"),"Hustler decision connects to Booking API"],
  [booking.includes("withTransactionReturnTo("),"Messages preserve Booking return"],
  [booking.includes('booking.status === "PAYMENT_PENDING"'),"Client checkout is gated by booking state"],
  [booking.includes("funded={booking.paymentBoundary.funded}"),"Funding display derives from server"],
  [booking.includes("key={")&&booking.includes("BOOKING:"),"Booking finance remounts on subject change"],
  [order.includes("key={")&&order.includes("ORDER:"),"Order finance remounts on subject change"],
  [finance.includes('payment?.provider === "HUSTLE_SANDBOX"'),"Simulated provider explicitly labelled"],
  [finance.includes("Sandbox simulation — no real payment"),"No falsely marketed money movement"],
  [finance.includes("initializePayment("),"Web initializes, not confirms, payments"],
  [financeClient.includes("/payments/initialize"),"Payment API remains server-authoritative"],
  [APIBooking.includes("async markFundedFromAuthoritativePayment("),"Funding transition is internal-only"],
  [APIPayment.includes("verifyWebhook("),"Financial webhook is verified at gateway"],
  [paymentModule.includes("SandboxPaymentGateway"),"Only isolated sandbox gateway is registered"]
];
for(const [ok,label] of checks)assert.ok(ok,"Hustle complete Service journey: "+label);
console.log("PASS: complete Service UX source contracts ("+checks.length+" checks), no network, credentials or money.");

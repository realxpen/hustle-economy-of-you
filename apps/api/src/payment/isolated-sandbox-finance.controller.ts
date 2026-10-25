import { BadRequestException, Body, Controller, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { createHash, createHmac } from "node:crypto";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { BookingService } from "../booking/booking.service";
import { PaymentService } from "./payment.service";
import { WalletService } from "./wallet.service";
import { FinancialOperationsService } from "./financial-operations.service";
import { assertIsolatedSandboxFinance } from "./isolated-sandbox-finance.guard";

/**
 * Actual HUSTLE_SANDBOX gateway and double-entry ledger, never a bank.
 * Every action is test-only, participant-authorized by the original services,
 * bounded and explicitly confirmed; no account can choose a payment amount.
 */
@Controller("sandbox")
@UseGuards(AuthGuard)
export class IsolatedSandboxFinanceController {
  constructor(
    private readonly bookings: BookingService,
    private readonly payments: PaymentService,
    private readonly wallet: WalletService,
    private readonly operations: FinancialOperationsService
  ) {}

  private confirm(input: { confirmation?: unknown }, expected: string) {
    if (!input || input.confirmation !== expected || Object.keys(input).some(key => key !== "confirmation"))
      throw new BadRequestException("Explicit sandbox confirmation is required");
  }

  @Post("bookings/:bookingId/fund")
  async fundBooking(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string,
    @Body() input: { confirmation?: unknown }
  ) {
    const secret = assertIsolatedSandboxFinance();
    this.confirm(input, "SIMULATE_TEST_FUNDS");
    // The authoritative Booking service checks participant access.
    const booking = await this.bookings.get(identity, bookingId);
    if (booking.viewerRole !== "CLIENT" || booking.agreedPriceMinor <= 0 ||
        booking.agreedPriceMinor > 50_000_000 || booking.currency !== "NGN" ||
        !["PAYMENT_PENDING","FUNDED"].includes(booking.status)) {
      throw new BadRequestException("Only a pending NGN staging booking may be funded");
    }
    if (booking.status === "FUNDED")
      return { simulated: true, realFundsMoved: false, status: "FUNDED", bookingId };
    const key = "staging-booking-" + createHash("sha256")
      .update(identity.subject + ":" + bookingId).digest("hex");
    const attempt = await this.payments.initialize(identity, {subjectType:"BOOKING",subjectId:bookingId},key);
    if (attempt.provider !== "HUSTLE_SANDBOX" || attempt.currency !== "NGN" ||
        attempt.amountMinor !== booking.agreedPriceMinor) {
      throw new BadRequestException("Unexpected sandbox provider or payment amount");
    }
    if (attempt.status === "PENDING" || attempt.status === "INITIATED") {
      const event = {
        eventId: "isolated-booking-funded:" + attempt.id,
        type: "payment.succeeded" as const,
        reference: attempt.providerReference,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency
      };
      const canonical = [event.eventId,event.type,event.reference,
        String(event.amountMinor),event.currency,"",""].join("|");
      const signature = createHmac("sha256", secret).update(canonical).digest("hex");
      await this.payments.handleVerifiedWebhook(event, signature);
    }
    const updated = await this.bookings.get(identity, bookingId);
    if (updated.status !== "FUNDED") {
      throw new BadRequestException("Staging ledger did not confirm escrow funding");
    }
    return { simulated: true, realFundsMoved: false, status: "FUNDED",
      bookingId, paymentAttemptId: attempt.id };
  }

  @Post("bookings/:bookingId/start")
  start(@CurrentIdentity() identity: AuthIdentity,
        @Param("bookingId") bookingId: string,
        @Body() input: { confirmation?: unknown }) {
    assertIsolatedSandboxFinance();
    this.confirm(input, "SIMULATE_TEST_WORK");
    return this.bookings.start(identity, bookingId);
  }

  @Post("bookings/:bookingId/complete")
  complete(@CurrentIdentity() identity: AuthIdentity,
           @Param("bookingId") bookingId: string,
           @Body() input: { confirmation?: unknown }) {
    assertIsolatedSandboxFinance();
    this.confirm(input, "SIMULATE_TEST_WORK");
    return this.bookings.complete(identity, bookingId);
  }

  @Post("bookings/:bookingId/release")
  release(@CurrentIdentity() identity: AuthIdentity,
          @Param("bookingId") bookingId: string,
          @Body() input: { confirmation?: unknown }) {
    assertIsolatedSandboxFinance();
    this.confirm(input, "SIMULATE_TEST_RELEASE");
    return this.wallet.releaseBookingEscrow(identity, bookingId);
  }

  @Post("wallet/withdrawals")
  withdraw(@CurrentIdentity() identity: AuthIdentity,
           @Body() input: { confirmation?: unknown; amountMinor?: unknown; currency?: unknown },
           @Headers("idempotency-key") idempotencyKey?: string) {
    assertIsolatedSandboxFinance();
    if (!input || input.confirmation !== "SIMULATE_TEST_WITHDRAWAL" ||
        input.currency !== "NGN" || !Number.isSafeInteger(input.amountMinor) ||
        Number(input.amountMinor) <= 0 || Number(input.amountMinor) > 50_000_000 ||
        Object.keys(input).some(k => !["confirmation","amountMinor","currency"].includes(k))) {
      throw new BadRequestException("Sandbox withdrawals require a bounded NGN amount and explicit confirmation");
    }
    return this.operations.requestPayout(identity,
      { amountMinor: input.amountMinor, currency: "NGN" }, idempotencyKey);
  }
}

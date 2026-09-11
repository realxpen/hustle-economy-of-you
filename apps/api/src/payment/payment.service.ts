import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  BookingStatus,
  EscrowStatus,
  FinancialAccountType,
  FinancialSubjectType,
  LedgerPostingDirection,
  LedgerTransactionType,
  OrderStatus,
  PaymentAttemptStatus,
  Prisma,
  WebhookEventStatus
} from "@prisma/client";
import { randomUUID } from "node:crypto";

import { BookingService } from "../booking/booking.service";
import { CommerceService } from "../commerce/commerce.service";
import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
  type VerifiedGatewayWebhook
} from "./payment-gateway.port";

export interface InitializePaymentInput {
  subjectType?: unknown;
  subjectId?: unknown;
}

type PaymentSubject = {
  subjectType: FinancialSubjectType;
  subjectId: string;
  payerUserId: string;
  beneficiaryUserId: string;
  amountMinor: number;
  currency: string;
};

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingService: BookingService,
    private readonly commerceService: CommerceService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort
  ) {}

  async initialize(identity: AuthIdentity, input: InitializePaymentInput, idempotencyHeader?: string) {
    const user = await this.requireUser(identity);
    const subjectType = this.subjectType(input.subjectType);
    const subjectId = this.requiredId(input.subjectId, "subjectId");
    const idempotencyKey = this.requiredIdempotencyKey(idempotencyHeader);

    const existingByKey = await this.prisma.paymentAttempt.findUnique({ where: { idempotencyKey } });
    if (existingByKey) {
      if (
        existingByKey.payerUserId !== user.id ||
        existingByKey.subjectType !== subjectType ||
        existingByKey.subjectId !== subjectId
      ) {
        throw new ConflictException("Idempotency-Key is already associated with another payment");
      }
      return this.serializeAttempt(existingByKey);
    }

    const subject = await this.resolveSubject(subjectType, subjectId, user.id);
    const active = await this.prisma.paymentAttempt.findFirst({
      where: {
        subjectType,
        subjectId,
        payerUserId: user.id,
        status: { in: [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.SUCCEEDED] }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    if (active) return this.serializeAttempt(active);

    const attemptId = randomUUID();
    const initialized = await this.gateway.initializePayment({
      attemptId,
      subjectType,
      subjectId,
      amountMinor: subject.amountMinor,
      currency: subject.currency
    });

    try {
      const attempt = await this.prisma.paymentAttempt.create({
        data: {
          id: attemptId,
          subjectType,
          subjectId,
          payerUserId: subject.payerUserId,
          beneficiaryUserId: subject.beneficiaryUserId,
          provider: initialized.provider,
          providerReference: initialized.providerReference,
          idempotencyKey,
          status: PaymentAttemptStatus.PENDING,
          amountMinor: subject.amountMinor,
          currency: subject.currency,
          checkoutUrl: initialized.checkoutUrl,
          providerMetadata: initialized.metadata ?? Prisma.JsonNull
        }
      });

      await this.recordEvent("payment.initiated", {
        paymentAttemptId: attempt.id,
        subjectType,
        subjectId,
        payerUserId: subject.payerUserId,
        beneficiaryUserId: subject.beneficiaryUserId,
        provider: attempt.provider,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        status: attempt.status
      });
      return this.serializeAttempt(attempt);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await this.prisma.paymentAttempt.findUnique({ where: { idempotencyKey } });
        if (raced) return this.serializeAttempt(raced);
      }
      throw error;
    }
  }

  async getAttempt(identity: AuthIdentity, attemptId: string) {
    const user = await this.requireUser(identity);
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        id: this.requiredId(attemptId, "paymentAttemptId"),
        OR: [{ payerUserId: user.id }, { beneficiaryUserId: user.id }]
      }
    });
    if (!attempt) throw new NotFoundException("Payment attempt not found");
    return this.serializeAttempt(attempt);
  }

  async handleVerifiedWebhook(payload: unknown, signature?: string) {
    const webhook = await this.gateway.verifyWebhook(payload, signature);
    let event = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: webhook.provider, eventId: webhook.eventId } }
    });

    if (event?.status === WebhookEventStatus.PROCESSED || event?.status === WebhookEventStatus.IGNORED) {
      return { accepted: true, duplicate: true, eventId: webhook.eventId, status: event.status };
    }

    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { providerReference: webhook.providerReference }
    });

    if (!event) {
      event = await this.prisma.webhookEvent.create({
        data: {
          provider: webhook.provider,
          eventId: webhook.eventId,
          paymentAttemptId: attempt?.id ?? null,
          eventType: webhook.type,
          providerReference: webhook.providerReference,
          payloadDigest: webhook.payloadDigest,
          status: WebhookEventStatus.RECEIVED
        }
      });
    } else if (!event.paymentAttemptId && attempt) {
      event = await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { paymentAttemptId: attempt.id, status: WebhookEventStatus.RECEIVED, errorCode: null, errorMessage: null }
      });
    }

    if (!attempt) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: WebhookEventStatus.IGNORED, processedAt: new Date(), errorCode: "UNKNOWN_REFERENCE" }
      });
      return { accepted: true, ignored: true, eventId: webhook.eventId, reason: "UNKNOWN_REFERENCE" };
    }

    this.assertWebhookMatchesAttempt(webhook, attempt);

    if (webhook.type === "payment.failed") {
      if (attempt.status === PaymentAttemptStatus.SUCCEEDED) {
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: { status: WebhookEventStatus.IGNORED, processedAt: new Date(), errorCode: "STALE_FAILURE_AFTER_SUCCESS" }
        });
        return { accepted: true, ignored: true, eventId: webhook.eventId, reason: "STALE_FAILURE_AFTER_SUCCESS" };
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.paymentAttempt.updateMany({
          where: { id: attempt.id, status: { in: [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.INITIATED] } },
          data: {
            status: PaymentAttemptStatus.FAILED,
            failedAt: new Date(),
            failureCode: webhook.failureCode ?? "PROVIDER_FAILED",
            failureReason: webhook.failureReason ?? "Sandbox provider reported payment failure"
          }
        });
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date(), errorCode: null, errorMessage: null }
        });
        await tx.systemEvent.create({
          data: {
            name: "payment.failed",
            source: "payment",
            payload: {
              paymentAttemptId: attempt.id,
              subjectType: attempt.subjectType,
              subjectId: attempt.subjectId,
              provider: attempt.provider,
              failureCode: webhook.failureCode ?? "PROVIDER_FAILED"
            }
          }
        });
      });
      return { accepted: true, eventId: webhook.eventId, paymentAttemptId: attempt.id, status: "FAILED" };
    }

    if (attempt.status === PaymentAttemptStatus.FAILED || attempt.status === PaymentAttemptStatus.CANCELLED) {
      await this.markWebhookFailure(event.id, "INVALID_ATTEMPT_STATE", `Payment attempt is ${attempt.status}`);
      throw new ConflictException(`Payment attempt cannot succeed from ${attempt.status}`);
    }

    if (attempt.status !== PaymentAttemptStatus.SUCCEEDED) {
      await this.prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { in: [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.INITIATED] } },
        data: { status: PaymentAttemptStatus.SUCCEEDED, confirmedAt: new Date(), failureCode: null, failureReason: null }
      });
    }

    try {
      await this.applyConfirmedPayment(attempt.id);
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date(), errorCode: null, errorMessage: null }
      });
      const applied = await this.prisma.paymentAttempt.findUnique({ where: { id: attempt.id } });
      return {
        accepted: true,
        duplicate: attempt.status === PaymentAttemptStatus.SUCCEEDED,
        eventId: webhook.eventId,
        paymentAttempt: applied ? this.serializeAttempt(applied) : null
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Financial domain application failed";
      await this.markWebhookFailure(event.id, "DOMAIN_APPLICATION_FAILED", message);
      await this.recordEvent("reconciliation.mismatch", {
        paymentAttemptId: attempt.id,
        subjectType: attempt.subjectType,
        subjectId: attempt.subjectId,
        providerReference: attempt.providerReference,
        reason: "DOMAIN_APPLICATION_FAILED"
      });
      throw error;
    }
  }

  private async applyConfirmedPayment(attemptId: string) {
    let attempt = await this.prisma.paymentAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException("Payment attempt not found");
    if (attempt.status !== PaymentAttemptStatus.SUCCEEDED) {
      throw new ConflictException("Only a confirmed payment can be applied");
    }
    if (attempt.domainAppliedAt) return;

    if (attempt.subjectType === FinancialSubjectType.BOOKING) {
      await this.postFinancialCapture(attempt, FinancialAccountType.ESCROW);
      await this.bookingService.markFundedFromAuthoritativePayment({
        bookingId: attempt.subjectId,
        fundingReference: attempt.providerReference,
        source: "phase13:sandbox"
      });
    } else {
      await this.commerceService.markPaidFromAuthoritativePayment({
        orderId: attempt.subjectId,
        paymentReference: attempt.providerReference,
        source: "phase13:sandbox"
      });
      await this.postFinancialCapture(attempt, FinancialAccountType.PENDING);
    }

    attempt = await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { domainAppliedAt: new Date() }
    });
    return attempt;
  }

  private async postFinancialCapture(
    attempt: Prisma.PaymentAttemptGetPayload<Record<string, never>>,
    beneficiaryAccountType: FinancialAccountType
  ) {
    const idempotencyKey = `payment:${attempt.id}:confirmed`;
    const existing = await this.prisma.ledgerTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const raced = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey } });
      if (raced) return raced;

      const clearing = await tx.ledgerAccount.upsert({
        where: { key: `platform:${attempt.provider}:clearing:${attempt.currency}` },
        create: {
          key: `platform:${attempt.provider}:clearing:${attempt.currency}`,
          type: FinancialAccountType.PROVIDER_CLEARING,
          currency: attempt.currency
        },
        update: {}
      });
      const beneficiary = await tx.ledgerAccount.upsert({
        where: { key: `user:${attempt.beneficiaryUserId}:${beneficiaryAccountType}:${attempt.currency}` },
        create: {
          key: `user:${attempt.beneficiaryUserId}:${beneficiaryAccountType}:${attempt.currency}`,
          userId: attempt.beneficiaryUserId,
          type: beneficiaryAccountType,
          currency: attempt.currency
        },
        update: {}
      });

      const ledger = await tx.ledgerTransaction.create({
        data: {
          subjectType: attempt.subjectType,
          subjectId: attempt.subjectId,
          paymentAttemptId: attempt.id,
          type: LedgerTransactionType.PAYMENT_CONFIRMED,
          reference: attempt.providerReference,
          idempotencyKey,
          postings: {
            create: [
              { accountId: clearing.id, direction: LedgerPostingDirection.DEBIT, amountMinor: attempt.amountMinor },
              { accountId: beneficiary.id, direction: LedgerPostingDirection.CREDIT, amountMinor: attempt.amountMinor }
            ]
          }
        }
      });

      await tx.systemEvent.create({
        data: {
          name: "payment.confirmed",
          source: "payment",
          payload: {
            paymentAttemptId: attempt.id,
            subjectType: attempt.subjectType,
            subjectId: attempt.subjectId,
            provider: attempt.provider,
            providerReference: attempt.providerReference,
            amountMinor: attempt.amountMinor,
            currency: attempt.currency
          }
        }
      });

      if (attempt.subjectType === FinancialSubjectType.BOOKING) {
        const escrow = await tx.escrowRecord.upsert({
          where: { subjectType_subjectId: { subjectType: attempt.subjectType, subjectId: attempt.subjectId } },
          create: {
            subjectType: attempt.subjectType,
            subjectId: attempt.subjectId,
            paymentAttemptId: attempt.id,
            beneficiaryUserId: attempt.beneficiaryUserId,
            amountMinor: attempt.amountMinor,
            currency: attempt.currency,
            status: EscrowStatus.HELD,
            heldAt: new Date()
          },
          update: {}
        });
        if (escrow.paymentAttemptId !== attempt.id || escrow.amountMinor !== attempt.amountMinor || escrow.currency !== attempt.currency) {
          throw new ConflictException("Existing escrow does not match this payment attempt");
        }
        if (escrow.status !== EscrowStatus.HELD) {
          throw new ConflictException(`Booking escrow cannot be funded from ${escrow.status}`);
        }
        await tx.systemEvent.create({
          data: {
            name: "escrow.held",
            source: "payment",
            payload: {
              escrowId: escrow.id,
              paymentAttemptId: attempt.id,
              bookingId: attempt.subjectId,
              beneficiaryUserId: attempt.beneficiaryUserId,
              amountMinor: attempt.amountMinor,
              currency: attempt.currency,
              status: EscrowStatus.HELD
            }
          }
        });
      }

      return ledger;
    });
  }

  private async resolveSubject(subjectType: FinancialSubjectType, subjectId: string, payerUserId: string): Promise<PaymentSubject> {
    if (subjectType === FinancialSubjectType.BOOKING) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: subjectId },
        select: {
          id: true,
          clientUserId: true,
          hustlerUserId: true,
          status: true,
          agreedPriceMinor: true,
          currency: true
        }
      });
      if (!booking) throw new NotFoundException("Booking not found");
      if (booking.clientUserId !== payerUserId) throw new ForbiddenException("Only the Booking client can initialize payment");
      if (booking.status !== BookingStatus.PAYMENT_PENDING) {
        throw new ConflictException(`Booking payment cannot start from ${booking.status}`);
      }
      if (booking.agreedPriceMinor <= 0) throw new ConflictException("Booking does not require payment");
      return {
        subjectType,
        subjectId,
        payerUserId,
        beneficiaryUserId: booking.hustlerUserId,
        amountMinor: booking.agreedPriceMinor,
        currency: booking.currency.toUpperCase()
      };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: subjectId },
      select: { id: true, buyerUserId: true, sellerUserId: true, status: true, totalMinor: true, currency: true }
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.buyerUserId !== payerUserId) throw new ForbiddenException("Only the Order buyer can initialize payment");
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException(`Order payment cannot start from ${order.status}`);
    }
    if (order.totalMinor <= 0) throw new ConflictException("Order does not require payment");
    return {
      subjectType,
      subjectId,
      payerUserId,
      beneficiaryUserId: order.sellerUserId,
      amountMinor: order.totalMinor,
      currency: order.currency.toUpperCase()
    };
  }

  private assertWebhookMatchesAttempt(
    webhook: VerifiedGatewayWebhook,
    attempt: { provider: string; amountMinor: number; currency: string }
  ) {
    if (webhook.provider !== attempt.provider) throw new ConflictException("Webhook provider does not match payment attempt");
    if (webhook.amountMinor !== attempt.amountMinor) throw new ConflictException("Webhook amount does not match payment attempt");
    if (webhook.currency.toUpperCase() !== attempt.currency.toUpperCase()) {
      throw new ConflictException("Webhook currency does not match payment attempt");
    }
  }

  private async markWebhookFailure(eventId: string, errorCode: string, errorMessage: string) {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: WebhookEventStatus.FAILED,
        errorCode,
        errorMessage: errorMessage.slice(0, 500)
      }
    });
  }

  private serializeAttempt(attempt: {
    id: string;
    subjectType: FinancialSubjectType;
    subjectId: string;
    payerUserId: string;
    beneficiaryUserId: string;
    provider: string;
    providerReference: string;
    status: PaymentAttemptStatus;
    amountMinor: number;
    currency: string;
    checkoutUrl: string | null;
    confirmedAt: Date | null;
    domainAppliedAt: Date | null;
    failedAt: Date | null;
    failureCode: string | null;
    failureReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: attempt.id,
      subjectType: attempt.subjectType,
      subjectId: attempt.subjectId,
      payerUserId: attempt.payerUserId,
      beneficiaryUserId: attempt.beneficiaryUserId,
      provider: attempt.provider,
      providerReference: attempt.providerReference,
      status: attempt.status,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
      checkoutUrl: attempt.checkoutUrl,
      confirmedAt: attempt.confirmedAt,
      domainAppliedAt: attempt.domainAppliedAt,
      failedAt: attempt.failedAt,
      failureCode: attempt.failureCode,
      failureReason: attempt.failureReason,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
      authoritative: attempt.status === PaymentAttemptStatus.SUCCEEDED,
      appliedToSubject: attempt.domainAppliedAt !== null
    };
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({ where: { authSubject: identity.subject }, select: { id: true } });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private subjectType(value: unknown) {
    if (value === FinancialSubjectType.BOOKING || value === FinancialSubjectType.ORDER) return value;
    throw new BadRequestException("subjectType must be BOOKING or ORDER");
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 300) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private requiredIdempotencyKey(value?: string) {
    if (!value?.trim()) throw new BadRequestException("Idempotency-Key header is required");
    const normalized = value.trim();
    if (normalized.length < 8 || normalized.length > 200) {
      throw new BadRequestException("Idempotency-Key must be between 8 and 200 characters");
    }
    return normalized;
  }

  private async recordEvent(name: string, payload: Prisma.InputJsonObject) {
    await this.prisma.systemEvent.create({ data: { name, source: "payment", payload } });
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  EscrowStatus,
  FinancialAccountType,
  FinancialOperationStatus,
  FinancialSubjectType,
  LedgerPostingDirection,
  LedgerTransactionType,
  OrderStatus,
  BookingStatus,
  PaymentAttemptStatus,
  Prisma,
  WebhookEventStatus
} from "@prisma/client";
import { randomUUID } from "node:crypto";

import { BookingFinancialService } from "../booking/booking-financial.service";
import { CommerceFinancialService } from "../commerce/commerce-financial.service";
import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  FINANCIAL_OPERATION_GATEWAY,
  type FinancialOperationPort,
  type VerifiedFinancialOperationWebhook
} from "./financial-operation.port";

export interface RequestPayoutInput {
  amountMinor?: unknown;
  currency?: unknown;
}

export interface RequestRefundInput {
  subjectType?: unknown;
  subjectId?: unknown;
}

@Injectable()
export class FinancialOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingFinancial: BookingFinancialService,
    private readonly commerceFinancial: CommerceFinancialService,
    @Inject(FINANCIAL_OPERATION_GATEWAY) private readonly gateway: FinancialOperationPort
  ) {}

  async requestPayout(identity: AuthIdentity, input: RequestPayoutInput, idempotencyHeader?: string) {
    const user = await this.requireUser(identity);
    const amountMinor = this.positiveAmount(input.amountMinor);
    const currency = this.currency(input.currency);
    const idempotencyKey = this.idempotencyKey(idempotencyHeader);

    const existing = await this.prisma.payout.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.userId !== user.id || existing.amountMinor !== amountMinor || existing.currency !== currency) {
        throw new ConflictException("Idempotency-Key is already associated with another withdrawal");
      }
      return this.serializePayout(existing);
    }

    const payoutId = randomUUID();
    const provider = await this.gateway.createPayout({
      operationId: payoutId,
      userId: user.id,
      amountMinor,
      currency
    });

    try {
      const payout = await this.prisma.$transaction(async (tx) => {
        const raced = await tx.payout.findUnique({ where: { idempotencyKey } });
        if (raced) return raced;

        const available = await this.account(tx, user.id, FinancialAccountType.AVAILABLE, currency);
        const reserved = await this.account(tx, user.id, FinancialAccountType.PAYOUT_RESERVED, currency);
        const availableBalance = await this.accountBalance(tx, available.id);
        if (availableBalance < amountMinor) {
          throw new ConflictException("Available wallet balance is insufficient for this withdrawal");
        }

        const created = await tx.payout.create({
          data: {
            id: payoutId,
            userId: user.id,
            currency,
            amountMinor,
            status: FinancialOperationStatus.PROCESSING,
            provider: provider.provider,
            providerReference: provider.reference,
            idempotencyKey
          }
        });

        await tx.ledgerTransaction.create({
          data: {
            subjectType: FinancialSubjectType.PAYOUT,
            subjectId: created.id,
            type: LedgerTransactionType.PAYOUT_RESERVED,
            reference: provider.reference,
            idempotencyKey: `payout:${created.id}:reserved`,
            postings: {
              create: [
                { accountId: available.id, direction: LedgerPostingDirection.DEBIT, amountMinor },
                { accountId: reserved.id, direction: LedgerPostingDirection.CREDIT, amountMinor }
              ]
            }
          }
        });

        await tx.systemEvent.create({
          data: {
            name: "payout.requested",
            source: "payment",
            payload: {
              payoutId: created.id,
              userId: user.id,
              provider: created.provider,
              amountMinor,
              currency,
              status: created.status
            }
          }
        });

        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return this.serializePayout(payout);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException("Wallet changed during withdrawal reservation. Retry with the same Idempotency-Key");
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await this.prisma.payout.findUnique({ where: { idempotencyKey } });
        if (raced) return this.serializePayout(raced);
      }
      throw error;
    }
  }

  async requestRefund(identity: AuthIdentity, input: RequestRefundInput, idempotencyHeader?: string) {
    const user = await this.requireUser(identity);
    const subjectType = this.subjectType(input.subjectType);
    const subjectId = this.requiredId(input.subjectId, "subjectId");
    const idempotencyKey = this.idempotencyKey(idempotencyHeader);

    const existing = await this.prisma.refund.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.requestedByUserId !== user.id || existing.subjectType !== subjectType || existing.subjectId !== subjectId) {
        throw new ConflictException("Idempotency-Key is already associated with another refund");
      }
      return this.serializeRefund(existing);
    }

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        subjectType,
        subjectId,
        payerUserId: user.id,
        status: PaymentAttemptStatus.SUCCEEDED,
        domainAppliedAt: { not: null }
      },
      orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }]
    });
    if (!attempt) throw new ForbiddenException("Only the payer of an applied successful payment can request its refund");

    await this.assertRefundableDomainState(subjectType, subjectId, attempt.id);

    const active = await this.prisma.refund.findFirst({
      where: {
        paymentAttemptId: attempt.id,
        status: { in: [FinancialOperationStatus.REQUESTED, FinancialOperationStatus.PROCESSING, FinancialOperationStatus.SUCCEEDED] }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    if (active) return this.serializeRefund(active);

    const refundId = randomUUID();
    const provider = await this.gateway.createRefund({
      operationId: refundId,
      paymentReference: attempt.providerReference,
      subjectType,
      subjectId,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency
    });

    const refund = await this.prisma.$transaction(async (tx) => {
      if (subjectType === FinancialSubjectType.BOOKING) {
        const moved = await tx.escrowRecord.updateMany({
          where: {
            subjectType,
            subjectId,
            paymentAttemptId: attempt.id,
            status: EscrowStatus.HELD
          },
          data: { status: EscrowStatus.REFUND_PENDING }
        });
        if (moved.count !== 1) throw new ConflictException("Booking escrow is not available for refund");
      }

      const created = await tx.refund.create({
        data: {
          id: refundId,
          subjectType,
          subjectId,
          paymentAttemptId: attempt.id,
          requestedByUserId: user.id,
          currency: attempt.currency,
          amountMinor: attempt.amountMinor,
          status: FinancialOperationStatus.PROCESSING,
          providerReference: provider.reference,
          idempotencyKey
        }
      });

      await tx.systemEvent.create({
        data: {
          name: "refund.requested",
          source: "payment",
          payload: {
            refundId: created.id,
            paymentAttemptId: attempt.id,
            subjectType,
            subjectId,
            requestedByUserId: user.id,
            amountMinor: attempt.amountMinor,
            currency: attempt.currency,
            status: created.status
          }
        }
      });

      return created;
    });

    return this.serializeRefund(refund);
  }

  async handleWebhook(payload: unknown, signature?: string) {
    const webhook = await this.gateway.verifyWebhook(payload, signature);
    if (webhook.type.startsWith("payout.")) return this.handlePayoutWebhook(webhook);
    return this.handleRefundWebhook(webhook);
  }

  async reconciliation(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    const [payments, payouts, refunds, accounts, webhookFailures, ledgerTransactions] = await Promise.all([
      this.prisma.paymentAttempt.findMany({
        where: {
          OR: [{ payerUserId: user.id }, { beneficiaryUserId: user.id }],
          status: PaymentAttemptStatus.SUCCEEDED,
          domainAppliedAt: null
        },
        select: { id: true, subjectType: true, subjectId: true, providerReference: true, confirmedAt: true }
      }),
      this.prisma.payout.findMany({
        where: { userId: user.id, status: FinancialOperationStatus.PROCESSING },
        select: { id: true, providerReference: true, amountMinor: true, currency: true, requestedAt: true }
      }),
      this.prisma.refund.findMany({
        where: {
          paymentAttempt: { OR: [{ payerUserId: user.id }, { beneficiaryUserId: user.id }] },
          status: FinancialOperationStatus.PROCESSING
        },
        select: { id: true, subjectType: true, subjectId: true, providerReference: true, amountMinor: true, currency: true, requestedAt: true }
      }),
      this.prisma.ledgerAccount.findMany({
        where: { userId: user.id },
        include: { postings: { select: { direction: true, amountMinor: true } } }
      }),
      this.prisma.webhookEvent.findMany({
        where: {
          status: WebhookEventStatus.FAILED,
          paymentAttempt: { OR: [{ payerUserId: user.id }, { beneficiaryUserId: user.id }] }
        },
        select: { id: true, eventId: true, eventType: true, providerReference: true, errorCode: true, errorMessage: true }
      }),
      this.prisma.ledgerTransaction.findMany({
        where: { postings: { some: { account: { userId: user.id } } } },
        include: { postings: { select: { direction: true, amountMinor: true } } },
        orderBy: { createdAt: "desc" },
        take: 200
      })
    ]);

    const issues: Array<Record<string, unknown>> = [];
    for (const payment of payments) issues.push({ code: "PAYMENT_DOMAIN_NOT_APPLIED", ...payment });
    for (const payout of payouts) issues.push({ code: "PAYOUT_AWAITING_PROVIDER", ...payout });
    for (const refund of refunds) issues.push({ code: "REFUND_AWAITING_PROVIDER", ...refund });
    for (const event of webhookFailures) issues.push({ code: "WEBHOOK_FAILED", ...event });

    for (const account of accounts) {
      const balance = account.postings.reduce(
        (sum, posting) => sum + (posting.direction === LedgerPostingDirection.CREDIT ? posting.amountMinor : -posting.amountMinor),
        0
      );
      if (balance < 0) {
        issues.push({
          code: "NEGATIVE_LEDGER_BALANCE",
          accountId: account.id,
          accountType: account.type,
          currency: account.currency,
          balanceMinor: balance
        });
      }
    }

    for (const transaction of ledgerTransactions) {
      const debit = transaction.postings
        .filter((posting) => posting.direction === LedgerPostingDirection.DEBIT)
        .reduce((sum, posting) => sum + posting.amountMinor, 0);
      const credit = transaction.postings
        .filter((posting) => posting.direction === LedgerPostingDirection.CREDIT)
        .reduce((sum, posting) => sum + posting.amountMinor, 0);
      if (debit !== credit) {
        issues.push({
          code: "UNBALANCED_LEDGER_TRANSACTION",
          ledgerTransactionId: transaction.id,
          debitMinor: debit,
          creditMinor: credit
        });
      }
    }

    return {
      userId: user.id,
      healthy: issues.length === 0,
      issueCount: issues.length,
      issues,
      checkedAt: new Date().toISOString(),
      scope: "USER_FINANCIAL_INVARIANTS"
    };
  }

  private async handlePayoutWebhook(webhook: VerifiedFinancialOperationWebhook) {
    const event = await this.getOrCreateWebhookEvent(webhook, null);
    if (event.status === WebhookEventStatus.PROCESSED || event.status === WebhookEventStatus.IGNORED) {
      return { accepted: true, duplicate: true, eventId: webhook.eventId, status: event.status };
    }

    const payout = await this.prisma.payout.findUnique({ where: { providerReference: webhook.providerReference } });
    if (!payout) return this.ignoreUnknown(event.id, webhook.eventId);
    this.assertOperationMatches(webhook, payout.amountMinor, payout.currency);

    if (webhook.type === "payout.failed") {
      if (payout.status === FinancialOperationStatus.SUCCEEDED) {
        return this.ignoreStale(event.id, webhook.eventId, "STALE_PAYOUT_FAILURE_AFTER_SUCCESS");
      }
      if (payout.status === FinancialOperationStatus.FAILED) {
        await this.markWebhookProcessed(event.id);
        return { accepted: true, duplicate: true, eventId: webhook.eventId, status: "FAILED" };
      }
      if (payout.status !== FinancialOperationStatus.PROCESSING && payout.status !== FinancialOperationStatus.REQUESTED) {
        throw new ConflictException(`Payout failure cannot be applied from ${payout.status}`);
      }

      await this.prisma.$transaction(async (tx) => {
        const reserved = await this.account(tx, payout.userId, FinancialAccountType.PAYOUT_RESERVED, payout.currency);
        const available = await this.account(tx, payout.userId, FinancialAccountType.AVAILABLE, payout.currency);
        const ledgerKey = `payout:${payout.id}:failed-reversal`;
        const existing = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: ledgerKey } });
        if (!existing) {
          await tx.ledgerTransaction.create({
            data: {
              subjectType: FinancialSubjectType.PAYOUT,
              subjectId: payout.id,
              type: LedgerTransactionType.PAYOUT_REVERSED,
              reference: payout.providerReference,
              idempotencyKey: ledgerKey,
              postings: {
                create: [
                  { accountId: reserved.id, direction: LedgerPostingDirection.DEBIT, amountMinor: payout.amountMinor },
                  { accountId: available.id, direction: LedgerPostingDirection.CREDIT, amountMinor: payout.amountMinor }
                ]
              }
            }
          });
        }
        await tx.payout.update({
          where: { id: payout.id },
          data: {
            status: FinancialOperationStatus.FAILED,
            failedAt: new Date(),
            failureReason: webhook.failureReason ?? webhook.failureCode ?? "Sandbox provider reported payout failure"
          }
        });
        await tx.webhookEvent.update({ where: { id: event.id }, data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() } });
        await tx.systemEvent.create({
          data: {
            name: "payout.failed",
            source: "payment",
            payload: { payoutId: payout.id, userId: payout.userId, amountMinor: payout.amountMinor, currency: payout.currency }
          }
        });
      });
      return { accepted: true, eventId: webhook.eventId, payoutId: payout.id, status: "FAILED" };
    }

    if (payout.status === FinancialOperationStatus.SUCCEEDED) {
      await this.markWebhookProcessed(event.id);
      return { accepted: true, duplicate: true, eventId: webhook.eventId, payoutId: payout.id, status: "SUCCEEDED" };
    }
    if (payout.status !== FinancialOperationStatus.PROCESSING && payout.status !== FinancialOperationStatus.REQUESTED) {
      throw new ConflictException(`Payout success cannot be applied from ${payout.status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const reserved = await this.account(tx, payout.userId, FinancialAccountType.PAYOUT_RESERVED, payout.currency);
      const clearing = await this.providerClearing(tx, payout.provider, payout.currency);
      const ledgerKey = `payout:${payout.id}:sent`;
      const existing = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: ledgerKey } });
      if (!existing) {
        await tx.ledgerTransaction.create({
          data: {
            subjectType: FinancialSubjectType.PAYOUT,
            subjectId: payout.id,
            type: LedgerTransactionType.PAYOUT_SENT,
            reference: payout.providerReference,
            idempotencyKey: ledgerKey,
            postings: {
              create: [
                { accountId: reserved.id, direction: LedgerPostingDirection.DEBIT, amountMinor: payout.amountMinor },
                { accountId: clearing.id, direction: LedgerPostingDirection.CREDIT, amountMinor: payout.amountMinor }
              ]
            }
          }
        });
      }
      await tx.payout.update({
        where: { id: payout.id },
        data: { status: FinancialOperationStatus.SUCCEEDED, confirmedAt: new Date(), failedAt: null, failureReason: null }
      });
      await tx.webhookEvent.update({ where: { id: event.id }, data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() } });
      await tx.systemEvent.create({
        data: {
          name: "payout.confirmed",
          source: "payment",
          payload: { payoutId: payout.id, userId: payout.userId, amountMinor: payout.amountMinor, currency: payout.currency }
        }
      });
    });

    return { accepted: true, eventId: webhook.eventId, payoutId: payout.id, status: "SUCCEEDED" };
  }

  private async handleRefundWebhook(webhook: VerifiedFinancialOperationWebhook) {
    const refund = await this.prisma.refund.findUnique({
      where: { providerReference: webhook.providerReference },
      include: { paymentAttempt: true }
    });
    const event = await this.getOrCreateWebhookEvent(webhook, refund?.paymentAttemptId ?? null);
    if (event.status === WebhookEventStatus.PROCESSED || event.status === WebhookEventStatus.IGNORED) {
      return { accepted: true, duplicate: true, eventId: webhook.eventId, status: event.status };
    }
    if (!refund) return this.ignoreUnknown(event.id, webhook.eventId);
    this.assertOperationMatches(webhook, refund.amountMinor, refund.currency);

    if (webhook.type === "refund.failed") {
      if (refund.status === FinancialOperationStatus.SUCCEEDED) {
        return this.ignoreStale(event.id, webhook.eventId, "STALE_REFUND_FAILURE_AFTER_SUCCESS");
      }
      if (refund.status === FinancialOperationStatus.FAILED) {
        await this.markWebhookProcessed(event.id);
        return { accepted: true, duplicate: true, eventId: webhook.eventId, refundId: refund.id, status: "FAILED" };
      }
      if (refund.status !== FinancialOperationStatus.PROCESSING && refund.status !== FinancialOperationStatus.REQUESTED) {
        throw new ConflictException(`Refund failure cannot be applied from ${refund.status}`);
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: FinancialOperationStatus.FAILED,
            failedAt: new Date(),
            failureReason: webhook.failureReason ?? webhook.failureCode ?? "Sandbox provider reported refund failure"
          }
        });
        if (refund.subjectType === FinancialSubjectType.BOOKING) {
          await tx.escrowRecord.updateMany({
            where: { subjectType: refund.subjectType, subjectId: refund.subjectId, status: EscrowStatus.REFUND_PENDING },
            data: { status: EscrowStatus.HELD }
          });
        }
        await tx.webhookEvent.update({ where: { id: event.id }, data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() } });
        await tx.systemEvent.create({
          data: {
            name: "refund.failed",
            source: "payment",
            payload: { refundId: refund.id, subjectType: refund.subjectType, subjectId: refund.subjectId }
          }
        });
      });
      return { accepted: true, eventId: webhook.eventId, refundId: refund.id, status: "FAILED" };
    }

    if (refund.status === FinancialOperationStatus.SUCCEEDED) {
      await this.markWebhookProcessed(event.id);
      return { accepted: true, duplicate: true, eventId: webhook.eventId, refundId: refund.id, status: "SUCCEEDED" };
    }
    if (refund.status !== FinancialOperationStatus.PROCESSING && refund.status !== FinancialOperationStatus.REQUESTED) {
      throw new ConflictException(`Refund success cannot be applied from ${refund.status}`);
    }

    if (refund.subjectType === FinancialSubjectType.BOOKING) {
      await this.bookingFinancial.markRefundedFromAuthoritativeRefund({
        bookingId: refund.subjectId,
        refundReference: refund.providerReference ?? refund.id,
        source: "phase13:sandbox"
      });
    } else {
      await this.commerceFinancial.markRefundedFromAuthoritativeRefund({
        orderId: refund.subjectId,
        refundReference: refund.providerReference ?? refund.id,
        source: "phase13:sandbox"
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const beneficiaryAccountType = refund.subjectType === FinancialSubjectType.BOOKING
        ? FinancialAccountType.ESCROW
        : FinancialAccountType.PENDING;
      const beneficiary = await this.account(
        tx,
        refund.paymentAttempt.beneficiaryUserId,
        beneficiaryAccountType,
        refund.currency
      );
      const clearing = await this.providerClearing(tx, refund.paymentAttempt.provider, refund.currency);
      const ledgerKey = `refund:${refund.id}:confirmed`;
      const existing = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: ledgerKey } });
      if (!existing) {
        await tx.ledgerTransaction.create({
          data: {
            subjectType: refund.subjectType,
            subjectId: refund.subjectId,
            paymentAttemptId: refund.paymentAttemptId,
            type: LedgerTransactionType.REFUND,
            reference: refund.providerReference,
            idempotencyKey: ledgerKey,
            postings: {
              create: [
                { accountId: beneficiary.id, direction: LedgerPostingDirection.DEBIT, amountMinor: refund.amountMinor },
                { accountId: clearing.id, direction: LedgerPostingDirection.CREDIT, amountMinor: refund.amountMinor }
              ]
            }
          }
        });
      }
      await tx.refund.update({
        where: { id: refund.id },
        data: { status: FinancialOperationStatus.SUCCEEDED, confirmedAt: new Date(), failedAt: null, failureReason: null }
      });
      if (refund.subjectType === FinancialSubjectType.BOOKING) {
        await tx.escrowRecord.updateMany({
          where: { subjectType: refund.subjectType, subjectId: refund.subjectId, status: EscrowStatus.REFUND_PENDING },
          data: { status: EscrowStatus.REFUNDED, refundedAt: new Date() }
        });
      }
      await tx.webhookEvent.update({ where: { id: event.id }, data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() } });
      await tx.systemEvent.create({
        data: {
          name: "refund.confirmed",
          source: "payment",
          payload: {
            refundId: refund.id,
            subjectType: refund.subjectType,
            subjectId: refund.subjectId,
            amountMinor: refund.amountMinor,
            currency: refund.currency
          }
        }
      });
    });

    return { accepted: true, eventId: webhook.eventId, refundId: refund.id, status: "SUCCEEDED" };
  }

  private async assertRefundableDomainState(subjectType: FinancialSubjectType, subjectId: string, attemptId: string) {
    if (subjectType === FinancialSubjectType.BOOKING) {
      const [booking, escrow] = await Promise.all([
        this.prisma.booking.findUnique({ where: { id: subjectId }, select: { status: true } }),
        this.prisma.escrowRecord.findUnique({
          where: { subjectType_subjectId: { subjectType, subjectId } },
          select: { status: true, paymentAttemptId: true }
        })
      ]);
      if (!booking) throw new NotFoundException("Booking not found");
      if (booking.status !== BookingStatus.FUNDED && booking.status !== BookingStatus.DISPUTED) {
        throw new ConflictException(`Booking refund cannot start from ${booking.status}`);
      }
      if (!escrow || escrow.paymentAttemptId !== attemptId || escrow.status !== EscrowStatus.HELD) {
        throw new ConflictException("Booking funds are not currently held in refundable escrow");
      }
      return;
    }

    const order = await this.prisma.order.findUnique({ where: { id: subjectId }, select: { status: true } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== OrderStatus.PAID) {
      throw new ConflictException(`Order refund can only start before fulfillment, from PAID; current status is ${order.status}`);
    }
  }

  private async getOrCreateWebhookEvent(webhook: VerifiedFinancialOperationWebhook, paymentAttemptId: string | null) {
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: webhook.provider, eventId: webhook.eventId } }
    });
    if (existing) return existing;
    try {
      return await this.prisma.webhookEvent.create({
        data: {
          provider: webhook.provider,
          eventId: webhook.eventId,
          paymentAttemptId,
          eventType: webhook.type,
          providerReference: webhook.providerReference,
          payloadDigest: webhook.payloadDigest,
          status: WebhookEventStatus.RECEIVED
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await this.prisma.webhookEvent.findUnique({
          where: { provider_eventId: { provider: webhook.provider, eventId: webhook.eventId } }
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  private assertOperationMatches(webhook: VerifiedFinancialOperationWebhook, amountMinor: number, currency: string) {
    if (webhook.amountMinor !== amountMinor) throw new BadRequestException("Financial-operation webhook amount does not match internal record");
    if (webhook.currency !== currency.toUpperCase()) throw new BadRequestException("Financial-operation webhook currency does not match internal record");
  }

  private async ignoreUnknown(eventId: string, providerEventId: string) {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: WebhookEventStatus.IGNORED, processedAt: new Date(), errorCode: "UNKNOWN_REFERENCE" }
    });
    return { accepted: true, ignored: true, eventId: providerEventId, reason: "UNKNOWN_REFERENCE" };
  }

  private async ignoreStale(eventId: string, providerEventId: string, reason: string) {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: WebhookEventStatus.IGNORED, processedAt: new Date(), errorCode: reason }
    });
    return { accepted: true, ignored: true, eventId: providerEventId, reason };
  }

  private async markWebhookProcessed(eventId: string) {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() }
    });
  }

  private account(tx: Prisma.TransactionClient, userId: string, type: FinancialAccountType, currency: string) {
    const key = `user:${userId}:${type}:${currency}`;
    return tx.ledgerAccount.upsert({
      where: { key },
      create: { key, userId, type, currency },
      update: {}
    });
  }

  private providerClearing(tx: Prisma.TransactionClient, provider: string, currency: string) {
    const key = `platform:${provider}:clearing:${currency}`;
    return tx.ledgerAccount.upsert({
      where: { key },
      create: { key, type: FinancialAccountType.PROVIDER_CLEARING, currency },
      update: {}
    });
  }

  private async accountBalance(tx: Prisma.TransactionClient, accountId: string) {
    const postings = await tx.ledgerPosting.findMany({
      where: { accountId },
      select: { direction: true, amountMinor: true }
    });
    return postings.reduce(
      (sum, posting) => sum + (posting.direction === LedgerPostingDirection.CREDIT ? posting.amountMinor : -posting.amountMinor),
      0
    );
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({ where: { authSubject: identity.subject }, select: { id: true } });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private positiveAmount(value: unknown) {
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestException("amountMinor must be a positive integer");
    return amount;
  }

  private currency(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z]{3,12}$/.test(value.trim())) {
      throw new BadRequestException("currency is required");
    }
    return value.trim().toUpperCase();
  }

  private subjectType(value: unknown) {
    if (value === FinancialSubjectType.BOOKING || value === FinancialSubjectType.ORDER) return value;
    throw new BadRequestException("subjectType must be BOOKING or ORDER");
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private idempotencyKey(value?: string) {
    if (!value?.trim()) throw new BadRequestException("Idempotency-Key header is required");
    const normalized = value.trim();
    if (normalized.length > 200) throw new BadRequestException("Idempotency-Key is too long");
    return normalized;
  }

  private serializePayout(payout: {
    id: string;
    userId: string;
    currency: string;
    amountMinor: number;
    status: FinancialOperationStatus;
    provider: string;
    providerReference: string | null;
    requestedAt: Date;
    confirmedAt: Date | null;
    failedAt: Date | null;
    failureReason: string | null;
  }) {
    return {
      id: payout.id,
      userId: payout.userId,
      currency: payout.currency,
      amountMinor: payout.amountMinor,
      status: payout.status,
      provider: payout.provider,
      providerReference: payout.providerReference,
      requestedAt: payout.requestedAt,
      confirmedAt: payout.confirmedAt,
      failedAt: payout.failedAt,
      failureReason: payout.failureReason,
      authoritative: payout.status === FinancialOperationStatus.SUCCEEDED
    };
  }

  private serializeRefund(refund: {
    id: string;
    subjectType: FinancialSubjectType;
    subjectId: string;
    paymentAttemptId: string;
    requestedByUserId: string | null;
    currency: string;
    amountMinor: number;
    status: FinancialOperationStatus;
    providerReference: string | null;
    requestedAt: Date;
    confirmedAt: Date | null;
    failedAt: Date | null;
    failureReason: string | null;
  }) {
    return {
      id: refund.id,
      subjectType: refund.subjectType,
      subjectId: refund.subjectId,
      paymentAttemptId: refund.paymentAttemptId,
      requestedByUserId: refund.requestedByUserId,
      currency: refund.currency,
      amountMinor: refund.amountMinor,
      status: refund.status,
      providerReference: refund.providerReference,
      requestedAt: refund.requestedAt,
      confirmedAt: refund.confirmedAt,
      failedAt: refund.failedAt,
      failureReason: refund.failureReason,
      authoritative: refund.status === FinancialOperationStatus.SUCCEEDED
    };
  }
}

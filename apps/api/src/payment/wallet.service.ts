import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  BookingStatus,
  EscrowStatus,
  FinancialAccountType,
  FinancialSubjectType,
  LedgerPostingDirection,
  LedgerTransactionType,
  OrderStatus,
  PaymentAttemptStatus,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface WalletPaginationInput {
  limit?: unknown;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    return this.walletForUser(user.id);
  }

  async listTransactions(identity: AuthIdentity, input: WalletPaginationInput = {}) {
    const user = await this.requireUser(identity);
    const limit = this.parseLimit(input.limit, 30, 100);
    const postings = await this.prisma.ledgerPosting.findMany({
      where: { account: { userId: user.id } },
      include: {
        account: { select: { id: true, type: true, currency: true } },
        ledgerTransaction: {
          select: {
            id: true,
            subjectType: true,
            subjectId: true,
            type: true,
            reference: true,
            createdAt: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit
    });

    return {
      items: postings.map((posting) => ({
        id: posting.id,
        ledgerTransactionId: posting.ledgerTransactionId,
        subjectType: posting.ledgerTransaction.subjectType,
        subjectId: posting.ledgerTransaction.subjectId,
        type: posting.ledgerTransaction.type,
        reference: posting.ledgerTransaction.reference,
        accountType: posting.account.type,
        currency: posting.account.currency,
        direction: posting.direction,
        amountMinor: posting.amountMinor,
        signedAmountMinor:
          posting.direction === LedgerPostingDirection.CREDIT ? posting.amountMinor : -posting.amountMinor,
        createdAt: posting.createdAt
      }))
    };
  }

  async releaseBookingEscrow(identity: AuthIdentity, bookingIdInput: string) {
    const user = await this.requireUser(identity);
    const bookingId = this.requiredId(bookingIdInput, "bookingId");
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, clientUserId: true, hustlerUserId: true, status: true, currency: true }
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.clientUserId !== user.id) {
      throw new ForbiddenException("Only the Booking client can confirm completion and release escrow");
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ConflictException(`Booking escrow cannot be released from ${booking.status}`);
    }

    const escrow = await this.prisma.escrowRecord.findUnique({
      where: {
        subjectType_subjectId: {
          subjectType: FinancialSubjectType.BOOKING,
          subjectId: booking.id
        }
      }
    });
    if (!escrow) throw new NotFoundException("Booking escrow not found");

    const idempotencyKey = `escrow:${escrow.id}:released`;
    const existing = await this.prisma.ledgerTransaction.findUnique({ where: { idempotencyKey } });
    if (existing && escrow.status === EscrowStatus.RELEASED) {
      return {
        released: true,
        duplicate: true,
        escrowId: escrow.id,
        ledgerTransactionId: existing.id,
        wallet: await this.walletForUser(escrow.beneficiaryUserId)
      };
    }
    if (escrow.status !== EscrowStatus.HELD) {
      throw new ConflictException(`Booking escrow cannot be released from ${escrow.status}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const raced = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey } });
      if (raced) return { ledgerTransactionId: raced.id, duplicate: true };

      const moved = await tx.escrowRecord.updateMany({
        where: { id: escrow.id, status: EscrowStatus.HELD },
        data: { status: EscrowStatus.RELEASED, releasedAt: new Date() }
      });
      if (moved.count !== 1) throw new ConflictException("Escrow release state changed; retry from current state");

      const escrowAccount = await this.account(
        tx,
        escrow.beneficiaryUserId,
        FinancialAccountType.ESCROW,
        escrow.currency
      );
      const availableAccount = await this.account(
        tx,
        escrow.beneficiaryUserId,
        FinancialAccountType.AVAILABLE,
        escrow.currency
      );

      const ledger = await tx.ledgerTransaction.create({
        data: {
          subjectType: FinancialSubjectType.BOOKING,
          subjectId: booking.id,
          paymentAttemptId: escrow.paymentAttemptId,
          type: LedgerTransactionType.ESCROW_RELEASED,
          reference: `escrow:${escrow.id}`,
          idempotencyKey,
          postings: {
            create: [
              {
                accountId: escrowAccount.id,
                direction: LedgerPostingDirection.DEBIT,
                amountMinor: escrow.amountMinor
              },
              {
                accountId: availableAccount.id,
                direction: LedgerPostingDirection.CREDIT,
                amountMinor: escrow.amountMinor
              }
            ]
          }
        }
      });

      await tx.systemEvent.create({
        data: {
          name: "escrow.released",
          source: "payment",
          payload: {
            escrowId: escrow.id,
            bookingId: booking.id,
            beneficiaryUserId: escrow.beneficiaryUserId,
            amountMinor: escrow.amountMinor,
            currency: escrow.currency,
            actorUserId: user.id,
            actorRelationship: "CLIENT"
          }
        }
      });

      return { ledgerTransactionId: ledger.id, duplicate: false };
    });

    return {
      released: true,
      duplicate: result.duplicate,
      escrowId: escrow.id,
      ledgerTransactionId: result.ledgerTransactionId,
      wallet: await this.walletForUser(escrow.beneficiaryUserId)
    };
  }

  async releaseOrderSettlement(identity: AuthIdentity, orderIdInput: string) {
    const user = await this.requireUser(identity);
    const orderId = this.requiredId(orderIdInput, "orderId");
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        sellerUserId: true,
        buyerUserId: true,
        status: true,
        currency: true,
        totalMinor: true
      }
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.buyerUserId !== user.id) {
      throw new ForbiddenException("Only the Order buyer can release completed settlement");
    }
    if (order.status !== OrderStatus.COMPLETED) {
      throw new ConflictException(`Order settlement cannot be released from ${order.status}`);
    }

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        subjectType: FinancialSubjectType.ORDER,
        subjectId: order.id,
        beneficiaryUserId: order.sellerUserId,
        status: PaymentAttemptStatus.SUCCEEDED,
        domainAppliedAt: { not: null }
      },
      orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }]
    });
    if (!attempt) throw new ConflictException("Order has no authoritative applied payment");

    const idempotencyKey = `order:${order.id}:settlement-released`;
    const existing = await this.prisma.ledgerTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return {
        released: true,
        duplicate: true,
        ledgerTransactionId: existing.id,
        wallet: await this.walletForUser(order.sellerUserId)
      };
    }

    let ledgerId: string;
    try {
      ledgerId = await this.prisma.$transaction(async (tx) => {
        const raced = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey } });
        if (raced) return raced.id;

        const pendingAccount = await this.account(
          tx,
          order.sellerUserId,
          FinancialAccountType.PENDING,
          order.currency
        );
        const availableAccount = await this.account(
          tx,
          order.sellerUserId,
          FinancialAccountType.AVAILABLE,
          order.currency
        );

        const capture = await tx.ledgerTransaction.findFirst({
          where: {
            paymentAttemptId: attempt.id,
            type: LedgerTransactionType.PAYMENT_CONFIRMED
          },
          select: { id: true }
        });
        if (!capture) throw new ConflictException("Order payment ledger capture is missing");

        const ledger = await tx.ledgerTransaction.create({
          data: {
            subjectType: FinancialSubjectType.ORDER,
            subjectId: order.id,
            paymentAttemptId: attempt.id,
            type: LedgerTransactionType.ADJUSTMENT,
            reference: `settlement:${order.id}`,
            idempotencyKey,
            postings: {
              create: [
                {
                  accountId: pendingAccount.id,
                  direction: LedgerPostingDirection.DEBIT,
                  amountMinor: order.totalMinor
                },
                {
                  accountId: availableAccount.id,
                  direction: LedgerPostingDirection.CREDIT,
                  amountMinor: order.totalMinor
                }
              ]
            }
          }
        });

        await tx.systemEvent.create({
          data: {
            name: "settlement.released",
            source: "payment",
            payload: {
              orderId: order.id,
              paymentAttemptId: attempt.id,
              beneficiaryUserId: order.sellerUserId,
              amountMinor: order.totalMinor,
              currency: order.currency,
              actorUserId: user.id,
              actorRelationship: "BUYER"
            }
          }
        });

        return ledger.id;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await this.prisma.ledgerTransaction.findUnique({ where: { idempotencyKey } });
        if (raced) ledgerId = raced.id;
        else throw error;
      } else {
        throw error;
      }
    }

    return {
      released: true,
      duplicate: false,
      ledgerTransactionId: ledgerId!,
      wallet: await this.walletForUser(order.sellerUserId)
    };
  }

  private async walletForUser(userId: string) {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { userId },
      include: { postings: { select: { direction: true, amountMinor: true } } },
      orderBy: [{ currency: "asc" }, { type: "asc" }]
    });

    const byCurrency = new Map<
      string,
      { currency: string; availableMinor: number; pendingMinor: number; escrowMinor: number; payoutReservedMinor: number }
    >();

    for (const account of accounts) {
      const bucket = byCurrency.get(account.currency) ?? {
        currency: account.currency,
        availableMinor: 0,
        pendingMinor: 0,
        escrowMinor: 0,
        payoutReservedMinor: 0
      };
      const balance = account.postings.reduce(
        (sum, posting) =>
          sum + (posting.direction === LedgerPostingDirection.CREDIT ? posting.amountMinor : -posting.amountMinor),
        0
      );
      if (account.type === FinancialAccountType.AVAILABLE) bucket.availableMinor += balance;
      if (account.type === FinancialAccountType.PENDING) bucket.pendingMinor += balance;
      if (account.type === FinancialAccountType.ESCROW) bucket.escrowMinor += balance;
      if (account.type === FinancialAccountType.PAYOUT_RESERVED) bucket.payoutReservedMinor += balance;
      byCurrency.set(account.currency, bucket);
    }

    return {
      userId,
      balances: [...byCurrency.values()],
      balanceAuthority: "LEDGER",
      writableByClient: false
    };
  }

  private account(
    tx: Prisma.TransactionClient,
    userId: string,
    type: FinancialAccountType,
    currency: string
  ) {
    const key = `user:${userId}:${type}:${currency}`;
    return tx.ledgerAccount.upsert({
      where: { key },
      create: { key, userId, type, currency },
      update: {}
    });
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new ConflictException(`${field} is required`);
    }
    return value.trim();
  }

  private parseLimit(value: unknown, fallback: number, max: number) {
    if (value === undefined || value === null || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
      throw new ConflictException(`limit must be an integer between 1 and ${max}`);
    }
    return parsed;
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FinancialSubjectType } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

@Injectable()
export class FinancialReadService {
  constructor(private readonly prisma: PrismaService) {}

  async latestPaymentForSubject(identity: AuthIdentity, subjectTypeInput: string, subjectIdInput: string) {
    const user = await this.requireUser(identity);
    const subjectType = this.subjectType(subjectTypeInput);
    const subjectId = this.requiredId(subjectIdInput, "subjectId");
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        subjectType,
        subjectId,
        OR: [{ payerUserId: user.id }, { beneficiaryUserId: user.id }]
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    if (!attempt) return null;
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
      authoritative: attempt.status === "SUCCEEDED",
      appliedToSubject: Boolean(attempt.domainAppliedAt)
    };
  }

  async listPayouts(identity: AuthIdentity, limitInput?: unknown) {
    const user = await this.requireUser(identity);
    const limit = this.limit(limitInput);
    const items = await this.prisma.payout.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit
    });
    return { items };
  }

  async listRefunds(identity: AuthIdentity, limitInput?: unknown) {
    const user = await this.requireUser(identity);
    const limit = this.limit(limitInput);
    const items = await this.prisma.refund.findMany({
      where: {
        OR: [
          { requestedByUserId: user.id },
          { paymentAttempt: { payerUserId: user.id } },
          { paymentAttempt: { beneficiaryUserId: user.id } }
        ]
      },
      include: {
        paymentAttempt: {
          select: {
            payerUserId: true,
            beneficiaryUserId: true,
            provider: true,
            providerReference: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit
    });
    return { items };
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
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

  private limit(value: unknown) {
    if (value === undefined || value === null || value === "") return 50;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new BadRequestException("limit must be an integer between 1 and 100");
    }
    return parsed;
  }
}

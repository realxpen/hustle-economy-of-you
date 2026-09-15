import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  BookingStatus,
  CounterpartyFeedbackIssue,
  OrderStatus,
  Prisma,
  ReviewPartyRole,
  ReviewSubjectType,
  SafetyReportCategory
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface CreateCounterpartyFeedbackInput {
  subjectType?: unknown;
  subjectId?: unknown;
  wouldWorkAgain?: unknown;
  experienceRating?: unknown;
  issueCategories?: unknown;
  privateNote?: unknown;
}

export interface CreateSafetyReportInput {
  subjectType?: unknown;
  subjectId?: unknown;
  category?: unknown;
  details?: unknown;
}

type CounterpartyAuthority = {
  subjectType: ReviewSubjectType;
  subjectId: string;
  authorUserId: string;
  targetUserId: string;
  authorRole: ReviewPartyRole;
  targetRole: ReviewPartyRole;
  transactionStatusSnapshot: string;
  terminalForFeedback: boolean;
};

type ParticipantAuthority = {
  subjectType: ReviewSubjectType;
  subjectId: string;
  reporterUserId: string;
  targetUserId: string;
  reporterRole: ReviewPartyRole;
  targetRole: ReviewPartyRole;
  transactionStatusSnapshot: string;
};

const privateUserSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true
} satisfies Prisma.UserSelect;

@Injectable()
export class TrustSafetyService {
  constructor(private readonly prisma: PrismaService) {}

  async feedbackEligibility(
    identity: AuthIdentity,
    subjectTypeInput: string,
    subjectIdInput: string
  ) {
    const user = await this.requireUser(identity);
    const subjectType = this.subjectType(subjectTypeInput);
    const subjectId = this.requiredId(subjectIdInput, "subjectId");
    const authority = await this.counterpartyAuthority(user.id, subjectType, subjectId);

    const target = await this.prisma.user.findUnique({
      where: { id: authority.targetUserId },
      select: privateUserSelect
    });
    if (!target) throw new NotFoundException("Counterparty no longer exists");

    if (authority.authorRole !== ReviewPartyRole.HUSTLER && authority.authorRole !== ReviewPartyRole.SELLER) {
      return {
        subjectType,
        subjectId,
        eligible: false,
        reasonCode: "FEEDBACK_ROLE_NOT_ELIGIBLE",
        message: "Private counterparty feedback is submitted by Hustlers and Sellers about Clients and Buyers.",
        transactionBacked: true,
        transactionStatus: authority.transactionStatusSnapshot,
        author: { userId: authority.authorUserId, role: authority.authorRole },
        target: { ...target, role: authority.targetRole },
        existingFeedback: null
      };
    }

    if (authority.authorUserId === authority.targetUserId) {
      return {
        subjectType,
        subjectId,
        eligible: false,
        reasonCode: "SELF_FEEDBACK_BLOCKED",
        message: "A user cannot submit counterparty feedback about themselves.",
        transactionBacked: true,
        transactionStatus: authority.transactionStatusSnapshot,
        author: { userId: authority.authorUserId, role: authority.authorRole },
        target: { ...target, role: authority.targetRole },
        existingFeedback: null
      };
    }

    const existingFeedback = await this.prisma.counterpartyFeedback.findUnique({
      where: {
        subjectType_subjectId_authorUserId: {
          subjectType,
          subjectId,
          authorUserId: authority.authorUserId
        }
      },
      select: { id: true, createdAt: true }
    });

    if (existingFeedback) {
      return {
        subjectType,
        subjectId,
        eligible: false,
        reasonCode: "ALREADY_SUBMITTED",
        message: "Private counterparty feedback has already been submitted for this transaction.",
        transactionBacked: true,
        transactionStatus: authority.transactionStatusSnapshot,
        author: { userId: authority.authorUserId, role: authority.authorRole },
        target: { ...target, role: authority.targetRole },
        existingFeedback
      };
    }

    if (!authority.terminalForFeedback) {
      return {
        subjectType,
        subjectId,
        eligible: false,
        reasonCode: "TRANSACTION_NOT_TERMINAL",
        message: "Private counterparty feedback unlocks after a meaningful terminal transaction outcome.",
        transactionBacked: true,
        transactionStatus: authority.transactionStatusSnapshot,
        author: { userId: authority.authorUserId, role: authority.authorRole },
        target: { ...target, role: authority.targetRole },
        existingFeedback: null
      };
    }

    return {
      subjectType,
      subjectId,
      eligible: true,
      reasonCode: "ELIGIBLE",
      message: "You can privately share counterparty feedback about this transaction.",
      transactionBacked: true,
      transactionStatus: authority.transactionStatusSnapshot,
      author: { userId: authority.authorUserId, role: authority.authorRole },
      target: { ...target, role: authority.targetRole },
      existingFeedback: null
    };
  }

  async createFeedback(identity: AuthIdentity, input: CreateCounterpartyFeedbackInput) {
    const user = await this.requireUser(identity);
    const subjectType = this.subjectType(input.subjectType);
    const subjectId = this.requiredId(input.subjectId, "subjectId");
    const wouldWorkAgain = this.requiredBoolean(input.wouldWorkAgain, "wouldWorkAgain");
    const experienceRating = this.optionalRating(input.experienceRating);
    const issueCategories = this.feedbackIssues(input.issueCategories);
    const privateNote = this.optionalText(input.privateNote, "privateNote", 2000);
    const authority = await this.counterpartyAuthority(user.id, subjectType, subjectId);

    if (authority.authorRole !== ReviewPartyRole.HUSTLER && authority.authorRole !== ReviewPartyRole.SELLER) {
      throw new ForbiddenException("Only the Booking Hustler or Order Seller can submit private counterparty feedback");
    }
    if (authority.authorUserId === authority.targetUserId) {
      throw new BadRequestException("A user cannot submit counterparty feedback about themselves");
    }
    if (!authority.terminalForFeedback) {
      throw new ConflictException("Private counterparty feedback unlocks after a meaningful terminal transaction outcome");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const feedback = await tx.counterpartyFeedback.create({
          data: {
            subjectType,
            subjectId,
            authorUserId: authority.authorUserId,
            targetUserId: authority.targetUserId,
            authorRole: authority.authorRole,
            targetRole: authority.targetRole,
            wouldWorkAgain,
            experienceRating,
            issueCategories,
            privateNote,
            transactionStatusSnapshot: authority.transactionStatusSnapshot
          },
          include: {
            target: { select: privateUserSelect }
          }
        });

        await tx.systemEvent.create({
          data: {
            name: "trust.counterparty_feedback_submitted",
            source: "api",
            payload: {
              feedbackId: feedback.id,
              subjectType,
              subjectId,
              authorUserId: authority.authorUserId,
              targetUserId: authority.targetUserId,
              authorRole: authority.authorRole,
              targetRole: authority.targetRole,
              wouldWorkAgain,
              issueCategories,
              transactionStatus: authority.transactionStatusSnapshot
            }
          }
        });

        return feedback;
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException("Private counterparty feedback has already been submitted for this transaction");
      }
      throw error;
    }
  }

  async listMyFeedback(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    return this.prisma.counterpartyFeedback.findMany({
      where: { authorUserId: user.id },
      orderBy: { createdAt: "desc" },
      include: { target: { select: privateUserSelect } }
    });
  }

  async createReport(identity: AuthIdentity, input: CreateSafetyReportInput) {
    const user = await this.requireUser(identity);
    const subjectType = this.subjectType(input.subjectType);
    const subjectId = this.requiredId(input.subjectId, "subjectId");
    const category = this.reportCategory(input.category);
    const details = this.requiredText(input.details, "details", 10, 2000);
    const authority = await this.participantAuthority(user.id, subjectType, subjectId);

    if (authority.reporterUserId === authority.targetUserId) {
      throw new BadRequestException("A user cannot report themselves");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const report = await tx.safetyReport.create({
          data: {
            subjectType,
            subjectId,
            reporterUserId: authority.reporterUserId,
            targetUserId: authority.targetUserId,
            category,
            details
          },
          select: {
            id: true,
            subjectType: true,
            subjectId: true,
            reporterUserId: true,
            targetUserId: true,
            category: true,
            details: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            target: { select: privateUserSelect }
          }
        });

        await tx.systemEvent.create({
          data: {
            name: "safety.report_submitted",
            source: "api",
            payload: {
              reportId: report.id,
              subjectType,
              subjectId,
              reporterUserId: authority.reporterUserId,
              targetUserId: authority.targetUserId,
              reporterRole: authority.reporterRole,
              targetRole: authority.targetRole,
              category,
              transactionStatus: authority.transactionStatusSnapshot
            }
          }
        });

        return report;
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException("You have already submitted this report category for this transaction");
      }
      throw error;
    }
  }

  async listMyReports(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    return this.prisma.safetyReport.findMany({
      where: { reporterUserId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        subjectType: true,
        subjectId: true,
        reporterUserId: true,
        targetUserId: true,
        category: true,
        details: true,
        status: true,
        reviewedAt: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        target: { select: privateUserSelect }
      }
    });
  }

  async blockUser(identity: AuthIdentity, targetUserIdInput: string) {
    const user = await this.requireUser(identity);
    const targetUserId = this.requiredId(targetUserIdInput, "targetUserId");
    if (user.id === targetUserId) throw new BadRequestException("A user cannot block themselves");

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: privateUserSelect
    });
    if (!target) throw new NotFoundException("User not found");

    const block = await this.prisma.userBlock.upsert({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId: user.id,
          blockedUserId: targetUserId
        }
      },
      create: { blockerUserId: user.id, blockedUserId: targetUserId },
      update: {}
    });

    await this.prisma.systemEvent.create({
      data: {
        name: "safety.user_blocked",
        source: "api",
        payload: { blockerUserId: user.id, blockedUserId: targetUserId }
      }
    });

    return { ...block, blocked: true, target };
  }

  async unblockUser(identity: AuthIdentity, targetUserIdInput: string) {
    const user = await this.requireUser(identity);
    const targetUserId = this.requiredId(targetUserIdInput, "targetUserId");
    if (user.id === targetUserId) throw new BadRequestException("A user cannot unblock themselves");

    await this.prisma.userBlock.deleteMany({
      where: { blockerUserId: user.id, blockedUserId: targetUserId }
    });

    await this.prisma.systemEvent.create({
      data: {
        name: "safety.user_unblocked",
        source: "api",
        payload: { blockerUserId: user.id, blockedUserId: targetUserId }
      }
    });

    return { blocked: false, targetUserId };
  }

  async listBlocks(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    return this.prisma.userBlock.findMany({
      where: { blockerUserId: user.id },
      orderBy: { createdAt: "desc" },
      include: { blocked: { select: privateUserSelect } }
    });
  }

  private async counterpartyAuthority(
    requesterUserId: string,
    subjectType: ReviewSubjectType,
    subjectId: string
  ): Promise<CounterpartyAuthority> {
    const participant = await this.participantAuthority(requesterUserId, subjectType, subjectId);

    if (subjectType === ReviewSubjectType.BOOKING) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: subjectId },
        select: { status: true }
      });
      if (!booking) throw new NotFoundException("Booking not found");
      return {
        ...participant,
        authorUserId: participant.reporterUserId,
        authorRole: participant.reporterRole,
        terminalForFeedback: [
          BookingStatus.COMPLETED,
          BookingStatus.CLOSED,
          BookingStatus.CANCELLED,
          BookingStatus.REFUNDED,
          BookingStatus.DISPUTED
        ].includes(booking.status)
      };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: subjectId },
      select: { status: true }
    });
    if (!order) throw new NotFoundException("Order not found");
    return {
      ...participant,
      authorUserId: participant.reporterUserId,
      authorRole: participant.reporterRole,
      terminalForFeedback: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED].includes(order.status)
    };
  }

  private async participantAuthority(
    requesterUserId: string,
    subjectType: ReviewSubjectType,
    subjectId: string
  ): Promise<ParticipantAuthority> {
    if (subjectType === ReviewSubjectType.BOOKING) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: subjectId },
        select: { clientUserId: true, hustlerUserId: true, status: true }
      });
      if (!booking) throw new NotFoundException("Booking not found");
      if (requesterUserId === booking.clientUserId) {
        return {
          subjectType,
          subjectId,
          reporterUserId: requesterUserId,
          targetUserId: booking.hustlerUserId,
          reporterRole: ReviewPartyRole.CLIENT,
          targetRole: ReviewPartyRole.HUSTLER,
          transactionStatusSnapshot: booking.status
        };
      }
      if (requesterUserId === booking.hustlerUserId) {
        return {
          subjectType,
          subjectId,
          reporterUserId: requesterUserId,
          targetUserId: booking.clientUserId,
          reporterRole: ReviewPartyRole.HUSTLER,
          targetRole: ReviewPartyRole.CLIENT,
          transactionStatusSnapshot: booking.status
        };
      }
      throw new ForbiddenException("Only Booking participants can use trust and safety actions for this transaction");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: subjectId },
      select: { buyerUserId: true, sellerUserId: true, status: true }
    });
    if (!order) throw new NotFoundException("Order not found");
    if (requesterUserId === order.buyerUserId) {
      return {
        subjectType,
        subjectId,
        reporterUserId: requesterUserId,
        targetUserId: order.sellerUserId,
        reporterRole: ReviewPartyRole.BUYER,
        targetRole: ReviewPartyRole.SELLER,
        transactionStatusSnapshot: order.status
      };
    }
    if (requesterUserId === order.sellerUserId) {
      return {
        subjectType,
        subjectId,
        reporterUserId: requesterUserId,
        targetUserId: order.buyerUserId,
        reporterRole: ReviewPartyRole.SELLER,
        targetRole: ReviewPartyRole.BUYER,
        transactionStatusSnapshot: order.status
      };
    }
    throw new ForbiddenException("Only Order participants can use trust and safety actions for this transaction");
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
    const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
    if (normalized === ReviewSubjectType.BOOKING || normalized === ReviewSubjectType.ORDER) {
      return normalized as ReviewSubjectType;
    }
    throw new BadRequestException("subjectType must be BOOKING or ORDER");
  }

  private reportCategory(value: unknown) {
    const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
    if (Object.values(SafetyReportCategory).includes(normalized as SafetyReportCategory)) {
      return normalized as SafetyReportCategory;
    }
    throw new BadRequestException("category is not a supported safety report category");
  }

  private feedbackIssues(value: unknown) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new BadRequestException("issueCategories must be a list");
    const unique = Array.from(new Set(value.map((item) => {
      if (typeof item !== "string") throw new BadRequestException("issueCategories must contain text values only");
      const normalized = item.trim().toUpperCase();
      if (!Object.values(CounterpartyFeedbackIssue).includes(normalized as CounterpartyFeedbackIssue)) {
        throw new BadRequestException(`Unsupported counterparty feedback issue: ${item}`);
      }
      return normalized as CounterpartyFeedbackIssue;
    })));
    if (unique.length > 8) throw new BadRequestException("issueCategories can contain at most 8 values");
    return unique;
  }

  private requiredBoolean(value: unknown, field: string) {
    if (typeof value !== "boolean") throw new BadRequestException(`${field} must be true or false`);
    return value;
  }

  private optionalRating(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      throw new BadRequestException("experienceRating must be an integer between 1 and 5");
    }
    return parsed;
  }

  private requiredText(value: unknown, field: string, minLength: number, maxLength: number) {
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (normalized.length < minLength || normalized.length > maxLength) {
      throw new BadRequestException(`${field} must be between ${minLength} and ${maxLength} characters`);
    }
    return normalized;
  }

  private optionalText(value: unknown, field: string, maxLength: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    return normalized;
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private isUniqueConflict(error: unknown) {
    return Boolean(
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    );
  }
}

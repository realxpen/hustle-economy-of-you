import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  BookingStatus,
  EscrowStatus,
  FinancialSubjectType,
  OrderStatus,
  PaymentAttemptStatus,
  ReviewPartyRole,
  ReviewSubjectType
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

type EligibilityReason =
  | "ELIGIBLE"
  | "ALREADY_REVIEWED"
  | "REVIEWER_ROLE_NOT_ELIGIBLE"
  | "SELF_REVIEW_BLOCKED"
  | "TRANSACTION_REFUNDED"
  | "TRANSACTION_DISPUTED"
  | "BOOKING_NOT_COMPLETED"
  | "BOOKING_PAYMENT_NOT_VERIFIED"
  | "BOOKING_ESCROW_NOT_RELEASED"
  | "ORDER_NOT_COMPLETED"
  | "ORDER_PAYMENT_NOT_VERIFIED";

interface EligibilityContext {
  subjectType: ReviewSubjectType;
  subjectId: string;
  reviewerUserId: string;
  revieweeUserId: string;
  reviewerRole: ReviewPartyRole;
  revieweeRole: ReviewPartyRole;
}

@Injectable()
export class ReviewEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async get(identity: AuthIdentity, subjectTypeInput: string, subjectIdInput: string) {
    const user = await this.requireUser(identity);
    const subjectType = this.subjectType(subjectTypeInput);
    const subjectId = this.requiredId(subjectIdInput, "subjectId");

    if (subjectType === ReviewSubjectType.BOOKING) {
      return this.bookingEligibility(user.id, subjectId);
    }

    return this.orderEligibility(user.id, subjectId);
  }

  private async bookingEligibility(reviewerUserId: string, subjectId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        clientUserId: true,
        hustlerUserId: true,
        status: true,
        completedAt: true,
        disputedAt: true,
        refundedAt: true
      }
    });
    if (!booking) throw new NotFoundException("Booking not found");

    let context: EligibilityContext;
    if (reviewerUserId === booking.clientUserId) {
      context = {
        subjectType: ReviewSubjectType.BOOKING,
        subjectId: booking.id,
        reviewerUserId,
        revieweeUserId: booking.hustlerUserId,
        reviewerRole: ReviewPartyRole.CLIENT,
        revieweeRole: ReviewPartyRole.HUSTLER
      };
    } else if (reviewerUserId === booking.hustlerUserId) {
      context = {
        subjectType: ReviewSubjectType.BOOKING,
        subjectId: booking.id,
        reviewerUserId,
        revieweeUserId: booking.clientUserId,
        reviewerRole: ReviewPartyRole.HUSTLER,
        revieweeRole: ReviewPartyRole.CLIENT
      };
      return this.result(context, false, "REVIEWER_ROLE_NOT_ELIGIBLE", false);
    } else {
      throw new ForbiddenException("Only Booking participants can access review eligibility");
    }

    if (context.reviewerUserId === context.revieweeUserId) {
      return this.result(context, false, "SELF_REVIEW_BLOCKED", false);
    }
    if (booking.status === BookingStatus.REFUNDED || booking.refundedAt) {
      return this.result(context, false, "TRANSACTION_REFUNDED", false);
    }
    if (booking.status === BookingStatus.DISPUTED || booking.disputedAt) {
      return this.result(context, false, "TRANSACTION_DISPUTED", false);
    }
    if (
      (booking.status !== BookingStatus.COMPLETED && booking.status !== BookingStatus.CLOSED) ||
      !booking.completedAt
    ) {
      return this.result(context, false, "BOOKING_NOT_COMPLETED", false);
    }

    const [payment, escrow] = await Promise.all([
      this.prisma.paymentAttempt.findFirst({
        where: {
          subjectType: FinancialSubjectType.BOOKING,
          subjectId: booking.id,
          status: PaymentAttemptStatus.SUCCEEDED,
          domainAppliedAt: { not: null }
        },
        select: { id: true }
      }),
      this.prisma.escrowRecord.findUnique({
        where: {
          subjectType_subjectId: {
            subjectType: FinancialSubjectType.BOOKING,
            subjectId: booking.id
          }
        },
        select: { status: true, releasedAt: true }
      })
    ]);

    if (!payment) {
      return this.result(context, false, "BOOKING_PAYMENT_NOT_VERIFIED", false);
    }
    if (!escrow || escrow.status !== EscrowStatus.RELEASED || !escrow.releasedAt) {
      return this.result(context, false, "BOOKING_ESCROW_NOT_RELEASED", false);
    }

    return this.finalizeEligible(context);
  }

  private async orderEligibility(reviewerUserId: string, subjectId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        buyerUserId: true,
        sellerUserId: true,
        status: true,
        completedAt: true,
        refundedAt: true
      }
    });
    if (!order) throw new NotFoundException("Order not found");

    let context: EligibilityContext;
    if (reviewerUserId === order.buyerUserId) {
      context = {
        subjectType: ReviewSubjectType.ORDER,
        subjectId: order.id,
        reviewerUserId,
        revieweeUserId: order.sellerUserId,
        reviewerRole: ReviewPartyRole.BUYER,
        revieweeRole: ReviewPartyRole.SELLER
      };
    } else if (reviewerUserId === order.sellerUserId) {
      context = {
        subjectType: ReviewSubjectType.ORDER,
        subjectId: order.id,
        reviewerUserId,
        revieweeUserId: order.buyerUserId,
        reviewerRole: ReviewPartyRole.SELLER,
        revieweeRole: ReviewPartyRole.BUYER
      };
      return this.result(context, false, "REVIEWER_ROLE_NOT_ELIGIBLE", false);
    } else {
      throw new ForbiddenException("Only Order participants can access review eligibility");
    }

    if (context.reviewerUserId === context.revieweeUserId) {
      return this.result(context, false, "SELF_REVIEW_BLOCKED", false);
    }
    if (order.status === OrderStatus.REFUNDED || order.refundedAt) {
      return this.result(context, false, "TRANSACTION_REFUNDED", false);
    }
    if (order.status !== OrderStatus.COMPLETED || !order.completedAt) {
      return this.result(context, false, "ORDER_NOT_COMPLETED", false);
    }

    const payment = await this.prisma.paymentAttempt.findFirst({
      where: {
        subjectType: FinancialSubjectType.ORDER,
        subjectId: order.id,
        status: PaymentAttemptStatus.SUCCEEDED,
        domainAppliedAt: { not: null }
      },
      select: { id: true }
    });
    if (!payment) {
      return this.result(context, false, "ORDER_PAYMENT_NOT_VERIFIED", false);
    }

    return this.finalizeEligible(context);
  }

  private async finalizeEligible(context: EligibilityContext) {
    const existingReview = await this.prisma.review.findUnique({
      where: {
        subjectType_subjectId_reviewerUserId: {
          subjectType: context.subjectType,
          subjectId: context.subjectId,
          reviewerUserId: context.reviewerUserId
        }
      },
      select: {
        id: true,
        status: true,
        verifiedTransaction: true,
        createdAt: true
      }
    });

    if (existingReview) {
      return this.result(context, false, "ALREADY_REVIEWED", true, existingReview);
    }

    return this.result(context, true, "ELIGIBLE", true);
  }

  private async result(
    context: EligibilityContext,
    eligible: boolean,
    reasonCode: EligibilityReason,
    verifiedTransaction: boolean,
    existingReview: {
      id: string;
      status: string;
      verifiedTransaction: boolean;
      createdAt: Date;
    } | null = null
  ) {
    const reviewee = await this.prisma.user.findUnique({
      where: { id: context.revieweeUserId },
      select: { id: true, displayName: true, username: true, avatarUrl: true }
    });
    if (!reviewee) throw new NotFoundException("Review participant no longer exists");

    return {
      subjectType: context.subjectType,
      subjectId: context.subjectId,
      eligible,
      reasonCode,
      message: this.reasonMessage(reasonCode),
      verifiedTransaction,
      reviewer: {
        userId: context.reviewerUserId,
        role: context.reviewerRole
      },
      reviewee: {
        userId: reviewee.id,
        role: context.revieweeRole,
        displayName: reviewee.displayName,
        username: reviewee.username,
        avatarUrl: reviewee.avatarUrl
      },
      existingReview
    };
  }

  private reasonMessage(reason: EligibilityReason) {
    const messages: Record<EligibilityReason, string> = {
      ELIGIBLE: "This verified transaction is eligible for a review.",
      ALREADY_REVIEWED: "You have already reviewed this transaction.",
      REVIEWER_ROLE_NOT_ELIGIBLE: "Public reputation reviews are submitted by Clients and Buyers for providers in the Phase 14 MVP.",
      SELF_REVIEW_BLOCKED: "A user cannot review themselves.",
      TRANSACTION_REFUNDED: "Refunded transactions are not eligible for reviews.",
      TRANSACTION_DISPUTED: "Disputed transactions are not eligible for reviews until resolved through a reviewable completion path.",
      BOOKING_NOT_COMPLETED: "The Booking must be completed before reviews unlock.",
      BOOKING_PAYMENT_NOT_VERIFIED: "The Booking has no applied authoritative payment.",
      BOOKING_ESCROW_NOT_RELEASED: "The Booking escrow must be released before reviews unlock.",
      ORDER_NOT_COMPLETED: "The Order must be completed before reviews unlock.",
      ORDER_PAYMENT_NOT_VERIFIED: "The Order has no applied authoritative payment."
    };
    return messages[reason];
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

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }
}

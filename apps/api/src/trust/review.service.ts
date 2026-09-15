import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  BookingStatus,
  EscrowStatus,
  FinancialSubjectType,
  OrderStatus,
  PaymentAttemptStatus,
  Prisma,
  ReviewPartyRole,
  ReviewStatus,
  ReviewSubjectType
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface CreateReviewInput {
  subjectType?: unknown;
  subjectId?: unknown;
  rating?: unknown;
  body?: unknown;
}

export interface ReviewListInput {
  cursor?: unknown;
  limit?: unknown;
}

type ReviewAuthority = {
  subjectType: ReviewSubjectType;
  subjectId: string;
  reviewerUserId: string;
  revieweeUserId: string;
  reviewerRole: ReviewPartyRole;
  revieweeRole: ReviewPartyRole;
  context:
    | {
        kind: "SERVICE";
        serviceId: string;
        title: string;
      }
    | {
        kind: "PRODUCT_ORDER";
        totalMinor: number;
        currency: string;
        items: Array<{
          productId: string;
          title: string;
          variantName: string | null;
          quantity: number;
        }>;
      };
};

const reviewUserSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true
} satisfies Prisma.UserSelect;

const reviewSelect = {
  id: true,
  subjectType: true,
  subjectId: true,
  reviewerUserId: true,
  revieweeUserId: true,
  reviewerRole: true,
  revieweeRole: true,
  rating: true,
  body: true,
  status: true,
  verifiedTransaction: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
  reviewer: { select: reviewUserSelect },
  reviewee: { select: reviewUserSelect }
} satisfies Prisma.ReviewSelect;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async create(identity: AuthIdentity, input: CreateReviewInput) {
    const subjectType = this.subjectType(input.subjectType);
    const subjectId = this.requiredId(input.subjectId, "subjectId");
    const rating = this.rating(input.rating);
    const body = this.reviewBody(input.body);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(
          async (tx) => {
            const reviewer = await this.requireUserInTransaction(tx, identity);
            const authority = subjectType === ReviewSubjectType.BOOKING
              ? await this.requireBookingAuthority(tx, reviewer.id, subjectId)
              : await this.requireOrderAuthority(tx, reviewer.id, subjectId);

            const existing = await tx.review.findUnique({
              where: {
                subjectType_subjectId_reviewerUserId: {
                  subjectType,
                  subjectId,
                  reviewerUserId: reviewer.id
                }
              },
              select: { id: true }
            });
            if (existing) {
              throw new ConflictException("This transaction has already been reviewed");
            }

            const now = new Date();
            const review = await tx.review.create({
              data: {
                subjectType,
                subjectId,
                reviewerUserId: authority.reviewerUserId,
                revieweeUserId: authority.revieweeUserId,
                reviewerRole: authority.reviewerRole,
                revieweeRole: authority.revieweeRole,
                rating,
                body,
                status: ReviewStatus.PUBLISHED,
                verifiedTransaction: true,
                verifiedAt: now
              },
              select: reviewSelect
            });

            const reputation = await tx.userReputation.upsert({
              where: { userId: authority.revieweeUserId },
              create: {
                userId: authority.revieweeUserId,
                ratingSum: rating,
                reviewCount: 1,
                verifiedReviewCount: 1,
                bookingReviewCount: subjectType === ReviewSubjectType.BOOKING ? 1 : 0,
                orderReviewCount: subjectType === ReviewSubjectType.ORDER ? 1 : 0,
                lastReviewAt: now
              },
              update: {
                ratingSum: { increment: rating },
                reviewCount: { increment: 1 },
                verifiedReviewCount: { increment: 1 },
                bookingReviewCount: { increment: subjectType === ReviewSubjectType.BOOKING ? 1 : 0 },
                orderReviewCount: { increment: subjectType === ReviewSubjectType.ORDER ? 1 : 0 },
                lastReviewAt: now
              }
            });

            await tx.systemEvent.create({
              data: {
                name: "review.published",
                source: "api",
                payload: {
                  reviewId: review.id,
                  subjectType,
                  subjectId,
                  reviewerUserId: authority.reviewerUserId,
                  revieweeUserId: authority.revieweeUserId,
                  reviewerRole: authority.reviewerRole,
                  revieweeRole: authority.revieweeRole,
                  rating,
                  verifiedTransaction: true
                }
              }
            });

            return {
              review: this.serializeReview(review, authority.context),
              reputation: this.serializeReputation(reputation)
            };
          },
          {
            maxWait: 10_000,
            timeout: 30_000,
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
          }
        );

        return created;
      } catch (error) {
        if (this.isDuplicateReview(error)) {
          throw new ConflictException("This transaction has already been reviewed");
        }
        if (this.isSerializableRetry(error) && attempt === 0) continue;
        throw error;
      }
    }

    throw new ConflictException("Review state changed while submitting. Refresh and try again");
  }

  async getById(identity: AuthIdentity, reviewIdInput: string) {
    await this.requireUser(identity);
    const reviewId = this.requiredId(reviewIdInput, "reviewId");
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, status: ReviewStatus.PUBLISHED },
      select: reviewSelect
    });
    if (!review) throw new NotFoundException("Review not found");
    return this.serializeReview(review, await this.contextForReview(review));
  }

  async listGiven(identity: AuthIdentity, input: ReviewListInput) {
    const user = await this.requireUser(identity);
    return this.listReviews({ reviewerUserId: user.id }, input, true);
  }

  async listReceived(identity: AuthIdentity, userIdInput: string, input: ReviewListInput) {
    await this.requireUser(identity);
    const userId = this.requiredId(userIdInput, "userId");
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) throw new NotFoundException("User not found");
    return this.listReviews({ revieweeUserId: userId, status: ReviewStatus.PUBLISHED }, input, false);
  }

  async reputation(identity: AuthIdentity, userIdInput: string) {
    await this.requireUser(identity);
    const userId = this.requiredId(userIdInput, "userId");
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, username: true, avatarUrl: true }
    });
    if (!target) throw new NotFoundException("User not found");

    const reputation = await this.prisma.userReputation.findUnique({ where: { userId } });
    return {
      user: target,
      reputation: reputation
        ? this.serializeReputation(reputation)
        : {
            userId,
            ratingSum: 0,
            reviewCount: 0,
            verifiedReviewCount: 0,
            bookingReviewCount: 0,
            orderReviewCount: 0,
            lastReviewAt: null,
            averageRating: null
          }
    };
  }

  private async listReviews(
    where: Prisma.ReviewWhereInput,
    input: ReviewListInput,
    includeNonPublished: boolean
  ) {
    const limit = this.limit(input.limit);
    const cursor = this.optionalId(input.cursor, "cursor");
    const rows = await this.prisma.review.findMany({
      where: includeNonPublished ? where : { ...where, status: ReviewStatus.PUBLISHED },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: reviewSelect
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = await Promise.all(
      page.map(async (review) => this.serializeReview(review, await this.contextForReview(review)))
    );

    return {
      items,
      nextCursor: hasMore && page.length ? page[page.length - 1]!.id : null,
      hasMore
    };
  }

  private async requireBookingAuthority(
    tx: Prisma.TransactionClient,
    reviewerUserId: string,
    subjectId: string
  ): Promise<ReviewAuthority> {
    const booking = await tx.booking.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        serviceId: true,
        serviceTitleSnapshot: true,
        clientUserId: true,
        hustlerUserId: true,
        status: true,
        completedAt: true,
        disputedAt: true,
        refundedAt: true
      }
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (reviewerUserId === booking.hustlerUserId) {
      throw new ForbiddenException("Only the Booking Client can publish a provider reputation review");
    }
    if (reviewerUserId !== booking.clientUserId) {
      throw new ForbiddenException("Only Booking participants can review this transaction");
    }
    if (booking.clientUserId === booking.hustlerUserId) {
      throw new BadRequestException("A user cannot review themselves");
    }
    if (booking.status === BookingStatus.REFUNDED || booking.refundedAt) {
      throw new ConflictException("Refunded transactions are not eligible for reviews");
    }
    if (booking.status === BookingStatus.DISPUTED || booking.disputedAt) {
      throw new ConflictException("Disputed transactions are not eligible for reviews");
    }
    if (
      (booking.status !== BookingStatus.COMPLETED && booking.status !== BookingStatus.CLOSED) ||
      !booking.completedAt
    ) {
      throw new ConflictException("The Booking must be completed before reviews unlock");
    }

    const [payment, escrow] = await Promise.all([
      tx.paymentAttempt.findFirst({
        where: {
          subjectType: FinancialSubjectType.BOOKING,
          subjectId: booking.id,
          status: PaymentAttemptStatus.SUCCEEDED,
          domainAppliedAt: { not: null }
        },
        select: { id: true }
      }),
      tx.escrowRecord.findUnique({
        where: {
          subjectType_subjectId: {
            subjectType: FinancialSubjectType.BOOKING,
            subjectId: booking.id
          }
        },
        select: { status: true, releasedAt: true }
      })
    ]);

    if (!payment) throw new ConflictException("The Booking has no applied authoritative payment");
    if (!escrow || escrow.status !== EscrowStatus.RELEASED || !escrow.releasedAt) {
      throw new ConflictException("The Booking escrow must be released before reviews unlock");
    }

    return {
      subjectType: ReviewSubjectType.BOOKING,
      subjectId: booking.id,
      reviewerUserId: booking.clientUserId,
      revieweeUserId: booking.hustlerUserId,
      reviewerRole: ReviewPartyRole.CLIENT,
      revieweeRole: ReviewPartyRole.HUSTLER,
      context: {
        kind: "SERVICE",
        serviceId: booking.serviceId,
        title: booking.serviceTitleSnapshot
      }
    };
  }

  private async requireOrderAuthority(
    tx: Prisma.TransactionClient,
    reviewerUserId: string,
    subjectId: string
  ): Promise<ReviewAuthority> {
    const order = await tx.order.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        buyerUserId: true,
        sellerUserId: true,
        status: true,
        completedAt: true,
        refundedAt: true,
        totalMinor: true,
        currency: true,
        items: {
          orderBy: { createdAt: "asc" },
          take: 5,
          select: {
            productId: true,
            productTitleSnapshot: true,
            variantNameSnapshot: true,
            quantity: true
          }
        }
      }
    });
    if (!order) throw new NotFoundException("Order not found");
    if (reviewerUserId === order.sellerUserId) {
      throw new ForbiddenException("Only the Order Buyer can publish a provider reputation review");
    }
    if (reviewerUserId !== order.buyerUserId) {
      throw new ForbiddenException("Only Order participants can review this transaction");
    }
    if (order.buyerUserId === order.sellerUserId) {
      throw new BadRequestException("A user cannot review themselves");
    }
    if (order.status === OrderStatus.REFUNDED || order.refundedAt) {
      throw new ConflictException("Refunded transactions are not eligible for reviews");
    }
    if (order.status !== OrderStatus.COMPLETED || !order.completedAt) {
      throw new ConflictException("The Order must be completed before reviews unlock");
    }

    const payment = await tx.paymentAttempt.findFirst({
      where: {
        subjectType: FinancialSubjectType.ORDER,
        subjectId: order.id,
        status: PaymentAttemptStatus.SUCCEEDED,
        domainAppliedAt: { not: null }
      },
      select: { id: true }
    });
    if (!payment) throw new ConflictException("The Order has no applied authoritative payment");

    return {
      subjectType: ReviewSubjectType.ORDER,
      subjectId: order.id,
      reviewerUserId: order.buyerUserId,
      revieweeUserId: order.sellerUserId,
      reviewerRole: ReviewPartyRole.BUYER,
      revieweeRole: ReviewPartyRole.SELLER,
      context: {
        kind: "PRODUCT_ORDER",
        totalMinor: order.totalMinor,
        currency: order.currency,
        items: order.items.map((item) => ({
          productId: item.productId,
          title: item.productTitleSnapshot,
          variantName: item.variantNameSnapshot,
          quantity: item.quantity
        }))
      }
    };
  }

  private async contextForReview(review: Pick<ReviewRow, "subjectType" | "subjectId">) {
    if (review.subjectType === ReviewSubjectType.BOOKING) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: review.subjectId },
        select: { serviceId: true, serviceTitleSnapshot: true }
      });
      return booking
        ? { kind: "SERVICE" as const, serviceId: booking.serviceId, title: booking.serviceTitleSnapshot }
        : null;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: review.subjectId },
      select: {
        totalMinor: true,
        currency: true,
        items: {
          orderBy: { createdAt: "asc" },
          take: 5,
          select: {
            productId: true,
            productTitleSnapshot: true,
            variantNameSnapshot: true,
            quantity: true
          }
        }
      }
    });
    return order
      ? {
          kind: "PRODUCT_ORDER" as const,
          totalMinor: order.totalMinor,
          currency: order.currency,
          items: order.items.map((item) => ({
            productId: item.productId,
            title: item.productTitleSnapshot,
            variantName: item.variantNameSnapshot,
            quantity: item.quantity
          }))
        }
      : null;
  }

  private serializeReview(review: ReviewRow, context: ReviewAuthority["context"] | null) {
    return {
      ...review,
      context
    };
  }

  private serializeReputation(reputation: {
    userId: string;
    ratingSum: number;
    reviewCount: number;
    verifiedReviewCount: number;
    bookingReviewCount: number;
    orderReviewCount: number;
    lastReviewAt: Date | null;
  }) {
    return {
      ...reputation,
      averageRating: reputation.reviewCount > 0
        ? Number((reputation.ratingSum / reputation.reviewCount).toFixed(2))
        : null
    };
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private async requireUserInTransaction(tx: Prisma.TransactionClient, identity: AuthIdentity) {
    const user = await tx.user.findUnique({
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

  private rating(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      throw new BadRequestException("rating must be an integer between 1 and 5");
    }
    return parsed;
  }

  private reviewBody(value: unknown) {
    if (typeof value !== "string") throw new BadRequestException("body must be text");
    const normalized = value.trim();
    if (normalized.length < 10 || normalized.length > 2000) {
      throw new BadRequestException("body must be between 10 and 2000 characters");
    }
    return normalized;
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private optionalId(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredId(value, field);
  }

  private limit(value: unknown) {
    if (value === undefined || value === null || value === "") return 20;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      throw new BadRequestException("limit must be an integer between 1 and 50");
    }
    return parsed;
  }

  private isDuplicateReview(error: unknown) {
    return Boolean(
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    );
  }

  private isSerializableRetry(error: unknown) {
    return Boolean(
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2034"
    );
  }
}

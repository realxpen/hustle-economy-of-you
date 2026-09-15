import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Capability,
  CapabilityStatus,
  Prisma,
  ProfessionalProfileStatus,
  ReviewStatus,
  ReviewSubjectType
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

const publicReviewSelect = {
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
  reviewer: {
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true
    }
  },
  reviewee: {
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true
    }
  }
} satisfies Prisma.ReviewSelect;

type PublicReviewRow = Prisma.ReviewGetPayload<{ select: typeof publicReviewSelect }>;

@Injectable()
export class PublicTrustService {
  constructor(private readonly prisma: PrismaService) {}

  async providerSummary(userIdInput: string, limitInput?: unknown) {
    const userId = this.requiredId(userIdInput, "userId");
    const limit = this.limit(limitInput);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        professionalProfile: {
          is: { status: ProfessionalProfileStatus.PUBLISHED }
        },
        capabilities: {
          some: {
            capability: Capability.HUSTLER,
            status: CapabilityStatus.ACTIVE
          }
        }
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true
      }
    });

    if (!user) throw new NotFoundException("Public provider trust summary not found");

    const [reputation, rows] = await Promise.all([
      this.prisma.userReputation.findUnique({ where: { userId } }),
      this.prisma.review.findMany({
        where: {
          revieweeUserId: userId,
          status: ReviewStatus.PUBLISHED,
          verifiedTransaction: true
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        select: publicReviewSelect
      })
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = await Promise.all(
      page.map(async (review) => this.serializeReview(review, await this.contextForReview(review)))
    );

    const serializedReputation = reputation
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
        };

    return {
      user,
      reputation: serializedReputation,
      trust: {
        marker: serializedReputation.verifiedReviewCount > 0 ? "VERIFIED_REVIEWS" : "NO_VERIFIED_REVIEWS_YET",
        hasVerifiedReviews: serializedReputation.verifiedReviewCount > 0
      },
      reviews: {
        items,
        nextCursor: hasMore && page.length ? page[page.length - 1]!.id : null,
        hasMore
      }
    };
  }

  private async contextForReview(review: Pick<PublicReviewRow, "subjectType" | "subjectId">) {
    if (review.subjectType === ReviewSubjectType.BOOKING) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: review.subjectId },
        select: { serviceId: true, serviceTitleSnapshot: true }
      });
      return booking
        ? {
            kind: "SERVICE" as const,
            serviceId: booking.serviceId,
            title: booking.serviceTitleSnapshot
          }
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

  private serializeReview(review: PublicReviewRow, context: Awaited<ReturnType<PublicTrustService["contextForReview"]>>) {
    return { ...review, context };
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

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private limit(value: unknown) {
    if (value === undefined || value === null || value === "") return 8;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      throw new BadRequestException("limit must be an integer between 1 and 20");
    }
    return parsed;
  }
}

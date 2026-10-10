import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { Prisma, PaymentAttemptStatus, ReviewStatus } from "@prisma/client";

const allowedSources = new Set(["mobile", "web", "admin", "api"]);

export interface CaptureEventInput {
  name?: unknown;
  source?: unknown;
  occurredAt?: unknown;
  payload?: unknown;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async capture(input: CaptureEventInput) {
    if (!process.env.DATABASE_URL) {
      throw new BadRequestException("Analytics persistence requires DATABASE_URL");
    }
    if (typeof input.name !== "string" || input.name.length < 1 || input.name.length > 120) {
      throw new BadRequestException("Invalid analytics event name");
    }
    if (typeof input.source !== "string" || !allowedSources.has(input.source)) {
      throw new BadRequestException("Invalid analytics event source");
    }
    const occurredAt = typeof input.occurredAt === "string" ? new Date(input.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException("Invalid occurredAt");

    const payload = input.payload && typeof input.payload === "object" ? input.payload : undefined;
    return this.prisma.systemEvent.create({
      data: { name: input.name, source: input.source, occurredAt, payload: payload as object | undefined },
      select: { id: true, name: true, source: true, occurredAt: true }
    });
  }
  /**
   * Admin-only, read-only Phase 21 marketplace pulse.
   *
   * Never call client-submitted events "conversions": those are observational
   * counts and can be retried or client-reported. Paid/completed/review counts
   * come from canonical domain records. Stage totals represent different
   * timestamped events, NOT a linked cohort funnel or financial revenue.
   */
  async overview(daysInput?: string) {
    const days = daysInput === undefined ? 30 : Number(daysInput);
    if (![7, 30, 90].includes(days)) {
      throw new BadRequestException("days must be 7, 30, or 90");
    }

    const generatedAt = new Date();
    const start = new Date(Date.UTC(
      generatedAt.getUTCFullYear(), generatedAt.getUTCMonth(),
      generatedAt.getUTCDate() - days + 1
    ));
    const interval = { gte: start, lte: generatedAt };
    const observedEvents = [
      "feed.impression", "feed.view", "feed.profile_clicked",
      "feed.service_clicked", "feed.product_clicked",
      "search.performed", "search.result_clicked",
      "marketplace.viewed", "marketplace.result_clicked"
    ];

    const [
      observations, newAccounts, publishedProfiles, publishedPosts,
      newFollows, newConversations, sentMessages, bookingRequests,
      fundedBookings, completedBookings, placedOrders, paidOrders,
      completedOrders, appliedPayments, verifiedReviews, dailyRows
    ] = await Promise.all([
      this.prisma.systemEvent.groupBy({
        by: ["name"],
        where: {
          name: { in: observedEvents },
          source: { in: ["web", "mobile"] },
          occurredAt: interval
        },
        _count: { _all: true }
      }),
      this.prisma.user.count({ where: { createdAt: interval } }),
      this.prisma.professionalProfile.count({ where: { status: "PUBLISHED", publishedAt: interval } }),
      this.prisma.post.count({ where: { status: "PUBLISHED", publishedAt: interval } }),
      this.prisma.userFollow.count({ where: { createdAt: interval } }),
      this.prisma.conversation.count({ where: { createdAt: interval } }),
      this.prisma.message.count({ where: { createdAt: interval } }),
      this.prisma.booking.count({ where: { createdAt: interval } }),
      this.prisma.booking.count({ where: { fundedAt: interval } }),
      this.prisma.booking.count({ where: { completedAt: interval } }),
      this.prisma.order.count({ where: { createdAt: interval } }),
      this.prisma.order.count({ where: { paidAt: interval } }),
      this.prisma.order.count({ where: { completedAt: interval } }),
      this.prisma.paymentAttempt.count({
        where: {
          status: PaymentAttemptStatus.SUCCEEDED,
          domainAppliedAt: interval
        }
      }),
      this.prisma.review.count({
        where: {
          status: ReviewStatus.PUBLISHED,
          verifiedTransaction: true,
          createdAt: interval
        }
      }),
      this.prisma.$queryRaw<Array<{ day: string; stage: string; events: bigint }>>(Prisma.sql`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, stage, COUNT(*)::bigint AS events
        FROM (
          SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day,
                 'bookingsRequested'::text AS stage
          FROM "Booking" WHERE "createdAt" >= ${start} AND "createdAt" <= ${generatedAt}
          UNION ALL
          SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC'),
                 'ordersPlaced'::text
          FROM "Order" WHERE "createdAt" >= ${start} AND "createdAt" <= ${generatedAt}
          UNION ALL
          SELECT date_trunc('day', "paidAt" AT TIME ZONE 'UTC'),
                 'ordersPaid'::text
          FROM "Order" WHERE "paidAt" >= ${start} AND "paidAt" <= ${generatedAt}
          UNION ALL
          SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC'),
                 'verifiedReviews'::text
          FROM "Review"
          WHERE "createdAt" >= ${start} AND "createdAt" <= ${generatedAt}
            AND "status" = 'PUBLISHED'::"ReviewStatus"
            AND "verifiedTransaction" = true
        ) AS s
        GROUP BY day, stage
        ORDER BY day ASC
      `)
    ]);

    const observed = Object.fromEntries(observedEvents.map(name => [name, 0]));
    for (const row of observations) observed[row.name] = row._count._all;

    const timeline = Array.from({ length: days }, (_, i) => {
      const date = new Date(start.getTime() + i * 86_400_000);
      return {
        day: date.toISOString().slice(0, 10),
        bookingsRequested: 0,
        ordersPlaced: 0,
        ordersPaid: 0,
        verifiedReviews: 0
      };
    });
    const byDay = new Map(timeline.map(item => [item.day, item]));
    for (const row of dailyRows) {
      const item = byDay.get(row.day);
      if (!item) continue;
      const value = Number(row.events);
      if (row.stage === "bookingsRequested") item.bookingsRequested = value;
      if (row.stage === "ordersPlaced") item.ordersPlaced = value;
      if (row.stage === "ordersPaid") item.ordersPaid = value;
      if (row.stage === "verifiedReviews") item.verifiedReviews = value;
    }

    return {
      generatedAt,
      window: { days, from: start, to: generatedAt, timezone: "UTC" },
      observation: {
        trustLevel: "CLIENT_REPORTED",
        note: "Feed and discovery actions are recorded observations, not unique visitors or confirmed conversions. Retries and repeated visits may be counted.",
        events: observed
      },
      authoritative: {
        trustLevel: "CANONICAL_RECORDS",
        note: "Each value counts records reaching its named milestone during this window. Counts are not a linked cohort funnel and do not represent revenue.",
        newAccounts, publishedProfiles, publishedPosts, newFollows,
        newConversations, sentMessages, bookingRequests, fundedBookings,
        completedBookings, placedOrders, paidOrders, completedOrders,
        appliedPayments, verifiedReviews
      },
      timeline,
      cautions: [
        "Stages have independent timestamps; never divide them to claim an end-to-end conversion rate.",
        "Paid means authoritative Order.paidAt or Booking.fundedAt; provider capture is separately counted by applied PaymentAttempt.",
        "Completed milestones may later be refunded or disputed and must not be presented as net revenue.",
        "Discovery observations are not independently verified traffic or uniquely attributed customer journeys."
      ]
    };
  }

}

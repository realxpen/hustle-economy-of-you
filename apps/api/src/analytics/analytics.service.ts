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
    // The legacy generic event endpoint must never impersonate authoritative
    // discovery or consent records used for attribution.
    if (/^(?:feed\.|search\.|marketplace\.|attribution\.|analytics\.)/.test(input.name)) {
      throw new BadRequestException("This event requires its dedicated authenticated endpoint");
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

    // Only opt-in user-specific offer clicks (marked by the authenticated
    // capture service) can be associated with a canonical Booking/Order.
    // Current opt-out removes the account from the report entirely. Re-enabling
    // starts a fresh cohort with no old-click backfill.
    const attributionRows = await this.prisma.$queryRaw<Array<{
      kind: string; eligible: bigint; matched: bigint;
      feed: bigint; search: bigint; marketplace: bigint;
    }>>(Prisma.sql`
      WITH latest_preference AS (
        SELECT DISTINCT ON (e.payload->>'viewerUserId')
          e.payload->>'viewerUserId' AS "userId",
          e.name, e."occurredAt" AS "enabledAt"
        FROM "SystemEvent" AS e
        WHERE e.source = 'attribution-preference'
          AND e.name IN ('attribution.enabled', 'attribution.disabled')
          AND e.payload->>'viewerUserId' IS NOT NULL
        ORDER BY e.payload->>'viewerUserId', e."occurredAt" DESC, e."createdAt" DESC, e.id DESC
      ), consenting AS (
        SELECT "userId", "enabledAt"
        FROM latest_preference
        WHERE name = 'attribution.enabled'
      ), eligible_booking AS (
        SELECT b.id, b."clientUserId" AS actor, b."serviceId" AS target,
               b."createdAt" AS "createdAt", c."enabledAt"
        FROM "Booking" b
        JOIN consenting c ON c."userId" = b."clientUserId"
        WHERE b."createdAt" >= ${start} AND b."createdAt" <= ${generatedAt}
          AND b."createdAt" >= c."enabledAt"
      ), booking_match AS (
        SELECT 'BOOKING'::text AS kind, click.source
        FROM eligible_booking b
        LEFT JOIN LATERAL (
          SELECT CASE WHEN e.name LIKE 'feed.%' THEN 'feed'
                      WHEN e.name LIKE 'search.%' THEN 'search'
                      ELSE 'marketplace' END AS source
          FROM "SystemEvent" e
          WHERE e.source IN ('web','mobile')
            AND e.name IN ('feed.service_clicked', 'search.result_clicked', 'marketplace.result_clicked')
            AND e.payload->>'viewerUserId' = b.actor
            AND e.payload->>'attributionEligible' = 'true'
            AND e."occurredAt" >= GREATEST(b."enabledAt", b."createdAt" - INTERVAL '7 days')
            AND e."occurredAt" <= b."createdAt"
            AND (
              (e.name = 'feed.service_clicked' AND e.payload->>'serviceId' = b.target)
              OR (e.name IN ('search.result_clicked','marketplace.result_clicked')
                  AND e.payload->>'resultType' = 'service'
                  AND e.payload->>'resultId' = b.target)
            )
          ORDER BY e."occurredAt" DESC, e.id DESC
          LIMIT 1
        ) AS click ON TRUE
      ), eligible_order AS (
        SELECT o.id, o."buyerUserId" AS actor,
               o."createdAt" AS "createdAt", c."enabledAt"
        FROM "Order" o
        JOIN consenting c ON c."userId" = o."buyerUserId"
        WHERE o."createdAt" >= ${start} AND o."createdAt" <= ${generatedAt}
          AND o."createdAt" >= c."enabledAt"
      ), order_match AS (
        SELECT 'ORDER'::text AS kind, click.source
        FROM eligible_order o
        LEFT JOIN LATERAL (
          SELECT CASE WHEN e.name LIKE 'feed.%' THEN 'feed'
                      WHEN e.name LIKE 'search.%' THEN 'search'
                      ELSE 'marketplace' END AS source
          FROM "SystemEvent" e
          WHERE e.source IN ('web','mobile')
            AND e.name IN ('feed.product_clicked', 'search.result_clicked', 'marketplace.result_clicked')
            AND e.payload->>'viewerUserId' = o.actor
            AND e.payload->>'attributionEligible' = 'true'
            AND e."occurredAt" >= GREATEST(o."enabledAt", o."createdAt" - INTERVAL '7 days')
            AND e."occurredAt" <= o."createdAt"
            AND EXISTS (
              SELECT 1 FROM "OrderItem" oi
              WHERE oi."orderId" = o.id
                AND (
                  (e.name = 'feed.product_clicked' AND e.payload->>'productId' = oi."productId")
                  OR (e.name IN ('search.result_clicked','marketplace.result_clicked')
                      AND e.payload->>'resultType' = 'product'
                      AND e.payload->>'resultId' = oi."productId")
                )
            )
          ORDER BY e."occurredAt" DESC, e.id DESC
          LIMIT 1
        ) AS click ON TRUE
      )
      SELECT kind, COUNT(*)::bigint AS eligible,
             COUNT(source)::bigint AS matched,
             COUNT(*) FILTER (WHERE source='feed')::bigint AS feed,
             COUNT(*) FILTER (WHERE source='search')::bigint AS search,
             COUNT(*) FILTER (WHERE source='marketplace')::bigint AS marketplace
      FROM (SELECT * FROM booking_match UNION ALL SELECT * FROM order_match) eligible
      GROUP BY kind
    `);
    const association = (kind: string) => {
      const r = attributionRows.find(item => item.kind === kind);
      return {
        consentingOutcomes: Number(r?.eligible ?? 0n),
        linkedOutcomes: Number(r?.matched ?? 0n),
        byLastEligibleClick: {
          feed: Number(r?.feed ?? 0n),
          search: Number(r?.search ?? 0n),
          marketplace: Number(r?.marketplace ?? 0n)
        }
      };
    };

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
      attribution: {
        trustLevel: "CONSENTED_ASSOCIATION",
        lookbackDays: 7,
        note: "Last eligible Service/Product tap on the same offer by the same consenting customer before an actual Booking/Order. This is an observed association, not proof of causation or a conversion rate.",
        bookings: association("BOOKING"),
        orders: association("ORDER")
      },
      cautions: [
        "Stages have independent timestamps; never divide them to claim an end-to-end conversion rate.",
        "Paid means authoritative Order.paidAt or Booking.fundedAt; provider capture is separately counted by applied PaymentAttempt.",
        "Completed milestones may later be refunded or disputed and must not be presented as net revenue.",
        "Discovery observations are not independently verified traffic or uniquely attributed customer journeys."
      ]
    };
  }

}

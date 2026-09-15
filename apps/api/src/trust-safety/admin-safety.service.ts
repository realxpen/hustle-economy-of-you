import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SafetyReportStatus } from "@prisma/client";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";

const userSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true
} satisfies Prisma.UserSelect;

export interface UpdateSafetyReportInput {
  status?: unknown;
  moderationNote?: unknown;
}

type Indicator = {
  code: string;
  level: "INFORMATIONAL" | "REVIEW";
  label: string;
  explanation: string;
  evidence: Record<string, number | string | boolean>;
};

@Injectable()
export class AdminSafetyService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [reports, feedbackCount, blocksCount] = await Promise.all([
      this.prisma.safetyReport.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true,
          subjectType: true,
          subjectId: true,
          category: true,
          status: true,
          createdAt: true,
          target: { select: userSelect },
          reporter: { select: userSelect }
        }
      }),
      this.prisma.counterpartyFeedback.count(),
      this.prisma.userBlock.count()
    ]);

    const statusCounts = this.countBy(reports, (item) => item.status);
    const targetCounts = new Map<string, { target: (typeof reports)[number]["target"]; count: number }>();
    for (const report of reports.filter((item) => item.status === "OPEN" || item.status === "UNDER_REVIEW")) {
      const current = targetCounts.get(report.target.id);
      targetCounts.set(report.target.id, { target: report.target, count: (current?.count ?? 0) + 1 });
    }

    return {
      reports: {
        total: reports.length,
        open: statusCounts.OPEN ?? 0,
        underReview: statusCounts.UNDER_REVIEW ?? 0,
        actioned: statusCounts.ACTIONED ?? 0,
        dismissed: statusCounts.DISMISSED ?? 0
      },
      privateFeedbackCount: feedbackCount,
      activeBlockRelationships: blocksCount,
      usersNeedingReview: [...targetCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      recentReports: reports.slice(0, 20)
    };
  }

  async listReports(statusInput?: string, limitInput?: string) {
    const status = this.optionalStatus(statusInput);
    const limit = this.limit(limitInput, 50, 100);
    return this.prisma.safetyReport.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        target: { select: userSelect },
        reporter: { select: userSelect }
      }
    });
  }

  async userSummary(userIdInput: string) {
    const userId = this.requiredId(userIdInput, "userId");
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...userSelect,
        createdAt: true,
        capabilities: {
          select: { capability: true, status: true },
          orderBy: { enabledAt: "asc" }
        },
        reputation: true
      }
    });
    if (!user) throw new NotFoundException("User not found");

    const [reports, feedback, blocksReceived, bookings, orders] = await Promise.all([
      this.prisma.safetyReport.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { reporter: { select: userSelect } }
      }),
      this.prisma.counterpartyFeedback.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { author: { select: userSelect } }
      }),
      this.prisma.userBlock.count({ where: { blockedUserId: userId } }),
      this.prisma.booking.findMany({
        where: { OR: [{ clientUserId: userId }, { hustlerUserId: userId }] },
        select: {
          id: true,
          clientUserId: true,
          hustlerUserId: true,
          status: true,
          cancelledByUserId: true,
          createdAt: true
        },
        take: 500,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.order.findMany({
        where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
        select: {
          id: true,
          buyerUserId: true,
          sellerUserId: true,
          status: true,
          createdAt: true
        },
        take: 500,
        orderBy: { createdAt: "desc" }
      })
    ]);

    const uniqueReporters = new Set(reports.map((item) => item.reporterUserId)).size;
    const reportStatusCounts = this.countBy(reports, (item) => item.status);
    const reportCategoryCounts = this.countBy(reports, (item) => item.category);
    const reportContextCounts = this.countBy(reports, (item) => item.subjectType);

    const negativeFeedback = feedback.filter((item) => !item.wouldWorkAgain).length;
    const positiveFeedback = feedback.filter((item) => item.wouldWorkAgain).length;
    const ratings = feedback
      .map((item) => item.experienceRating)
      .filter((value): value is number => typeof value === "number");
    const averagePrivateExperience = ratings.length
      ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2))
      : null;
    const feedbackIssueCounts: Record<string, number> = {};
    for (const item of feedback) {
      for (const issue of item.issueCategories) feedbackIssueCounts[issue] = (feedbackIssueCounts[issue] ?? 0) + 1;
    }

    const bookingCancelledByUser = bookings.filter((item) => item.status === "CANCELLED" && item.cancelledByUserId === userId).length;
    const bookingDisputed = bookings.filter((item) => item.status === "DISPUTED").length;
    const bookingRefunded = bookings.filter((item) => item.status === "REFUNDED").length;
    const buyerOrders = orders.filter((item) => item.buyerUserId === userId);
    const sellerOrders = orders.filter((item) => item.sellerUserId === userId);
    const buyerOrderCancelled = buyerOrders.filter((item) => item.status === "CANCELLED").length;
    const buyerOrderRefunded = buyerOrders.filter((item) => item.status === "REFUNDED").length;
    const sellerOrderCancelled = sellerOrders.filter((item) => item.status === "CANCELLED").length;
    const sellerOrderRefunded = sellerOrders.filter((item) => item.status === "REFUNDED").length;

    const indicators: Indicator[] = [];
    if (uniqueReporters >= 2) {
      indicators.push({
        code: "INDEPENDENT_REPORT_PATTERN",
        level: "REVIEW",
        label: "Multiple independent reporters",
        explanation: "Two or more distinct users have filed reports. This is a pattern signal for human review, not proof of wrongdoing.",
        evidence: { uniqueReporters, totalReports: reports.length }
      });
    }
    if (negativeFeedback >= 2) {
      indicators.push({
        code: "NEGATIVE_COUNTERPARTY_PATTERN",
        level: "REVIEW",
        label: "Repeated negative private feedback",
        explanation: "At least two transaction-backed counterparties said they would not work with this user again.",
        evidence: { negativeFeedback, totalFeedback: feedback.length }
      });
    }
    const seriousUnresolved = reports.filter(
      (item) => (item.status === "OPEN" || item.status === "UNDER_REVIEW") &&
        ["THREATS", "FRAUD_SCAM", "FAKE_IDENTITY"].includes(item.category)
    ).length;
    if (seriousUnresolved > 0) {
      indicators.push({
        code: "SERIOUS_UNRESOLVED_REPORT",
        level: "REVIEW",
        label: "Serious allegation awaiting review",
        explanation: "A serious-category report is unresolved. One allegation alone must not trigger automatic punitive action.",
        evidence: { seriousUnresolved }
      });
    }
    if (bookingCancelledByUser >= 2) {
      indicators.push({
        code: "REPEATED_SELF_CANCELLATION",
        level: "INFORMATIONAL",
        label: "Repeated Booking cancellations",
        explanation: "Platform records show this user initiated multiple Booking cancellations. Context is required before drawing conclusions.",
        evidence: { bookingCancelledByUser }
      });
    }
    const adverseTransactionOutcomes = bookingDisputed + bookingRefunded + buyerOrderRefunded + sellerOrderRefunded;
    if (adverseTransactionOutcomes >= 2) {
      indicators.push({
        code: "REPEATED_ADVERSE_TRANSACTION_OUTCOMES",
        level: "INFORMATIONAL",
        label: "Repeated dispute/refund outcomes",
        explanation: "Multiple authoritative transactions ended in dispute or refund. This is operational evidence, not a guilt determination.",
        evidence: { adverseTransactionOutcomes, bookingDisputed, bookingRefunded, buyerOrderRefunded, sellerOrderRefunded }
      });
    }
    if (blocksReceived >= 2) {
      indicators.push({
        code: "MULTIPLE_BLOCKS_RECEIVED",
        level: "INFORMATIONAL",
        label: "Blocked by multiple users",
        explanation: "Multiple users independently blocked this account. Blocking is subjective and requires corroboration before enforcement.",
        evidence: { blocksReceived }
      });
    }

    return {
      user,
      assessment: indicators.some((item) => item.level === "REVIEW") ? "REVIEW_RECOMMENDED" : "NO_ESTABLISHED_PATTERN",
      policy: {
        automaticPunitiveAction: false,
        statement: "Safety indicators organize durable evidence for human review. No single subjective report or feedback item automatically penalizes a user."
      },
      reports: {
        total: reports.length,
        uniqueReporters,
        statusCounts: reportStatusCounts,
        categoryCounts: reportCategoryCounts,
        contextCounts: reportContextCounts,
        recent: reports.slice(0, 20)
      },
      privateFeedback: {
        total: feedback.length,
        wouldWorkAgain: positiveFeedback,
        wouldNotWorkAgain: negativeFeedback,
        averageExperienceRating: averagePrivateExperience,
        issueCounts: feedbackIssueCounts,
        recent: feedback.slice(0, 20)
      },
      platformEvidence: {
        blocksReceived,
        bookings: {
          total: bookings.length,
          cancelledByUser: bookingCancelledByUser,
          disputed: bookingDisputed,
          refunded: bookingRefunded
        },
        orders: {
          asBuyer: buyerOrders.length,
          asSeller: sellerOrders.length,
          buyerCancelled: buyerOrderCancelled,
          buyerRefunded: buyerOrderRefunded,
          sellerCancelled: sellerOrderCancelled,
          sellerRefunded: sellerOrderRefunded
        }
      },
      indicators
    };
  }

  async updateReport(identity: AuthIdentity, reportIdInput: string, input: UpdateSafetyReportInput) {
    const reportId = this.requiredId(reportIdInput, "reportId");
    const status = this.requiredStatus(input.status);
    const moderationNote = this.optionalText(input.moderationNote, "moderationNote", 2000);
    if ((status === SafetyReportStatus.ACTIONED || status === SafetyReportStatus.DISMISSED) && !moderationNote) {
      throw new BadRequestException("moderationNote is required when actioning or dismissing a report");
    }

    const admin = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!admin) throw new NotFoundException("Hustle admin account not synchronized");

    const existing = await this.prisma.safetyReport.findUnique({ where: { id: reportId }, select: { id: true } });
    if (!existing) throw new NotFoundException("Safety report not found");

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.safetyReport.update({
        where: { id: reportId },
        data: {
          status,
          moderationNote,
          reviewedAt: status === SafetyReportStatus.OPEN ? null : now,
          resolvedAt: status === SafetyReportStatus.ACTIONED || status === SafetyReportStatus.DISMISSED ? now : null
        },
        include: {
          target: { select: userSelect },
          reporter: { select: userSelect }
        }
      });

      await tx.systemEvent.create({
        data: {
          name: "safety.admin_report_status_changed",
          source: "admin",
          payload: {
            reportId,
            adminUserId: admin.id,
            status,
            targetUserId: report.targetUserId,
            category: report.category,
            subjectType: report.subjectType,
            subjectId: report.subjectId
          }
        }
      });

      return report;
    });
  }

  private countBy<T>(items: T[], key: (item: T) => string) {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const value = key(item);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  }

  private optionalStatus(value?: string) {
    if (!value) return undefined;
    const normalized = value.trim().toUpperCase();
    if (!Object.values(SafetyReportStatus).includes(normalized as SafetyReportStatus)) {
      throw new BadRequestException("status is not a supported safety report status");
    }
    return normalized as SafetyReportStatus;
  }

  private requiredStatus(value: unknown) {
    if (typeof value !== "string") throw new BadRequestException("status is required");
    const status = this.optionalStatus(value);
    if (!status) throw new BadRequestException("status is required");
    return status;
  }

  private limit(value: string | undefined, fallback: number, max: number) {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
      throw new BadRequestException(`limit must be an integer between 1 and ${max}`);
    }
    return parsed;
  }

  private optionalText(value: unknown, field: string, max: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > max) throw new BadRequestException(`${field} must be at most ${max} characters`);
    return normalized;
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }
}

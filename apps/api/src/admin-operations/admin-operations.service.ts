import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgentApplicationStatus,
  BookingStatus,
  Capability,
  CapabilityStatus,
  HustlerApplicationStatus,
  OrderStatus,
  PaymentAttemptStatus,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

const userListSelect = {
  id: true,
  displayName: true,
  username: true,
  email: true,
  phone: true,
  emailVerified: true,
  phoneVerified: true,
  onboardingCompleted: true,
  avatarUrl: true,
  location: true,
  createdAt: true,
  updatedAt: true,
  capabilities: {
    orderBy: { enabledAt: "asc" as const },
    select: {
      capability: true,
      status: true,
      enabledAt: true,
      updatedAt: true
    }
  },
  hustlerApplication: {
    select: {
      id: true,
      status: true,
      identityVerificationStatus: true,
      submittedAt: true,
      reviewedAt: true
    }
  },
  agentApplication: {
    select: {
      id: true,
      status: true,
      identityVerificationStatus: true,
      submittedAt: true,
      reviewedAt: true
    }
  },
  professionalProfile: {
    select: {
      id: true,
      status: true,
      primarySkill: true,
      category: true,
      publishedAt: true
    }
  },
  reputation: true
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      users,
      activeCapabilities,
      hustlerApplications,
      agentApplications,
      bookings,
      orders,
      payments,
      escrows,
      payouts,
      refunds,
      safetyReports,
      content,
      systemEvents
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.userCapability.groupBy({
        by: ["capability"],
        where: { status: CapabilityStatus.ACTIVE },
        _count: { _all: true }
      }),
      this.prisma.hustlerApplication.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.agentApplication.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.booking.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.paymentAttempt.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.escrowRecord.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.payout.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.refund.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.safetyReport.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      Promise.all([
        this.prisma.post.count(),
        this.prisma.story.count(),
        this.prisma.liveSession.count()
      ]),
      this.prisma.systemEvent.count()
    ]);

    return {
      generatedAt: new Date(),
      users: {
        total: users,
        activeCapabilities: this.groupCounts(activeCapabilities, "capability")
      },
      applications: {
        hustler: this.groupCounts(hustlerApplications, "status"),
        agent: this.groupCounts(agentApplications, "status"),
        needsReview:
          this.countGroup(
            hustlerApplications,
            HustlerApplicationStatus.SUBMITTED
          ) +
          this.countGroup(
            hustlerApplications,
            HustlerApplicationStatus.UNDER_REVIEW
          ) +
          this.countGroup(
            agentApplications,
            AgentApplicationStatus.SUBMITTED
          ) +
          this.countGroup(
            agentApplications,
            AgentApplicationStatus.UNDER_REVIEW
          )
      },
      marketplace: {
        bookings: this.groupCounts(bookings, "status"),
        orders: this.groupCounts(orders, "status")
      },
      finance: {
        paymentAttempts: this.groupCounts(payments, "status"),
        escrow: this.groupCounts(escrows, "status"),
        payouts: this.groupCounts(payouts, "status"),
        refunds: this.groupCounts(refunds, "status")
      },
      safety: {
        reports: this.groupCounts(safetyReports, "status"),
        unresolved:
          this.countGroup(safetyReports, "OPEN") +
          this.countGroup(safetyReports, "UNDER_REVIEW")
      },
      content: {
        posts: content[0],
        stories: content[1],
        liveSessions: content[2]
      },
      audit: {
        systemEvents
      }
    };
  }

  async listUsers(queryInput?: string, limitInput?: string) {
    const query = this.optionalText(queryInput, "query", 160);
    const limit = this.limit(limitInput, 30, 100);

    return this.prisma.user.findMany({
      where: query
        ? {
            OR: [
              { id: query },
              {
                username: {
                  contains: query.replace(/^@/, ""),
                  mode: "insensitive"
                }
              },
              {
                displayName: {
                  contains: query,
                  mode: "insensitive"
                }
              },
              {
                email: {
                  contains: query,
                  mode: "insensitive"
                }
              },
              {
                phone: {
                  contains: query
                }
              }
            ]
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: userListSelect
    });
  }

  async userDetail(userIdInput: string) {
    const userId = this.requiredId(userIdInput, "userId");
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userListSelect
    });
    if (!user) throw new NotFoundException("User not found");

    const [
      clientBookings,
      hustlerBookings,
      buyerOrders,
      sellerOrders,
      posts,
      services,
      products,
      conversations,
      safetyReports,
      blocksCreated,
      blocksReceived,
      agentRepresentations,
      principalRelationships
    ] = await Promise.all([
      this.prisma.booking.count({ where: { clientUserId: userId } }),
      this.prisma.booking.count({ where: { hustlerUserId: userId } }),
      this.prisma.order.count({ where: { buyerUserId: userId } }),
      this.prisma.order.count({ where: { sellerUserId: userId } }),
      this.prisma.post.count({
        where: { professionalProfile: { is: { userId } } }
      }),
      this.prisma.service.count({
        where: { professionalProfile: { is: { userId } } }
      }),
      this.prisma.product.count({
        where: { professionalProfile: { is: { userId } } }
      }),
      this.prisma.conversationParticipant.count({
        where: { userId }
      }),
      this.prisma.safetyReport.count({
        where: { targetUserId: userId }
      }),
      this.prisma.userBlock.count({
        where: { blockerUserId: userId }
      }),
      this.prisma.userBlock.count({
        where: { blockedUserId: userId }
      }),
      this.prisma.agentRelationship.count({
        where: { agentUserId: userId, status: "ACTIVE" }
      }),
      this.prisma.agentRelationship.count({
        where: { principalUserId: userId, status: "ACTIVE" }
      })
    ]);

    return {
      user,
      activity: {
        bookings: {
          asClient: clientBookings,
          asHustler: hustlerBookings
        },
        orders: {
          asBuyer: buyerOrders,
          asSeller: sellerOrders
        },
        content: {
          posts,
          services,
          products
        },
        conversations
      },
      trustSafety: {
        reportsReceived: safetyReports,
        blocksCreated,
        blocksReceived
      },
      agent: {
        activeRepresentationsAsAgent: agentRepresentations,
        activeAgentsRepresentingUser: principalRelationships
      }
    };
  }

  async listBookings(statusInput?: string, limitInput?: string) {
    const status = this.optionalEnum(
      statusInput,
      BookingStatus,
      "booking status"
    );
    const limit = this.limit(limitInput, 50, 100);

    return this.prisma.booking.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        serviceTitleSnapshot: true,
        agreedPriceMinor: true,
        currency: true,
        requestedStartAt: true,
        confirmedStartAt: true,
        fundedAt: true,
        startedAt: true,
        completedAt: true,
        cancelledAt: true,
        disputedAt: true,
        refundedAt: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            displayName: true,
            username: true
          }
        },
        hustler: {
          select: {
            id: true,
            displayName: true,
            username: true
          }
        }
      }
    });
  }

  async listOrders(statusInput?: string, limitInput?: string) {
    const status = this.optionalEnum(
      statusInput,
      OrderStatus,
      "order status"
    );
    const limit = this.limit(limitInput, 50, 100);

    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        currency: true,
        subtotalMinor: true,
        totalMinor: true,
        paidAt: true,
        processingAt: true,
        shippedAt: true,
        deliveredAt: true,
        completedAt: true,
        cancelledAt: true,
        refundedAt: true,
        createdAt: true,
        updatedAt: true,
        buyer: {
          select: {
            id: true,
            displayName: true,
            username: true
          }
        },
        seller: {
          select: {
            id: true,
            displayName: true,
            username: true
          }
        },
        _count: {
          select: { items: true }
        }
      }
    });
  }

  async financialSnapshot(limitInput?: string) {
    const limit = this.limit(limitInput, 30, 100);

    const [payments, escrows, payouts, refunds] =
      await Promise.all([
        this.prisma.paymentAttempt.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            subjectType: true,
            subjectId: true,
            payerUserId: true,
            beneficiaryUserId: true,
            provider: true,
            providerReference: true,
            status: true,
            amountMinor: true,
            currency: true,
            confirmedAt: true,
            domainAppliedAt: true,
            failedAt: true,
            failureCode: true,
            failureReason: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        this.prisma.escrowRecord.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            subjectType: true,
            subjectId: true,
            paymentAttemptId: true,
            beneficiaryUserId: true,
            amountMinor: true,
            currency: true,
            status: true,
            heldAt: true,
            releasedAt: true,
            refundedAt: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        this.prisma.payout.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            userId: true,
            currency: true,
            amountMinor: true,
            status: true,
            provider: true,
            providerReference: true,
            requestedAt: true,
            confirmedAt: true,
            failedAt: true,
            failureReason: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        this.prisma.refund.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            subjectType: true,
            subjectId: true,
            paymentAttemptId: true,
            requestedByUserId: true,
            currency: true,
            amountMinor: true,
            status: true,
            providerReference: true,
            requestedAt: true,
            confirmedAt: true,
            failedAt: true,
            failureReason: true,
            createdAt: true,
            updatedAt: true
          }
        })
      ]);

    return { payments, escrows, payouts, refunds };
  }

  async auditEvents(nameInput?: string, limitInput?: string) {
    const name = this.optionalText(nameInput, "name", 180);
    const limit = this.limit(limitInput, 100, 300);

    return this.prisma.systemEvent.findMany({
      where: name
        ? {
            name: {
              contains: name,
              mode: "insensitive"
            }
          }
        : undefined,
      orderBy: { occurredAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        source: true,
        payload: true,
        occurredAt: true,
        createdAt: true
      }
    });
  }

  async applicationQueues(limitInput?: string) {
    const limit = this.limit(limitInput, 50, 100);

    const [hustler, agent] = await Promise.all([
      this.prisma.hustlerApplication.findMany({
        where: {
          status: {
            in: [
              HustlerApplicationStatus.SUBMITTED,
              HustlerApplicationStatus.UNDER_REVIEW
            ]
          }
        },
        orderBy: [
          { submittedAt: "asc" },
          { createdAt: "asc" }
        ],
        take: limit,
        select: {
          id: true,
          status: true,
          primarySkill: true,
          category: true,
          identityVerificationStatus: true,
          submittedAt: true,
          reviewedAt: true,
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              email: true,
              phone: true
            }
          }
        }
      }),
      this.prisma.agentApplication.findMany({
        where: {
          status: {
            in: [
              AgentApplicationStatus.SUBMITTED,
              AgentApplicationStatus.UNDER_REVIEW
            ]
          }
        },
        orderBy: [
          { submittedAt: "asc" },
          { createdAt: "asc" }
        ],
        take: limit,
        select: {
          id: true,
          status: true,
          operatingArea: true,
          organizationName: true,
          identityVerificationStatus: true,
          submittedAt: true,
          reviewedAt: true,
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              email: true,
              phone: true
            }
          }
        }
      })
    ]);

    return { hustler, agent };
  }

  private groupCounts<
    T extends Record<string, unknown>,
    K extends keyof T
  >(rows: T[], key: K) {
    const result: Record<string, number> = {};
    for (const row of rows) {
      const value = String(row[key]);
      const count =
        "_count" in row &&
        row._count &&
        typeof row._count === "object" &&
        "_all" in row._count
          ? Number(
              (row._count as { _all?: number })._all ?? 0
            )
          : 0;
      result[value] = count;
    }
    return result;
  }

  private countGroup(
    rows: Array<{
      status: string;
      _count: { _all: number };
    }>,
    status: string
  ) {
    return (
      rows.find((row) => row.status === status)?._count._all ??
      0
    );
  }

  private optionalEnum<T extends Record<string, string>>(
    value: string | undefined,
    enumObject: T,
    label: string
  ): T[keyof T] | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toUpperCase();
    if (!Object.values(enumObject).includes(normalized)) {
      throw new BadRequestException(
        `${label} is not supported`
      );
    }
    return normalized as T[keyof T];
  }

  private limit(
    value: string | undefined,
    fallback: number,
    max: number
  ) {
    if (!value) return fallback;
    const parsed = Number(value);
    if (
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > max
    ) {
      throw new BadRequestException(
        `limit must be an integer between 1 and ${max}`
      );
    }
    return parsed;
  }

  private optionalText(
    value: unknown,
    field: string,
    max: number
  ) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return null;
    }
    if (typeof value !== "string") {
      throw new BadRequestException(
        `${field} must be text`
      );
    }
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > max) {
      throw new BadRequestException(
        `${field} must be at most ${max} characters`
      );
    }
    return normalized;
  }

  private requiredId(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > 200
    ) {
      throw new BadRequestException(
        `${field} is required`
      );
    }
    return value.trim();
  }
}

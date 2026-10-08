import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Capability,
  CapabilityStatus,
  EnforcementAppealActionType,
  EnforcementAppealDecision,
  EnforcementAppealStatus,
  MarketplaceModerationActionType,
  MarketplaceModerationState,
  MarketplaceModerationSubjectType,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { AdminOperationsService } from "./admin-operations.service";
import { MarketplaceModerationService } from "./marketplace-moderation.service";

const person = {
  id: true,
  displayName: true,
  username: true
} satisfies Prisma.UserSelect;

const appealInclude = {
  appellant: { select: person },
  originalActor: { select: person },
  reviewer: { select: person }
} satisfies Prisma.EnforcementAppealInclude;

type AppealRecord = Prisma.EnforcementAppealGetPayload<{
  include: typeof appealInclude;
}>;

@Injectable()
export class EnforcementAppealService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminOperations: AdminOperationsService,
    private readonly moderation: MarketplaceModerationService
  ) {}

  async eligible(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    const [posts, services, products, capabilities] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          moderationState: MarketplaceModerationState.HELD,
          professionalProfile: { is: { userId: user.id } }
        },
        select: { id: true, caption: true }
      }),
      this.prisma.service.findMany({
        where: {
          moderationState: MarketplaceModerationState.HELD,
          professionalProfile: { is: { userId: user.id } }
        },
        select: { id: true, title: true }
      }),
      this.prisma.product.findMany({
        where: {
          moderationState: MarketplaceModerationState.HELD,
          professionalProfile: { is: { userId: user.id } }
        },
        select: { id: true, title: true }
      }),
      this.prisma.userCapability.findMany({
        where: {
          userId: user.id,
          capability: { in: [Capability.HUSTLER, Capability.AGENT] },
          status: CapabilityStatus.SUSPENDED
        },
        select: { capability: true, status: true }
      })
    ]);

    const contentCandidates = [
      ...posts.map((item) => ({
        type: MarketplaceModerationSubjectType.POST,
        id: item.id,
        label: item.caption?.slice(0, 120) ?? "(untitled post)"
      })),
      ...services.map((item) => ({
        type: MarketplaceModerationSubjectType.SERVICE,
        id: item.id,
        label: item.title ?? "(untitled service)"
      })),
      ...products.map((item) => ({
        type: MarketplaceModerationSubjectType.PRODUCT,
        id: item.id,
        label: item.title ?? "(untitled product)"
      }))
    ];

    const content = (
      await Promise.all(
        contentCandidates.map(async (candidate) => {
          const latest = await this.prisma.marketplaceModerationAction.findFirst({
            where: {
              subjectType: candidate.type,
              subjectId: candidate.id
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: { actor: { select: person } }
          });
          if (!latest || latest.action !== MarketplaceModerationActionType.HOLD) {
            return null;
          }
          const appealed = await this.prisma.enforcementAppeal.findUnique({
            where: { enforcementRef: latest.id },
            select: { id: true, status: true }
          });
          return {
            actionType: EnforcementAppealActionType.CONTENT_HOLD,
            enforcementRef: latest.id,
            targetKind: candidate.type,
            targetId: candidate.id,
            label: candidate.label,
            enforcementReason: latest.reason,
            enforcedAt: latest.createdAt,
            originalActor: latest.actor,
            existingAppeal: appealed
          };
        })
      )
    ).filter((item): item is NonNullable<typeof item> => Boolean(item));

    const capabilityEvents = await this.prisma.systemEvent.findMany({
      where: {
        name: "admin.capability.suspended",
        payload: {
          path: ["targetUserId"],
          equals: user.id
        }
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 100
    });

    const capability = [];
    for (const record of capabilities) {
      const latest = capabilityEvents.find((event) => {
        const payload = this.objectPayload(event.payload);
        return payload.capability === record.capability;
      });
      if (!latest) continue;
      const payload = this.objectPayload(latest.payload);
      const actorId = typeof payload.adminUserId === "string" ? payload.adminUserId : null;
      if (!actorId) continue;
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: person
      });
      if (!actor) continue;
      const appealed = await this.prisma.enforcementAppeal.findUnique({
        where: { enforcementRef: latest.id },
        select: { id: true, status: true }
      });
      capability.push({
        actionType: EnforcementAppealActionType.CAPABILITY_SUSPENSION,
        enforcementRef: latest.id,
        targetKind: record.capability,
        targetId: user.id,
        label: `${record.capability} capability suspension`,
        enforcementReason: typeof payload.reason === "string" ? payload.reason : "No reason recorded",
        enforcedAt: latest.occurredAt,
        originalActor: actor,
        existingAppeal: appealed
      });
    }

    return { content, capability };
  }

  async submit(
    identity: AuthIdentity,
    input: {
      actionType?: unknown;
      enforcementRef?: unknown;
      reason?: unknown;
    }
  ) {
    const user = await this.requireUser(identity);
    const actionType = this.requiredEnum(
      input.actionType,
      EnforcementAppealActionType,
      "actionType"
    );
    const enforcementRef = this.requiredId(input.enforcementRef, "enforcementRef");
    const reason = this.requiredText(input.reason, "reason", 4000);

    const source = actionType === EnforcementAppealActionType.CONTENT_HOLD
      ? await this.validateContentEnforcement(user.id, enforcementRef)
      : await this.validateCapabilityEnforcement(user.id, enforcementRef);

    try {
      const appeal = await this.prisma.$transaction(async (tx) => {
        const created = await tx.enforcementAppeal.create({
          data: {
            actionType,
            enforcementRef,
            targetKind: source.targetKind,
            targetId: source.targetId,
            appellantUserId: user.id,
            originalActorUserId: source.originalActorUserId,
            reason
          },
          include: appealInclude
        });
        await tx.systemEvent.create({
          data: {
            name: "enforcement_appeal.submitted",
            source: "api",
            payload: {
              appealId: created.id,
              appellantUserId: user.id,
              actionType,
              enforcementRef,
              targetKind: source.targetKind,
              targetId: source.targetId
            }
          }
        });
        return created;
      });
      return this.serialize(appeal);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "An appeal already exists for this enforcement decision"
        );
      }
      throw error;
    }
  }

  async mine(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    const rows = await this.prisma.enforcementAppeal.findMany({
      where: { appellantUserId: user.id },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      include: appealInclude
    });
    return rows.map((row) => this.serialize(row));
  }

  async overview() {
    const rows = await this.prisma.enforcementAppeal.groupBy({
      by: ["status"],
      _count: { _all: true }
    });
    return {
      byStatus: Object.fromEntries(
        rows.map((row) => [row.status, row._count._all])
      )
    };
  }

  async list(statusInput?: string, limitInput?: string) {
    const status = this.optionalEnum(
      statusInput,
      EnforcementAppealStatus,
      "status"
    );
    const limit = this.limit(limitInput, 50, 100);
    const rows = await this.prisma.enforcementAppeal.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: limit,
      include: appealInclude
    });
    return rows.map((row) => this.serialize(row));
  }

  async detail(appealIdInput: string) {
    const appealId = this.requiredId(appealIdInput, "appealId");
    const row = await this.prisma.enforcementAppeal.findUnique({
      where: { id: appealId },
      include: appealInclude
    });
    if (!row) throw new NotFoundException("Appeal not found");
    return {
      ...this.serialize(row),
      enforcement: await this.enforcementSnapshot(row)
    };
  }

  async claim(identity: AuthIdentity, appealIdInput: string) {
    const reviewer = await this.requireUser(identity);
    const appealId = this.requiredId(appealIdInput, "appealId");
    const current = await this.prisma.enforcementAppeal.findUnique({
      where: { id: appealId }
    });
    if (!current) throw new NotFoundException("Appeal not found");
    this.assertIndependentReviewer(reviewer.id, current);

    const now = new Date();
    const changed = await this.prisma.enforcementAppeal.updateMany({
      where: {
        id: appealId,
        status: EnforcementAppealStatus.SUBMITTED,
        assignedReviewerUserId: null
      },
      data: {
        status: EnforcementAppealStatus.UNDER_REVIEW,
        assignedReviewerUserId: reviewer.id,
        reviewStartedAt: now
      }
    });
    if (changed.count !== 1) {
      throw new ConflictException("Appeal is already assigned or no longer submitted");
    }
    await this.prisma.systemEvent.create({
      data: {
        name: "enforcement_appeal.review_started",
        source: "admin",
        payload: {
          appealId,
          reviewerUserId: reviewer.id
        }
      }
    });
    return this.detail(appealId);
  }

  async decide(
    identity: AuthIdentity,
    appealIdInput: string,
    input: { decision?: unknown; reason?: unknown }
  ) {
    const reviewer = await this.requireUser(identity);
    const appealId = this.requiredId(appealIdInput, "appealId");
    const decision = this.requiredEnum(
      input.decision,
      EnforcementAppealDecision,
      "decision"
    );
    const reason = this.requiredText(input.reason, "reason", 4000);

    const appeal = await this.prisma.enforcementAppeal.findUnique({
      where: { id: appealId },
      include: appealInclude
    });
    if (!appeal) throw new NotFoundException("Appeal not found");
    this.assertIndependentReviewer(reviewer.id, appeal);
    if (
      appeal.status !== EnforcementAppealStatus.UNDER_REVIEW ||
      appeal.assignedReviewerUserId !== reviewer.id
    ) {
      throw new ForbiddenException(
        "Only the assigned independent reviewer can decide this appeal"
      );
    }

    if (decision === EnforcementAppealDecision.OVERTURNED) {
      await this.restoreIfCurrent(identity, appeal, reason);
    }

    const now = new Date();
    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.enforcementAppeal.updateMany({
        where: {
          id: appeal.id,
          status: EnforcementAppealStatus.UNDER_REVIEW,
          assignedReviewerUserId: reviewer.id,
          decision: null
        },
        data: {
          status: EnforcementAppealStatus.DECIDED,
          decision,
          decisionReason: reason,
          decidedAt: now
        }
      });
      if (result.count !== 1) {
        throw new ConflictException("Appeal changed before the decision was recorded");
      }
      await tx.systemEvent.create({
        data: {
          name: "enforcement_appeal.decided",
          source: "admin",
          payload: {
            appealId: appeal.id,
            reviewerUserId: reviewer.id,
            appellantUserId: appeal.appellantUserId,
            decision,
            reason,
            restored: decision === EnforcementAppealDecision.OVERTURNED
          }
        }
      });
      return result.count;
    });
    if (changed !== 1) throw new ConflictException("Appeal decision failed");
    return this.detail(appeal.id);
  }

  async close(identity: AuthIdentity, appealIdInput: string) {
    const reviewer = await this.requireUser(identity);
    const appealId = this.requiredId(appealIdInput, "appealId");
    const appeal = await this.prisma.enforcementAppeal.findUnique({
      where: { id: appealId }
    });
    if (!appeal) throw new NotFoundException("Appeal not found");
    this.assertIndependentReviewer(reviewer.id, appeal);
    if (
      appeal.status !== EnforcementAppealStatus.DECIDED ||
      appeal.assignedReviewerUserId !== reviewer.id
    ) {
      throw new ForbiddenException(
        "Only the assigned reviewer can close a decided appeal"
      );
    }
    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.enforcementAppeal.updateMany({
        where: {
          id: appealId,
          status: EnforcementAppealStatus.DECIDED,
          assignedReviewerUserId: reviewer.id
        },
        data: {
          status: EnforcementAppealStatus.CLOSED,
          closedAt: new Date()
        }
      });
      if (result.count !== 1) {
        throw new ConflictException("Appeal changed before it could be closed");
      }
      await tx.systemEvent.create({
        data: {
          name: "enforcement_appeal.closed",
          source: "admin",
          payload: { appealId, reviewerUserId: reviewer.id }
        }
      });
      return result.count;
    });
    if (changed !== 1) throw new ConflictException("Appeal close failed");
    return this.detail(appealId);
  }

  private async restoreIfCurrent(
    identity: AuthIdentity,
    appeal: AppealRecord,
    reason: string
  ) {
    if (appeal.actionType === EnforcementAppealActionType.CONTENT_HOLD) {
      const type = appeal.targetKind as MarketplaceModerationSubjectType;
      if (!Object.values(MarketplaceModerationSubjectType).includes(type)) {
        throw new ConflictException("Appeal content type is invalid");
      }
      const latest = await this.prisma.marketplaceModerationAction.findFirst({
        where: {
          subjectType: type,
          subjectId: appeal.targetId
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      });
      if (!latest || latest.id !== appeal.enforcementRef) {
        throw new ConflictException(
          "A newer moderation action exists. This older appeal cannot remove it"
        );
      }
      const currentState = await this.currentContentState(type, appeal.targetId);
      if (currentState === MarketplaceModerationState.HELD) {
        await this.moderation.release(identity, type, appeal.targetId, {
          reason: `Appeal ${appeal.id} overturned: ${reason}`
        });
      }
      return;
    }

    const capability = appeal.targetKind as Capability;
    if (![Capability.HUSTLER, Capability.AGENT].includes(capability)) {
      throw new ConflictException("Appeal capability is invalid");
    }
    const latest = await this.latestCapabilitySuspension(
      appeal.targetId,
      capability
    );
    if (!latest || latest.id !== appeal.enforcementRef) {
      const current = await this.prisma.userCapability.findUnique({
        where: {
          userId_capability: {
            userId: appeal.targetId,
            capability
          }
        },
        select: { status: true }
      });
      if (current?.status === CapabilityStatus.ACTIVE) return;
      throw new ConflictException(
        "A newer capability suspension exists. This older appeal cannot remove it"
      );
    }
    const current = await this.prisma.userCapability.findUnique({
      where: {
        userId_capability: {
          userId: appeal.targetId,
          capability
        }
      },
      select: { status: true }
    });
    if (current?.status === CapabilityStatus.SUSPENDED) {
      await this.adminOperations.reactivateCapability(
        identity,
        appeal.targetId,
        capability,
        `Appeal ${appeal.id} overturned: ${reason}`
      );
    }
  }

  private async validateContentEnforcement(
    userId: string,
    enforcementRef: string
  ) {
    const action = await this.prisma.marketplaceModerationAction.findUnique({
      where: { id: enforcementRef }
    });
    if (
      !action ||
      action.action !== MarketplaceModerationActionType.HOLD ||
      action.ownerUserId !== userId
    ) {
      throw new NotFoundException("Appealable content enforcement not found");
    }
    const latest = await this.prisma.marketplaceModerationAction.findFirst({
      where: {
        subjectType: action.subjectType,
        subjectId: action.subjectId
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    if (!latest || latest.id !== action.id) {
      throw new ConflictException("This enforcement decision is no longer current");
    }
    if (
      (await this.currentContentState(action.subjectType, action.subjectId)) !==
      MarketplaceModerationState.HELD
    ) {
      throw new ConflictException("This content is no longer under hold");
    }
    return {
      targetKind: action.subjectType,
      targetId: action.subjectId,
      originalActorUserId: action.actorUserId
    };
  }

  private async validateCapabilityEnforcement(
    userId: string,
    enforcementRef: string
  ) {
    const event = await this.prisma.systemEvent.findUnique({
      where: { id: enforcementRef }
    });
    if (!event || event.name !== "admin.capability.suspended") {
      throw new NotFoundException("Appealable capability suspension not found");
    }
    const payload = this.objectPayload(event.payload);
    if (payload.targetUserId !== userId) {
      throw new NotFoundException("Appealable capability suspension not found");
    }
    const capability =
      payload.capability === Capability.HUSTLER
        ? Capability.HUSTLER
        : payload.capability === Capability.AGENT
          ? Capability.AGENT
          : null;
    const actorId = typeof payload.adminUserId === "string"
      ? payload.adminUserId
      : null;
    if (!capability || !actorId) {
      throw new ConflictException("Suspension audit metadata is incomplete");
    }
    const latest = await this.latestCapabilitySuspension(userId, capability);
    if (!latest || latest.id !== event.id) {
      throw new ConflictException("This capability suspension is no longer current");
    }
    const current = await this.prisma.userCapability.findUnique({
      where: {
        userId_capability: { userId, capability }
      },
      select: { status: true }
    });
    if (current?.status !== CapabilityStatus.SUSPENDED) {
      throw new ConflictException("This capability is no longer suspended");
    }
    return {
      targetKind: capability,
      targetId: userId,
      originalActorUserId: actorId
    };
  }

  private async enforcementSnapshot(appeal: AppealRecord) {
    if (appeal.actionType === EnforcementAppealActionType.CONTENT_HOLD) {
      const action = await this.prisma.marketplaceModerationAction.findUnique({
        where: { id: appeal.enforcementRef },
        include: { actor: { select: person } }
      });
      return action
        ? {
            ref: action.id,
            action: action.action,
            reason: action.reason,
            createdAt: action.createdAt,
            subjectType: action.subjectType,
            subjectId: action.subjectId,
            currentState: await this.currentContentState(
              action.subjectType,
              action.subjectId
            ),
            actor: action.actor
          }
        : null;
    }
    const event = await this.prisma.systemEvent.findUnique({
      where: { id: appeal.enforcementRef }
    });
    if (!event) return null;
    const payload = this.objectPayload(event.payload);
    const current = await this.prisma.userCapability.findUnique({
      where: {
        userId_capability: {
          userId: appeal.targetId,
          capability: appeal.targetKind as Capability
        }
      },
      select: { status: true }
    }).catch(() => null);
    return {
      ref: event.id,
      action: "SUSPEND",
      reason: typeof payload.reason === "string" ? payload.reason : null,
      createdAt: event.occurredAt,
      subjectType: "CAPABILITY",
      subjectId: appeal.targetId,
      currentState: current?.status ?? null,
      actor: appeal.originalActor
    };
  }

  private async currentContentState(
    type: MarketplaceModerationSubjectType,
    id: string
  ) {
    if (type === MarketplaceModerationSubjectType.POST) {
      return (
        await this.prisma.post.findUnique({
          where: { id },
          select: { moderationState: true }
        })
      )?.moderationState ?? null;
    }
    if (type === MarketplaceModerationSubjectType.SERVICE) {
      return (
        await this.prisma.service.findUnique({
          where: { id },
          select: { moderationState: true }
        })
      )?.moderationState ?? null;
    }
    return (
      await this.prisma.product.findUnique({
        where: { id },
        select: { moderationState: true }
      })
    )?.moderationState ?? null;
  }

  private async latestCapabilitySuspension(
    userId: string,
    capability: Capability
  ) {
    const events = await this.prisma.systemEvent.findMany({
      where: {
        name: "admin.capability.suspended",
        payload: {
          path: ["targetUserId"],
          equals: userId
        }
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 100
    });
    return (
      events.find(
        (event) => this.objectPayload(event.payload).capability === capability
      ) ?? null
    );
  }

  private assertIndependentReviewer(
    reviewerUserId: string,
    appeal: {
      appellantUserId: string;
      originalActorUserId: string;
    }
  ) {
    if (reviewerUserId === appeal.originalActorUserId) {
      throw new ForbiddenException(
        "The admin who made the original enforcement decision cannot review its appeal"
      );
    }
    if (reviewerUserId === appeal.appellantUserId) {
      throw new ForbiddenException("You cannot review your own appeal");
    }
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account not synchronized");
    return user;
  }

  private serialize(row: AppealRecord) {
    return {
      id: row.id,
      actionType: row.actionType,
      enforcementRef: row.enforcementRef,
      targetKind: row.targetKind,
      targetId: row.targetId,
      reason: row.reason,
      status: row.status,
      decision: row.decision,
      decisionReason: row.decisionReason,
      submittedAt: row.submittedAt,
      reviewStartedAt: row.reviewStartedAt,
      decidedAt: row.decidedAt,
      closedAt: row.closedAt,
      appellant: row.appellant,
      originalActor: row.originalActor,
      reviewer: row.reviewer
    };
  }

  private objectPayload(payload: Prisma.JsonValue | null) {
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Prisma.JsonObject)
      : {};
  }

  private requiredId(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > 200
    ) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private requiredText(value: unknown, field: string, max: number) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > max
    ) {
      throw new BadRequestException(
        `${field} must contain 1–${max} characters`
      );
    }
    return value.trim();
  }

  private requiredEnum<T extends Record<string, string>>(
    value: unknown,
    values: T,
    field: string
  ): T[keyof T] {
    if (
      typeof value !== "string" ||
      !Object.values(values).includes(value)
    ) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return value as T[keyof T];
  }

  private optionalEnum<T extends Record<string, string>>(
    value: unknown,
    values: T,
    field: string
  ): T[keyof T] | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    return this.requiredEnum(value, values, field);
  }

  private limit(value: unknown, fallback: number, max: number) {
    if (value === undefined || value === null || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
      throw new BadRequestException(
        `limit must be an integer between 1 and ${max}`
      );
    }
    return parsed;
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  MarketplaceModerationActionType,
  MarketplaceModerationState,
  MarketplaceModerationSubjectType,
  PostStatus,
  ProductStatus,
  ServiceStatus,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

type ModerationSubject = {
  id: string;
  title: string;
  status: string;
  moderationState: MarketplaceModerationState;
  ownerUserId: string;
  owner: { id: string; displayName: string | null; username: string | null };
};

const owner = {
  id: true,
  displayName: true,
  username: true
} satisfies Prisma.UserSelect;

@Injectable()
export class MarketplaceModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [posts, services, products, recent] = await Promise.all([
      this.prisma.post.count({ where: { moderationState: MarketplaceModerationState.HELD } }),
      this.prisma.service.count({ where: { moderationState: MarketplaceModerationState.HELD } }),
      this.prisma.product.count({ where: { moderationState: MarketplaceModerationState.HELD } }),
      this.prisma.marketplaceModerationAction.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        include: { actor: { select: owner } }
      })
    ]);
    return { holds: { POST: posts, SERVICE: services, PRODUCT: products }, recent };
  }

  async list(
    typeInput: string,
    stateInput?: string,
    limitInput?: string
  ) {
    const type = this.subjectType(typeInput);
    const state = this.optionalState(stateInput);
    const limit = this.limit(limitInput);
    const where = state ? { moderationState: state } : {};
    const orderBy = [{ updatedAt: "desc" as const }, { id: "desc" as const }];

    if (type === MarketplaceModerationSubjectType.POST) {
      const rows = await this.prisma.post.findMany({
        where,
        take: limit,
        orderBy,
        select: {
          id: true, caption: true, status: true, moderationState: true,
          updatedAt: true,
          professionalProfile: { select: { user: { select: owner } } }
        }
      });
      return rows.map((row) => ({
        id: row.id, subjectType: type, title: row.caption?.slice(0, 160) ?? "(untitled post)",
        status: row.status, moderationState: row.moderationState,
        updatedAt: row.updatedAt, owner: row.professionalProfile.user
      }));
    }
    if (type === MarketplaceModerationSubjectType.SERVICE) {
      const rows = await this.prisma.service.findMany({
        where, take: limit, orderBy,
        select: {
          id: true, title: true, status: true, moderationState: true,
          updatedAt: true,
          professionalProfile: { select: { user: { select: owner } } }
        }
      });
      return rows.map((row) => ({
        id: row.id, subjectType: type, title: row.title ?? "(untitled service)",
        status: row.status, moderationState: row.moderationState,
        updatedAt: row.updatedAt, owner: row.professionalProfile.user
      }));
    }
    const rows = await this.prisma.product.findMany({
      where, take: limit, orderBy,
      select: {
        id: true, title: true, status: true, moderationState: true,
        updatedAt: true,
        professionalProfile: { select: { user: { select: owner } } }
      }
    });
    return rows.map((row) => ({
      id: row.id, subjectType: type, title: row.title ?? "(untitled product)",
      status: row.status, moderationState: row.moderationState,
      updatedAt: row.updatedAt, owner: row.professionalProfile.user
    }));
  }

  async detail(typeInput: string, idInput: string) {
    const type = this.subjectType(typeInput);
    const id = this.requiredId(idInput);
    const [record, history] = await Promise.all([
      this.subject(this.prisma, type, id),
      this.prisma.marketplaceModerationAction.findMany({
        where: { subjectType: type, subjectId: id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { actor: { select: owner } }
      })
    ]);
    return { subjectType: type, subject: record, history };
  }

  async hold(
    identity: AuthIdentity,
    typeInput: string,
    idInput: string,
    input: { reason?: unknown }
  ) {
    return this.change(identity, typeInput, idInput, input.reason, "HOLD");
  }

  async release(
    identity: AuthIdentity,
    typeInput: string,
    idInput: string,
    input: { reason?: unknown }
  ) {
    return this.change(identity, typeInput, idInput, input.reason, "RELEASE");
  }

  private async change(
    identity: AuthIdentity,
    typeInput: string,
    idInput: string,
    reasonInput: unknown,
    action: MarketplaceModerationActionType
  ) {
    const type = this.subjectType(typeInput);
    const id = this.requiredId(idInput);
    const reason = this.requiredText(reasonInput, "reason", 2000);
    const actor = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!actor) throw new NotFoundException("Admin Hustle account not synchronized");

    const desired = action === MarketplaceModerationActionType.HOLD
      ? MarketplaceModerationState.HELD
      : MarketplaceModerationState.CLEAR;
    const expected = action === MarketplaceModerationActionType.HOLD
      ? MarketplaceModerationState.CLEAR
      : MarketplaceModerationState.HELD;

    await this.prisma.$transaction(async (tx) => {
      const previous = await this.subject(tx, type, id);
      if (previous.moderationState !== expected) {
        throw new ConflictException(
          action === MarketplaceModerationActionType.HOLD
            ? "This item is already under moderation hold"
            : "This item does not have an active moderation hold"
        );
      }

      const resultingStatus = action === MarketplaceModerationActionType.RELEASE
        ? previous.status
        : type === MarketplaceModerationSubjectType.POST
          ? PostStatus.ARCHIVED
          : type === MarketplaceModerationSubjectType.SERVICE
            ? ServiceStatus.PAUSED
            : ProductStatus.PAUSED;

      const where = {
        id,
        moderationState: expected
      };
      let changed: { count: number };
      if (type === MarketplaceModerationSubjectType.POST) {
        changed = await tx.post.updateMany({
          where: { ...where, status: previous.status as PostStatus },
          data: { moderationState: desired, status: resultingStatus as PostStatus }
        });
      } else if (type === MarketplaceModerationSubjectType.SERVICE) {
        changed = await tx.service.updateMany({
          where: { ...where, status: previous.status as ServiceStatus },
          data: { moderationState: desired, status: resultingStatus as ServiceStatus }
        });
      } else {
        changed = await tx.product.updateMany({
          where: { ...where, status: previous.status as ProductStatus },
          data: { moderationState: desired, status: resultingStatus as ProductStatus }
        });
      }
      if (changed.count !== 1) {
        throw new ConflictException("Content state changed; reload before moderating");
      }

      const record = await tx.marketplaceModerationAction.create({
        data: {
          subjectType: type,
          subjectId: id,
          ownerUserId: previous.ownerUserId,
          actorUserId: actor.id,
          action,
          reason,
          previousStatus: previous.status,
          resultingStatus
        }
      });
      await tx.systemEvent.create({
        data: {
          name: action === MarketplaceModerationActionType.HOLD
            ? "marketplace_content.held"
            : "marketplace_content.released",
          source: "admin",
          payload: {
            actionId: record.id,
            subjectType: type,
            subjectId: id,
            actorUserId: actor.id,
            ownerUserId: previous.ownerUserId,
            previousStatus: previous.status,
            resultingStatus,
            reason,
            republished: false
          }
        }
      });
    });
    return this.detail(type, id);
  }

  private async subject(
    db: PrismaService | Prisma.TransactionClient,
    type: MarketplaceModerationSubjectType,
    id: string
  ): Promise<ModerationSubject> {
    const common = { user: { select: owner } };
    if (type === MarketplaceModerationSubjectType.POST) {
      const row = await db.post.findUnique({
        where: { id },
        select: {
          id: true, caption: true, status: true, moderationState: true,
          professionalProfile: { select: common }
        }
      });
      if (!row) throw new NotFoundException("Post not found");
      return {
        id: row.id, title: row.caption?.slice(0, 160) ?? "(untitled post)",
        status: row.status, moderationState: row.moderationState,
        ownerUserId: row.professionalProfile.user.id,
        owner: row.professionalProfile.user
      };
    }
    if (type === MarketplaceModerationSubjectType.SERVICE) {
      const row = await db.service.findUnique({
        where: { id },
        select: {
          id: true, title: true, status: true, moderationState: true,
          professionalProfile: { select: common }
        }
      });
      if (!row) throw new NotFoundException("Service not found");
      return {
        id: row.id, title: row.title ?? "(untitled service)",
        status: row.status, moderationState: row.moderationState,
        ownerUserId: row.professionalProfile.user.id,
        owner: row.professionalProfile.user
      };
    }
    const row = await db.product.findUnique({
      where: { id },
      select: {
        id: true, title: true, status: true, moderationState: true,
        professionalProfile: { select: common }
      }
    });
    if (!row) throw new NotFoundException("Product not found");
    return {
      id: row.id, title: row.title ?? "(untitled product)",
      status: row.status, moderationState: row.moderationState,
      ownerUserId: row.professionalProfile.user.id,
      owner: row.professionalProfile.user
    };
  }

  private subjectType(value: string) {
    const normalized = value?.toUpperCase();
    if (!Object.values(MarketplaceModerationSubjectType).includes(
      normalized as MarketplaceModerationSubjectType
    )) {
      throw new BadRequestException("subjectType must be POST, SERVICE or PRODUCT");
    }
    return normalized as MarketplaceModerationSubjectType;
  }

  private optionalState(value?: string) {
    if (!value) return undefined;
    const normalized = value.toUpperCase();
    if (!Object.values(MarketplaceModerationState).includes(
      normalized as MarketplaceModerationState
    )) throw new BadRequestException("moderationState must be CLEAR or HELD");
    return normalized as MarketplaceModerationState;
  }

  private requiredId(value: string) {
    if (typeof value !== "string" || !value.trim() || value.length > 200) {
      throw new BadRequestException("Content ID required");
    }
    return value.trim();
  }

  private requiredText(value: unknown, label: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
      throw new BadRequestException(`${label} must contain 1–${max} characters`);
    }
    return value.trim();
  }

  private limit(value?: string) {
    if (value === undefined || value === "") return 40;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      throw new BadRequestException("limit must be between 1 and 100");
    }
    return n;
  }
}

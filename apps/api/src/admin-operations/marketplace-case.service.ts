import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  FinancialSubjectType,
  MarketplaceCasePriority,
  MarketplaceCaseStatus,
  MarketplaceCaseSubjectType,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface CreateMarketplaceCaseInput {
  subjectType?: unknown;
  subjectId?: unknown;
  title?: unknown;
  summary?: unknown;
  priority?: unknown;
}

export interface UpdateMarketplaceCaseInput {
  status?: unknown;
  priority?: unknown;
  reason?: unknown;
}

export interface AddMarketplaceCaseNoteInput {
  body?: unknown;
}

const person = {
  id: true,
  displayName: true,
  username: true
} satisfies Prisma.UserSelect;

const detailInclude = {
  openedBy: { select: person },
  assignedTo: { select: person },
  notes: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: { author: { select: person } }
  }
} satisfies Prisma.MarketplaceCaseInclude;

const listInclude = {
  openedBy: { select: person },
  assignedTo: { select: person },
  _count: { select: { notes: true } }
} satisfies Prisma.MarketplaceCaseInclude;

const transitions: Record<MarketplaceCaseStatus, MarketplaceCaseStatus[]> = {
  OPEN: [MarketplaceCaseStatus.IN_REVIEW],
  IN_REVIEW: [
    MarketplaceCaseStatus.WAITING_INFORMATION,
    MarketplaceCaseStatus.RESOLVED
  ],
  WAITING_INFORMATION: [MarketplaceCaseStatus.IN_REVIEW],
  RESOLVED: [
    MarketplaceCaseStatus.CLOSED,
    MarketplaceCaseStatus.IN_REVIEW
  ],
  CLOSED: [MarketplaceCaseStatus.IN_REVIEW]
};

@Injectable()
export class MarketplaceCaseService {
  constructor(private readonly prisma: PrismaService) {}

  async viewer(identity: AuthIdentity) {
    return { userId: await this.actorId(identity) };
  }

  async overview() {
    const [statuses, priorities] = await Promise.all([
      this.prisma.marketplaceCase.groupBy({
        by: ["status"], _count: { _all: true }
      }),
      this.prisma.marketplaceCase.groupBy({
        by: ["priority"], _count: { _all: true },
        where: { status: { not: MarketplaceCaseStatus.CLOSED } }
      })
    ]);
    return {
      byStatus: Object.fromEntries(
        statuses.map((row) => [row.status, row._count._all])
      ),
      openByPriority: Object.fromEntries(
        priorities.map((row) => [row.priority, row._count._all])
      )
    };
  }

  async list(input: {
    status?: string;
    subjectType?: string;
    limit?: string;
    cursor?: string;
  }) {
    const status = this.optionalEnum(input.status, MarketplaceCaseStatus, "status");
    const subjectType = this.optionalEnum(
      input.subjectType, MarketplaceCaseSubjectType, "subjectType"
    );
    const limit = this.parseLimit(input.limit, 30, 100);
    const cursor = this.decodeCursor(input.cursor);

    const rows = await this.prisma.marketplaceCase.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(subjectType ? { subjectType } : {}),
        ...(cursor ? {
          OR: [
            { updatedAt: { lt: cursor.time } },
            { updatedAt: cursor.time, id: { lt: cursor.id } }
          ]
        } : {})
      },
      take: limit + 1,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: listInclude
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    return {
      items: page,
      hasMore,
      nextCursor: hasMore && last ? this.encodeCursor(last.updatedAt, last.id) : null
    };
  }

  async get(caseIdInput: string) {
    const caseId = this.requiredId(caseIdInput, "caseId");
    const record = await this.prisma.marketplaceCase.findUnique({
      where: { id: caseId },
      include: detailInclude
    });
    if (!record) throw new NotFoundException("Marketplace case not found");
    const subject = await this.subjectSnapshot(record.subjectType, record.subjectId);
    return { ...record, subject };
  }

  async create(identity: AuthIdentity, input: CreateMarketplaceCaseInput) {
    const actorId = await this.actorId(identity);
    const subjectType = this.requiredEnum(
      input.subjectType, MarketplaceCaseSubjectType, "subjectType"
    );
    const subjectId = this.requiredId(input.subjectId, "subjectId");
    const title = this.requiredText(input.title, "title", 160);
    const summary = this.requiredText(input.summary, "summary", 4000);
    const priority = input.priority === undefined
      ? MarketplaceCasePriority.NORMAL
      : this.requiredEnum(input.priority, MarketplaceCasePriority, "priority");

    await this.subjectSnapshot(subjectType, subjectId);

    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const created = await tx.marketplaceCase.create({
          data: {
            subjectType, subjectId, title, summary, priority,
            openedByUserId: actorId
          }
        });
        await tx.systemEvent.create({
          data: {
            name: "marketplace_case.opened",
            source: "admin",
            payload: {
              caseId: created.id,
              subjectType,
              subjectId,
              actorUserId: actorId,
              priority
            }
          }
        });
        return created;
      });
      return this.get(record.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A case already exists for this transaction. Open the existing case instead"
        );
      }
      throw error;
    }
  }

  async claim(identity: AuthIdentity, caseIdInput: string) {
    const actorId = await this.actorId(identity);
    const caseId = this.requiredId(caseIdInput, "caseId");
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.marketplaceCase.updateMany({
        where: {
          id: caseId,
          assignedToUserId: null,
          status: { not: MarketplaceCaseStatus.CLOSED }
        },
        data: { assignedToUserId: actorId }
      });
      if (changed.count !== 1) {
        const found = await tx.marketplaceCase.findUnique({
          where: { id: caseId }, select: { id: true }
        });
        if (!found) throw new NotFoundException("Marketplace case not found");
        throw new ConflictException("Case is already assigned or closed");
      }
      await tx.systemEvent.create({
        data: {
          name: "marketplace_case.claimed",
          source: "admin",
          payload: { caseId, actorUserId: actorId }
        }
      });
      return { caseId, assignedToUserId: actorId };
    }).then(async () => this.get(caseId));
  }

  async release(identity: AuthIdentity, caseIdInput: string) {
    const actorId = await this.actorId(identity);
    const caseId = this.requiredId(caseIdInput, "caseId");
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.marketplaceCase.updateMany({
        where: { id: caseId, assignedToUserId: actorId },
        data: { assignedToUserId: null }
      });
      if (changed.count !== 1) {
        throw new ConflictException("Only the assigned admin can release this case");
      }
      await tx.systemEvent.create({
        data: {
          name: "marketplace_case.released",
          source: "admin",
          payload: { caseId, actorUserId: actorId }
        }
      });
    });
    return this.get(caseId);
  }

  async update(
    identity: AuthIdentity,
    caseIdInput: string,
    input: UpdateMarketplaceCaseInput
  ) {
    const actorId = await this.actorId(identity);
    const caseId = this.requiredId(caseIdInput, "caseId");
    const reason = this.requiredText(input.reason, "reason", 4000);
    const status = this.optionalEnum(input.status, MarketplaceCaseStatus, "status");
    const priority = this.optionalEnum(input.priority, MarketplaceCasePriority, "priority");

    if (!status && !priority) {
      throw new BadRequestException("status or priority is required");
    }

    const existing = await this.prisma.marketplaceCase.findUnique({
      where: { id: caseId }
    });
    if (!existing) throw new NotFoundException("Marketplace case not found");
    if (existing.assignedToUserId !== actorId) {
      throw new ForbiddenException("Claim the case before changing its state");
    }
    if (status && status !== existing.status &&
      !transitions[existing.status].includes(status)) {
      throw new ConflictException(
        `Unsupported case transition: ${existing.status} → ${status}`
      );
    }
    if (
      (status === undefined || status === existing.status) &&
      (priority === undefined || priority === existing.priority)
    ) {
      throw new BadRequestException("No case state change requested");
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.marketplaceCase.updateMany({
        where: {
          id: caseId,
          assignedToUserId: actorId,
          updatedAt: existing.updatedAt
        },
        data: {
          ...(status && status !== existing.status ? {
            status,
            ...(status === MarketplaceCaseStatus.RESOLVED
              ? { resolution: reason, resolvedAt: now, closedAt: null }
              : {}),
            ...(status === MarketplaceCaseStatus.CLOSED
              ? { closedAt: now } : {}),
            ...(status === MarketplaceCaseStatus.IN_REVIEW &&
              (existing.status === MarketplaceCaseStatus.RESOLVED ||
               existing.status === MarketplaceCaseStatus.CLOSED)
              ? { resolution: null, resolvedAt: null, closedAt: null } : {})
          } : {}),
          ...(priority ? { priority } : {})
        }
      });
      if (changed.count !== 1) {
        throw new ConflictException("Case changed. Refresh before updating");
      }
      await tx.marketplaceCaseNote.create({
        data: { caseId, authorUserId: actorId, body: reason }
      });
      await tx.systemEvent.create({
        data: {
          name: "marketplace_case.state_changed",
          source: "admin",
          payload: {
            caseId,
            actorUserId: actorId,
            fromStatus: existing.status,
            toStatus: status ?? existing.status,
            fromPriority: existing.priority,
            toPriority: priority ?? existing.priority,
            reason
          }
        }
      });
    });
    return this.get(caseId);
  }

  async addNote(
    identity: AuthIdentity,
    caseIdInput: string,
    input: AddMarketplaceCaseNoteInput
  ) {
    const actorId = await this.actorId(identity);
    const caseId = this.requiredId(caseIdInput, "caseId");
    const body = this.requiredText(input.body, "body", 4000);

    await this.prisma.$transaction(async (tx) => {
      const record = await tx.marketplaceCase.findUnique({
        where: { id: caseId },
        select: { assignedToUserId: true, status: true }
      });
      if (!record) throw new NotFoundException("Marketplace case not found");
      if (record.assignedToUserId !== actorId) {
        throw new ForbiddenException("Claim the case before recording notes");
      }
      await tx.marketplaceCaseNote.create({
        data: { caseId, authorUserId: actorId, body }
      });
      await tx.marketplaceCase.update({
        where: { id: caseId },
        data: { updatedAt: new Date() }
      });
      await tx.systemEvent.create({
        data: {
          name: "marketplace_case.note_added",
          source: "admin",
          payload: { caseId, actorUserId: actorId }
        }
      });
    });
    return this.get(caseId);
  }

  private async subjectSnapshot(
    subjectType: MarketplaceCaseSubjectType, subjectId: string
  ) {
    if (subjectType === MarketplaceCaseSubjectType.BOOKING) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: subjectId },
        select: {
          id: true, status: true, clientUserId: true,
          hustlerUserId: true, serviceTitleSnapshot: true,
          agreedPriceMinor: true, currency: true, createdAt: true
        }
      });
      if (!booking) throw new NotFoundException("Referenced Booking not found");
      const payment = await this.latestPayment(subjectType, subjectId);
      return { ...booking, payment };
    }
    const order = await this.prisma.order.findUnique({
      where: { id: subjectId },
      select: {
        id: true, status: true, buyerUserId: true, sellerUserId: true,
        totalMinor: true, currency: true, createdAt: true
      }
    });
    if (!order) throw new NotFoundException("Referenced Order not found");
    const payment = await this.latestPayment(subjectType, subjectId);
    return { ...order, payment };
  }

  private async latestPayment(
    subjectType: MarketplaceCaseSubjectType, subjectId: string
  ) {
    const financialType = subjectType === MarketplaceCaseSubjectType.BOOKING
      ? FinancialSubjectType.BOOKING : FinancialSubjectType.ORDER;
    const payment = await this.prisma.paymentAttempt.findFirst({
      where: { subjectType: financialType, subjectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, amountMinor: true, currency: true }
    });
    if (!payment) return null;
    const escrow = await this.prisma.escrowRecord.findUnique({
      where: { subjectType_subjectId: { subjectType: financialType, subjectId } },
      select: { status: true, amountMinor: true, currency: true }
    });
    return { ...payment, escrow };
  }

  private async actorId(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new ForbiddenException("Admin account is not synchronized");
    return user.id;
  }

  private requiredId(value: unknown, name: string): string {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${name} is required`);
    }
    return value.trim();
  }

  private requiredText(value: unknown, name: string, max: number): string {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
      throw new BadRequestException(`${name} must contain 1–${max} characters`);
    }
    return value.trim();
  }

  private requiredEnum<T extends Record<string, string>>(
    value: unknown, source: T, name: string
  ): T[keyof T] {
    if (typeof value !== "string" || !Object.values(source).includes(value)) {
      throw new BadRequestException(`Invalid ${name}`);
    }
    return value as T[keyof T];
  }

  private optionalEnum<T extends Record<string, string>>(
    value: unknown, source: T, name: string
  ): T[keyof T] | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    return this.requiredEnum(value, source, name);
  }

  private parseLimit(value: unknown, fallback: number, max: number) {
    if (value === undefined || value === null || value === "") return fallback;
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > max) {
      throw new BadRequestException(`limit must be between 1 and ${max}`);
    }
    return limit;
  }

  private encodeCursor(time: Date, id: string) {
    return Buffer.from(JSON.stringify({ time: time.toISOString(), id })).toString("base64url");
  }

  private decodeCursor(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException("Invalid case cursor");
    try {
      const data = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
        time?: string; id?: string;
      };
      if (!data.id || typeof data.id !== "string" || !data.time || typeof data.time !== "string") {
        throw new Error("Invalid cursor");
      }
      const time = new Date(data.time);
      if (Number.isNaN(time.getTime())) throw new Error("Invalid cursor");
      return { time, id: data.id };
    } catch {
      throw new BadRequestException("Invalid case cursor");
    }
  }
}

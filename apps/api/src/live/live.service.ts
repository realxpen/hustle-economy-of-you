import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Capability,
  CapabilityStatus,
  LivePinnedOfferType,
  LiveSessionStatus,
  Prisma,
  ProductStatus,
  ProfessionalProfileStatus,
  ServiceStatus
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { BlockPolicyService } from "../trust-safety/block-policy.service";
import { LIVE_MEDIA_PRESENCE_WINDOW_MS, LiveMediaService } from "./live-media.service";

export interface CreateLiveSessionInput {
  title?: unknown;
  category?: unknown;
  playbackUrl?: unknown;
}

export interface UpdateLiveSessionInput {
  title?: unknown;
  category?: unknown;
  playbackUrl?: unknown;
}

export interface LivePinInput {
  offerType?: unknown;
  offerId?: unknown;
}

export interface LiveViewerInput {
  viewerKey?: unknown;
}

export interface LiveCommentInput {
  body?: unknown;
}

export interface LiveEventInput {
  name?: unknown;
  viewerKey?: unknown;
}

const LIVE_VIEWER_WINDOW_MS = 90_000;
const liveEvents = new Set(["PROFILE_CLICKED", "SERVICE_CLICKED", "PRODUCT_CLICKED"]);

type LiveSessionRow = {
  id: string;
  hostUserId: string;
  title: string;
  category: string | null;
  status: LiveSessionStatus;
  pinnedOfferType: LivePinnedOfferType | null;
  pinnedServiceId: string | null;
  pinnedProductId: string | null;
  playbackUrl: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockPolicy: BlockPolicyService,
    private readonly media: LiveMediaService
  ) {}

  async listActive(limitInput?: unknown) {
    const sessions = await this.prisma.liveSession.findMany({
      where: { status: LiveSessionStatus.LIVE },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: this.limit(limitInput)
    });
    return this.resolveSessions(sessions);
  }

  async listMine(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    const sessions = await this.prisma.liveSession.findMany({
      where: { hostUserId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 40
    });
    return this.resolveSessions(sessions);
  }

  async getPublic(liveIdInput: string) {
    const liveId = this.requiredId(liveIdInput, "liveId");
    const session = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (!session || (session.status !== LiveSessionStatus.LIVE && session.status !== LiveSessionStatus.ENDED)) {
      throw new NotFoundException("Live session not found");
    }
    const [resolved] = await this.resolveSessions([session]);
    return resolved;
  }

  async getMine(identity: AuthIdentity, liveIdInput: string) {
    const user = await this.requireUser(identity);
    const session = await this.requireOwnedSession(user.id, liveIdInput);
    const [resolved] = await this.resolveSessions([session]);
    return resolved;
  }

  async create(identity: AuthIdentity, input: CreateLiveSessionInput) {
    const host = await this.requireHost(identity);
    const title = this.requiredText(input.title, "title", 120);
    const category = this.optionalText(input.category, "category", 80);
    const playbackUrl = this.optionalUrl(input.playbackUrl, "playbackUrl");

    const session = await this.prisma.liveSession.create({
      data: {
        hostUserId: host.id,
        title,
        category,
        playbackUrl
      }
    });

    await this.event("live.created", {
      liveId: session.id,
      hostUserId: host.id,
      category,
      hasPlaybackUrl: Boolean(playbackUrl)
    });

    const [resolved] = await this.resolveSessions([session]);
    return resolved;
  }

  async update(identity: AuthIdentity, liveIdInput: string, input: UpdateLiveSessionInput) {
    const host = await this.requireHost(identity);
    const session = await this.requireOwnedSession(host.id, liveIdInput);
    this.assertMutable(session);

    const data: { title?: string; category?: string | null; playbackUrl?: string | null } = {};
    if (input.title !== undefined) data.title = this.requiredText(input.title, "title", 120);
    if (input.category !== undefined) data.category = this.optionalText(input.category, "category", 80);
    if (input.playbackUrl !== undefined) data.playbackUrl = this.optionalUrl(input.playbackUrl, "playbackUrl");

    const updated = await this.prisma.liveSession.update({ where: { id: session.id }, data });
    const [resolved] = await this.resolveSessions([updated]);
    return resolved;
  }

  async start(identity: AuthIdentity, liveIdInput: string) {
    const host = await this.requireHost(identity);
    const session = await this.requireOwnedSession(host.id, liveIdInput);
    if (session.status !== LiveSessionStatus.DRAFT) {
      throw new BadRequestException("Only a draft Live session can be started");
    }

    const existing = await this.prisma.liveSession.findFirst({
      where: {
        hostUserId: host.id,
        status: LiveSessionStatus.LIVE,
        id: { not: session.id }
      },
      select: { id: true }
    });
    if (existing) throw new BadRequestException("End your current Live session before starting another one");

    const startedAt = new Date();
    const updated = await this.prisma.liveSession.update({
      where: { id: session.id },
      data: { status: LiveSessionStatus.LIVE, startedAt, endedAt: null }
    });

    await this.event("live.started", {
      liveId: session.id,
      hostUserId: host.id,
      hasPlaybackUrl: Boolean(updated.playbackUrl),
      pinnedOfferType: updated.pinnedOfferType
    });

    const [resolved] = await this.resolveSessions([updated]);
    return resolved;
  }

  async end(identity: AuthIdentity, liveIdInput: string) {
    const host = await this.requireHost(identity);
    const session = await this.requireOwnedSession(host.id, liveIdInput);
    if (session.status !== LiveSessionStatus.LIVE) {
      throw new BadRequestException("Only an active Live session can be ended");
    }

    const endedAt = new Date();
    const updated = await this.prisma.liveSession.update({
      where: { id: session.id },
      data: { status: LiveSessionStatus.ENDED, endedAt }
    });

    await this.media.clearPresence(session.id);
    await this.event("live.ended", { liveId: session.id, hostUserId: host.id });
    const [resolved] = await this.resolveSessions([updated]);
    return resolved;
  }

  async pin(identity: AuthIdentity, liveIdInput: string, input: LivePinInput) {
    const host = await this.requireHost(identity);
    const session = await this.requireOwnedSession(host.id, liveIdInput);
    this.assertMutable(session);

    const rawType = typeof input.offerType === "string" ? input.offerType.trim().toUpperCase() : "";
    if (rawType === "NONE") {
      const updated = await this.prisma.liveSession.update({
        where: { id: session.id },
        data: { pinnedOfferType: null, pinnedServiceId: null, pinnedProductId: null }
      });
      await this.event("live.offer_unpinned", { liveId: session.id, hostUserId: host.id });
      const [resolved] = await this.resolveSessions([updated]);
      return resolved;
    }

    if (rawType !== LivePinnedOfferType.SERVICE && rawType !== LivePinnedOfferType.PRODUCT) {
      throw new BadRequestException("offerType must be SERVICE, PRODUCT or NONE");
    }
    const offerId = this.requiredId(input.offerId, "offerId");

    if (rawType === LivePinnedOfferType.SERVICE) {
      const service = await this.prisma.service.findFirst({
        where: {
          id: offerId,
          status: ServiceStatus.PUBLISHED,
          professionalProfile: { userId: host.id }
        },
        select: { id: true }
      });
      if (!service) throw new BadRequestException("Pinned Service must be your own published Service");
    } else {
      const product = await this.prisma.product.findFirst({
        where: {
          id: offerId,
          status: ProductStatus.PUBLISHED,
          professionalProfile: { userId: host.id }
        },
        select: { id: true }
      });
      if (!product) throw new BadRequestException("Pinned Product must be your own published Product");
    }

    const updated = await this.prisma.liveSession.update({
      where: { id: session.id },
      data: rawType === LivePinnedOfferType.SERVICE
        ? {
            pinnedOfferType: LivePinnedOfferType.SERVICE,
            pinnedServiceId: offerId,
            pinnedProductId: null
          }
        : {
            pinnedOfferType: LivePinnedOfferType.PRODUCT,
            pinnedServiceId: null,
            pinnedProductId: offerId
          }
    });

    await this.event("live.offer_pinned", {
      liveId: session.id,
      hostUserId: host.id,
      offerType: rawType,
      offerId
    });

    const [resolved] = await this.resolveSessions([updated]);
    return resolved;
  }

  async heartbeat(liveIdInput: string, input: LiveViewerInput) {
    const session = await this.requireLiveSession(liveIdInput);
    const viewerKey = this.requiredViewerKey(input.viewerKey);

    await this.prisma.liveViewerPresence.upsert({
      where: { sessionId_viewerKey: { sessionId: session.id, viewerKey } },
      create: { sessionId: session.id, viewerKey },
      update: { lastSeenAt: new Date() }
    });

    return {
      recorded: true,
      viewers: await this.activeViewerCount(session.id)
    };
  }

  async listComments(liveIdInput: string) {
    const liveId = this.requiredId(liveIdInput, "liveId");
    const session = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (!session || (session.status !== LiveSessionStatus.LIVE && session.status !== LiveSessionStatus.ENDED)) {
      throw new NotFoundException("Live session not found");
    }

    const comments = await this.prisma.liveComment.findMany({
      where: { sessionId: session.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100
    });
    const users = comments.length === 0 ? [] : await this.prisma.user.findMany({
      where: { id: { in: [...new Set(comments.map((comment) => comment.userId))] } },
      select: { id: true, displayName: true, username: true, avatarUrl: true }
    });
    const usersById = new Map(users.map((user) => [user.id, user]));

    return comments.reverse().flatMap((comment) => {
      const user = usersById.get(comment.userId);
      return user ? [{ ...comment, user }] : [];
    });
  }

  async comment(identity: AuthIdentity, liveIdInput: string, input: LiveCommentInput) {
    const user = await this.requireUser(identity);
    const session = await this.requireLiveSession(liveIdInput);
    if (session.hostUserId !== user.id) {
      await this.blockPolicy.assertDirectContact(identity, session.hostUserId);
    }
    const body = this.requiredText(input.body, "body", 500);

    const comment = await this.prisma.liveComment.create({
      data: { sessionId: session.id, userId: user.id, body }
    });
    await this.event("live.commented", {
      liveId: session.id,
      commentId: comment.id,
      userId: user.id,
      hostUserId: session.hostUserId
    });

    return {
      ...comment,
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl
      }
    };
  }

  async recordEvent(liveIdInput: string, input: LiveEventInput) {
    const session = await this.requireLiveSession(liveIdInput);
    const name = typeof input.name === "string" ? input.name.trim().toUpperCase() : "";
    if (!liveEvents.has(name)) throw new BadRequestException("Unsupported Live conversion event");
    const viewerKey = this.optionalViewerKey(input.viewerKey);

    let targetId: string | null = null;
    if (name === "PROFILE_CLICKED") targetId = session.hostUserId;
    if (name === "SERVICE_CLICKED") {
      if (session.pinnedOfferType !== LivePinnedOfferType.SERVICE || !session.pinnedServiceId) {
        throw new BadRequestException("This Live session has no pinned Service");
      }
      targetId = session.pinnedServiceId;
    }
    if (name === "PRODUCT_CLICKED") {
      if (session.pinnedOfferType !== LivePinnedOfferType.PRODUCT || !session.pinnedProductId) {
        throw new BadRequestException("This Live session has no pinned Product");
      }
      targetId = session.pinnedProductId;
    }

    await this.event(`live.${name.toLowerCase()}`, {
      liveId: session.id,
      viewerKey,
      targetId
    }, "web");
    return { recorded: true, name, targetId };
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        location: true
      }
    });
    if (!user) throw new ForbiddenException("Hustle account is required");
    return user;
  }

  private async requireHost(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        location: true,
        capabilities: {
          where: { capability: Capability.HUSTLER, status: CapabilityStatus.ACTIVE },
          select: { id: true }
        },
        professionalProfile: { select: { status: true } }
      }
    });
    if (!user) throw new ForbiddenException("Hustle account is required");
    if (user.capabilities.length === 0 || user.professionalProfile?.status !== ProfessionalProfileStatus.PUBLISHED) {
      throw new ForbiddenException("An active Hustler with a published professional profile is required to host Live");
    }
    return user;
  }

  private async requireOwnedSession(hostUserId: string, liveIdInput: string) {
    const liveId = this.requiredId(liveIdInput, "liveId");
    const session = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (!session) throw new NotFoundException("Live session not found");
    if (session.hostUserId !== hostUserId) throw new ForbiddenException("Only the Live host can manage this session");
    return session;
  }

  private async requireLiveSession(liveIdInput: string) {
    const liveId = this.requiredId(liveIdInput, "liveId");
    const session = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (!session || session.status !== LiveSessionStatus.LIVE) throw new NotFoundException("Live session is not active");
    return session;
  }

  private assertMutable(session: LiveSessionRow) {
    if (session.status !== LiveSessionStatus.DRAFT && session.status !== LiveSessionStatus.LIVE) {
      throw new BadRequestException("Ended Live sessions cannot be changed");
    }
  }

  private async resolveSessions(sessions: LiveSessionRow[]) {
    if (sessions.length === 0) return [];
    const hostIds = [...new Set(sessions.map((session) => session.hostUserId))];
    const serviceIds = [...new Set(sessions.flatMap((session) => session.pinnedServiceId ? [session.pinnedServiceId] : []))];
    const productIds = [...new Set(sessions.flatMap((session) => session.pinnedProductId ? [session.pinnedProductId] : []))];
    const sessionIds = sessions.map((session) => session.id);
    const cutoff = new Date(Date.now() - LIVE_VIEWER_WINDOW_MS);
    const mediaCutoff = new Date(Date.now() - LIVE_MEDIA_PRESENCE_WINDOW_MS);

    const [hosts, services, products, viewers, comments, mediaPresence] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: hostIds } },
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          location: true,
          emailVerified: true,
          phoneVerified: true,
          professionalProfile: {
            select: { status: true, headline: true, primarySkill: true, category: true }
          }
        }
      }),
      serviceIds.length === 0 ? Promise.resolve([]) : this.prisma.service.findMany({
        where: { id: { in: serviceIds }, status: ServiceStatus.PUBLISHED },
        select: { id: true, title: true, category: true, priceMinor: true, currency: true, pricingType: true }
      }),
      productIds.length === 0 ? Promise.resolve([]) : this.prisma.product.findMany({
        where: { id: { in: productIds }, status: ProductStatus.PUBLISHED },
        select: { id: true, title: true, category: true, priceMinor: true, currency: true, type: true, trackInventory: true, inventoryQuantity: true }
      }),
      this.prisma.liveViewerPresence.groupBy({
        by: ["sessionId"],
        where: { sessionId: { in: sessionIds }, lastSeenAt: { gte: cutoff } },
        _count: { _all: true }
      }),
      this.prisma.liveComment.groupBy({
        by: ["sessionId"],
        where: { sessionId: { in: sessionIds } },
        _count: { _all: true }
      }),
      this.prisma.liveMediaPresence.findMany({
        where: {
          sessionId: { in: sessionIds },
          lastSeenAt: { gte: mediaCutoff }
        },
        select: { sessionId: true }
      })
    ]);

    const hostsById = new Map(hosts.map((host) => [host.id, host]));
    const servicesById = new Map(services.map((service) => [service.id, service]));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const viewersById = new Map(viewers.map((item) => [item.sessionId, item._count._all]));
    const commentsById = new Map(comments.map((item) => [item.sessionId, item._count._all]));
    const nativeBroadcastingById = new Set(mediaPresence.map((item) => item.sessionId));

    return sessions.flatMap((session) => {
      const host = hostsById.get(session.hostUserId);
      if (!host) return [];
      const profile = host.professionalProfile?.status === ProfessionalProfileStatus.PUBLISHED
        ? {
            headline: host.professionalProfile.headline,
            primarySkill: host.professionalProfile.primarySkill,
            category: host.professionalProfile.category
          }
        : null;
      return [{
        ...session,
        host: {
          id: host.id,
          displayName: host.displayName,
          username: host.username,
          avatarUrl: host.avatarUrl,
          location: host.location,
          verified: host.emailVerified || host.phoneVerified,
          professionalProfile: profile
        },
        pinnedService: session.pinnedServiceId ? servicesById.get(session.pinnedServiceId) ?? null : null,
        pinnedProduct: session.pinnedProductId ? productsById.get(session.pinnedProductId) ?? null : null,
        interactions: {
          viewers: viewersById.get(session.id) ?? 0,
          comments: commentsById.get(session.id) ?? 0
        },
        media: this.media.descriptor(
          session.playbackUrl,
          nativeBroadcastingById.has(session.id)
        )
      }];
    });
  }

  private async activeViewerCount(sessionId: string) {
    return this.prisma.liveViewerPresence.count({
      where: {
        sessionId,
        lastSeenAt: { gte: new Date(Date.now() - LIVE_VIEWER_WINDOW_MS) }
      }
    });
  }

  private async event(name: string, payload: Prisma.InputJsonObject, source = "api") {
    await this.prisma.systemEvent.create({ data: { name, source, payload } });
  }

  private requiredText(value: unknown, field: string, maxLength: number) {
    if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required`);
    const text = value.trim();
    if (text.length > maxLength) throw new BadRequestException(`${field} must be ${maxLength} characters or fewer`);
    return text;
  }

  private optionalText(value: unknown, field: string, maxLength: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const text = value.trim();
    if (!text) return null;
    if (text.length > maxLength) throw new BadRequestException(`${field} must be ${maxLength} characters or fewer`);
    return text;
  }

  private optionalUrl(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be a URL`);
    const raw = value.trim();
    if (raw.length > 1600) throw new BadRequestException(`${field} is too long`);
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
      return url.toString();
    } catch {
      throw new BadRequestException(`${field} must be a valid HTTP or HTTPS URL`);
    }
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private requiredViewerKey(value: unknown) {
    if (typeof value !== "string" || !value.trim()) throw new BadRequestException("viewerKey is required");
    const key = value.trim();
    if (key.length > 160) throw new BadRequestException("viewerKey is too long");
    return key;
  }

  private optionalViewerKey(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredViewerKey(value);
  }

  private limit(value: unknown) {
    const parsed = typeof value === "string" ? Number.parseInt(value, 10) : 20;
    if (!Number.isFinite(parsed)) return 20;
    return Math.min(50, Math.max(1, parsed));
  }
}

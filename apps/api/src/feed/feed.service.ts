import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Capability,
  CapabilityStatus,
  PostStatus,
  ProductStatus,
  ProfessionalProfileStatus,
  ServiceStatus,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export type FeedTab = "for-you" | "nearby" | "connections";
export type FeedDiscoveryEventName =
  | "feed.impression"
  | "feed.view"
  | "feed.watch"
  | "feed.profile_clicked"
  | "feed.service_clicked"
  | "feed.product_clicked";

export interface CaptureFeedEventInput {
  name?: unknown;
  postId?: unknown;
  feedTab?: unknown;
  source?: unknown;
  position?: unknown;
  sessionId?: unknown;
  watchMs?: unknown;
  serviceId?: unknown;
  productId?: unknown;
}

interface FeedCursor {
  score: number;
  publishedAt: string;
  id: string;
}

interface RankingContext {
  viewerLocation: string | null;
  categoryAffinity: Map<string, number>;
  followingIds: Set<string>;
  tab: FeedTab;
}

const feedCandidateInclude = {
  media: {
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  },
  serviceAttachments: {
    where: { service: { status: ServiceStatus.PUBLISHED } },
    include: { service: true },
    orderBy: { createdAt: "asc" as const }
  },
  productAttachments: {
    where: { product: { status: ProductStatus.PUBLISHED } },
    include: {
      product: {
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" as const }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" as const }
  },
  professionalProfile: {
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          bio: true,
          location: true,
          emailVerified: true,
          phoneVerified: true
        }
      }
    }
  },
  _count: {
    select: { likes: true, saves: true, comments: true }
  }
} satisfies Prisma.PostInclude;

type FeedCandidate = Prisma.PostGetPayload<{ include: typeof feedCandidateInclude }>;

type RankedCandidate = {
  candidate: FeedCandidate;
  score: number;
  reasons: string[];
};

const discoveryEvents = new Set<FeedDiscoveryEventName>([
  "feed.impression",
  "feed.view",
  "feed.watch",
  "feed.profile_clicked",
  "feed.service_clicked",
  "feed.product_clicked"
]);

const feedTabs = new Set<FeedTab>(["for-you", "nearby", "connections"]);
const feedSources = new Set(["web", "mobile"]);

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    identity: AuthIdentity,
    tabInput: string | undefined,
    cursorInput?: string,
    limitInput?: string,
    locationInput?: string
  ) {
    const viewer = await this.requireViewer(identity);
    const tab = this.parseTab(tabInput);
    const limit = this.parseLimit(limitInput);
    const viewerLocation = this.normalizeOptionalLocation(locationInput) ?? viewer.location;

    const [categoryAffinity, followingRows] = await Promise.all([
      this.loadCategoryAffinity(viewer.id),
      this.prisma.userFollow.findMany({
        where: { followerId: viewer.id },
        select: { followingId: true }
      })
    ]);

    const followingIds = new Set(followingRows.map((row) => row.followingId));

    if (tab === "connections" && followingIds.size === 0) {
      return {
        tab,
        items: [],
        nextCursor: null,
        hasMore: false,
        viewerLocation,
        coldStart: categoryAffinity.size === 0,
        reason: "No followed creators yet"
      };
    }

    const profileWhere: Prisma.ProfessionalProfileWhereInput = {
      status: ProfessionalProfileStatus.PUBLISHED,
      userId: {
        ...(tab === "connections" ? { in: [...followingIds] } : {}),
        not: viewer.id
      },
      user: {
        capabilities: {
          some: {
            capability: Capability.HUSTLER,
            status: CapabilityStatus.ACTIVE
          }
        }
      }
    };

    const candidates = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        professionalProfile: { is: profileWhere }
      },
      include: feedCandidateInclude,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: 250
    });

    const locationFiltered = tab === "nearby"
      ? candidates.filter((candidate) => this.locationMatches(
          viewerLocation,
          candidate.location ?? candidate.professionalProfile.user.location
        ))
      : candidates;

    const context: RankingContext = {
      viewerLocation,
      categoryAffinity,
      followingIds,
      tab
    };

    const ranked = locationFiltered
      .map((candidate) => this.rank(candidate, context))
      .sort((left, right) => this.compareRanked(left, right));

    const cursor = this.decodeCursor(cursorInput);
    const afterCursor = cursor
      ? ranked.filter((item) => this.isAfterCursor(item, cursor))
      : ranked;

    const window = afterCursor.slice(0, limit + 1);
    const hasMore = window.length > limit;
    const page = hasMore ? window.slice(0, limit) : window;
    const postIds = page.map((item) => item.candidate.id);

    const [viewerLikes, viewerSaves] = postIds.length > 0
      ? await Promise.all([
          this.prisma.postLike.findMany({
            where: { userId: viewer.id, postId: { in: postIds } },
            select: { postId: true }
          }),
          this.prisma.postSave.findMany({
            where: { userId: viewer.id, postId: { in: postIds } },
            select: { postId: true }
          })
        ])
      : [[], []];

    const likedIds = new Set(viewerLikes.map((item) => item.postId));
    const savedIds = new Set(viewerSaves.map((item) => item.postId));

    const items = page.map((item) => this.toFeedItem(
      item,
      likedIds.has(item.candidate.id),
      savedIds.has(item.candidate.id),
      followingIds.has(item.candidate.professionalProfile.user.id)
    ));

    const last = page.at(-1);

    return {
      tab,
      items,
      nextCursor: hasMore && last ? this.encodeCursor(last) : null,
      hasMore,
      viewerLocation,
      coldStart: categoryAffinity.size === 0 && followingIds.size === 0
    };
  }

  async capture(identity: AuthIdentity, input: CaptureFeedEventInput) {
    const viewer = await this.requireViewer(identity);
    const name = this.parseEventName(input.name);
    const postId = this.requiredText(input.postId, "postId", 128);
    const feedTab = input.feedTab === undefined ? undefined : this.parseTab(String(input.feedTab));
    const source = this.parseSource(input.source);
    const position = this.optionalInteger(input.position, "position", 0, 10000);
    const sessionId = this.optionalText(input.sessionId, "sessionId", 120);
    const watchMs = this.optionalInteger(input.watchMs, "watchMs", 0, 86_400_000);

    if (name === "feed.watch" && watchMs === undefined) {
      throw new BadRequestException("watchMs is required for feed.watch");
    }

    const post = await this.requireEligiblePost(postId);
    let serviceId: string | undefined;
    let productId: string | undefined;

    if (name === "feed.service_clicked") {
      serviceId = this.requiredText(input.serviceId, "serviceId", 128);
      const attachment = await this.prisma.postServiceAttachment.findUnique({
        where: { postId_serviceId: { postId, serviceId } },
        include: { service: { select: { status: true } } }
      });
      if (!attachment || attachment.service.status !== ServiceStatus.PUBLISHED) {
        throw new BadRequestException("The Service is not an eligible attachment on this Post");
      }
    }

    if (name === "feed.product_clicked") {
      productId = this.requiredText(input.productId, "productId", 128);
      const attachment = await this.prisma.postProductAttachment.findUnique({
        where: { postId_productId: { postId, productId } },
        include: { product: { select: { status: true } } }
      });
      if (!attachment || attachment.product.status !== ProductStatus.PUBLISHED) {
        throw new BadRequestException("The Product is not an eligible attachment on this Post");
      }
    }

    const payload = {
      viewerUserId: viewer.id,
      postId,
      targetUserId: post.professionalProfile.userId,
      ...(feedTab !== undefined ? { feedTab } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(watchMs !== undefined ? { watchMs } : {}),
      ...(serviceId !== undefined ? { serviceId } : {}),
      ...(productId !== undefined ? { productId } : {})
    } satisfies Prisma.InputJsonObject;

    if (sessionId && name !== "feed.watch") {
      const duplicate = await this.findRecentDuplicate(name, payload);
      if (duplicate) {
        return {
          id: duplicate.id,
          name,
          occurredAt: duplicate.occurredAt,
          deduplicated: true
        };
      }
    }

    const event = await this.prisma.systemEvent.create({
      data: {
        name,
        source,
        payload
      },
      select: { id: true, name: true, source: true, occurredAt: true }
    });

    return { ...event, deduplicated: false };
  }

  private async requireViewer(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true, location: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private async requireEligiblePost(postId: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.PUBLISHED,
        professionalProfile: {
          is: {
            status: ProfessionalProfileStatus.PUBLISHED,
            user: {
              capabilities: {
                some: {
                  capability: Capability.HUSTLER,
                  status: CapabilityStatus.ACTIVE
                }
              }
            }
          }
        }
      },
      select: {
        id: true,
        professionalProfile: { select: { userId: true } }
      }
    });
    if (!post) throw new NotFoundException("Post is not eligible for discovery");
    return post;
  }

  private async loadCategoryAffinity(userId: string) {
    const [likes, saves, comments] = await Promise.all([
      this.prisma.postLike.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { post: { select: { category: true } } }
      }),
      this.prisma.postSave.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { post: { select: { category: true } } }
      }),
      this.prisma.postComment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { post: { select: { category: true } } }
      })
    ]);

    const affinity = new Map<string, number>();
    const add = (category: string | null, weight: number) => {
      const key = this.normalizeCategory(category);
      if (!key) return;
      affinity.set(key, (affinity.get(key) ?? 0) + weight);
    };

    likes.forEach((item) => add(item.post.category, 2));
    saves.forEach((item) => add(item.post.category, 3));
    comments.forEach((item) => add(item.post.category, 2));
    return affinity;
  }

  private rank(candidate: FeedCandidate, context: RankingContext): RankedCandidate {
    let score = 0;
    const reasons: string[] = [];

    const categoryKey = this.normalizeCategory(candidate.category);
    const categoryStrength = categoryKey ? context.categoryAffinity.get(categoryKey) ?? 0 : 0;
    if (categoryStrength > 0) {
      score += Math.min(25, categoryStrength * 4);
      reasons.push("category-affinity");
    }

    const creator = candidate.professionalProfile.user;
    const candidateLocation = candidate.location ?? creator.location;
    if (this.locationMatches(context.viewerLocation, candidateLocation)) {
      score += 20;
      reasons.push("location");
    }

    const ageMs = Date.now() - (candidate.publishedAt ?? candidate.createdAt).getTime();
    const ageHours = Math.max(0, ageMs / 3_600_000);
    if (ageHours <= 24) score += 30;
    else if (ageHours <= 72) score += 24;
    else if (ageHours <= 168) score += 18;
    else if (ageHours <= 336) score += 10;
    else if (ageHours <= 720) score += 5;
    if (ageHours <= 720) reasons.push("recency");

    const engagementScore = Math.min(
      20,
      candidate._count.likes * 2 + candidate._count.saves * 3 + candidate._count.comments * 2
    );
    if (engagementScore > 0) {
      score += engagementScore;
      reasons.push("engagement");
    }

    if (creator.emailVerified || creator.phoneVerified) {
      score += 8;
      reasons.push("verified-identity");
    }

    if ((candidate.professionalProfile.yearsExperience ?? 0) > 0) {
      score += Math.min(4, candidate.professionalProfile.yearsExperience ?? 0);
      reasons.push("experience");
    }

    if (context.followingIds.has(creator.id)) {
      score += 18;
      reasons.push("connection");
    }

    if (candidate.serviceAttachments.length > 0 || candidate.productAttachments.length > 0) {
      score += 5;
      reasons.push("economic-context");
    }

    if (context.tab === "nearby") score += 6;
    if (context.tab === "connections") score += 8;

    return { candidate, score, reasons };
  }

  private toFeedItem(
    ranked: RankedCandidate,
    liked: boolean,
    saved: boolean,
    following: boolean
  ) {
    const candidate = ranked.candidate;
    const profile = candidate.professionalProfile;
    const creator = profile.user;

    return {
      post: {
        id: candidate.id,
        caption: candidate.caption,
        category: candidate.category,
        location: candidate.location,
        tags: candidate.tags,
        publishedAt: candidate.publishedAt,
        media: candidate.media
      },
      creator: {
        id: creator.id,
        displayName: creator.displayName,
        username: creator.username,
        avatarUrl: creator.avatarUrl,
        bio: creator.bio,
        location: creator.location,
        verified: creator.emailVerified || creator.phoneVerified,
        professionalProfile: {
          id: profile.id,
          headline: profile.headline,
          primarySkill: profile.primarySkill,
          secondarySkills: profile.secondarySkills,
          category: profile.category,
          professionalSummary: profile.professionalSummary,
          yearsExperience: profile.yearsExperience
        }
      },
      engagement: {
        likes: candidate._count.likes,
        saves: candidate._count.saves,
        comments: candidate._count.comments
      },
      viewer: { liked, saved, following },
      services: candidate.serviceAttachments.map((attachment) => attachment.service),
      products: candidate.productAttachments.map((attachment) => attachment.product),
      ranking: {
        score: ranked.score,
        reasons: ranked.reasons
      }
    };
  }

  private compareRanked(left: RankedCandidate, right: RankedCandidate) {
    if (left.score !== right.score) return right.score - left.score;
    const leftTime = (left.candidate.publishedAt ?? left.candidate.createdAt).getTime();
    const rightTime = (right.candidate.publishedAt ?? right.candidate.createdAt).getTime();
    if (leftTime !== rightTime) return rightTime - leftTime;
    return right.candidate.id.localeCompare(left.candidate.id);
  }

  private isAfterCursor(item: RankedCandidate, cursor: FeedCursor) {
    if (item.score !== cursor.score) return item.score < cursor.score;
    const time = (item.candidate.publishedAt ?? item.candidate.createdAt).toISOString();
    if (time !== cursor.publishedAt) return time < cursor.publishedAt;
    return item.candidate.id < cursor.id;
  }

  private encodeCursor(item: RankedCandidate) {
    const payload: FeedCursor = {
      score: item.score,
      publishedAt: (item.candidate.publishedAt ?? item.candidate.createdAt).toISOString(),
      id: item.candidate.id
    };
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  }

  private decodeCursor(value?: string): FeedCursor | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<FeedCursor>;
      if (
        typeof parsed.score !== "number" ||
        typeof parsed.publishedAt !== "string" ||
        Number.isNaN(new Date(parsed.publishedAt).getTime()) ||
        typeof parsed.id !== "string" ||
        !parsed.id
      ) {
        throw new Error("invalid");
      }
      return parsed as FeedCursor;
    } catch {
      throw new BadRequestException("Invalid feed cursor");
    }
  }

  private async findRecentDuplicate(name: FeedDiscoveryEventName, payload: Prisma.InputJsonObject) {
    const since = new Date(Date.now() - 30 * 60_000);
    const recent = await this.prisma.systemEvent.findMany({
      where: { name, occurredAt: { gte: since } },
      orderBy: { occurredAt: "desc" },
      take: 100,
      select: { id: true, occurredAt: true, payload: true }
    });

    const keys = ["viewerUserId", "postId", "sessionId", "serviceId", "productId"];
    return recent.find((event) => {
      const eventPayload = this.asObject(event.payload);
      if (!eventPayload) return false;
      return keys.every((key) => {
        const expected = payload[key];
        return expected === undefined || eventPayload[key] === expected;
      });
    });
  }

  private asObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value || Array.isArray(value) || typeof value !== "object") return null;
    return value as unknown as Record<string, unknown>;
  }

  private parseTab(value?: string): FeedTab {
    const normalized = value ?? "for-you";
    if (!feedTabs.has(normalized as FeedTab)) {
      throw new BadRequestException("Feed tab must be for-you, nearby, or connections");
    }
    return normalized as FeedTab;
  }

  private parseEventName(value: unknown): FeedDiscoveryEventName {
    if (typeof value !== "string" || !discoveryEvents.has(value as FeedDiscoveryEventName)) {
      throw new BadRequestException("Invalid discovery event name");
    }
    return value as FeedDiscoveryEventName;
  }

  private parseSource(value: unknown) {
    const source = value === undefined ? "web" : value;
    if (typeof source !== "string" || !feedSources.has(source)) {
      throw new BadRequestException("Discovery event source must be web or mobile");
    }
    return source;
  }

  private parseLimit(value?: string) {
    if (value === undefined) return 10;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
      throw new BadRequestException("Feed limit must be an integer between 1 and 30");
    }
    return parsed;
  }

  private requiredText(value: unknown, field: string, maxLength: number) {
    const text = this.optionalText(value, field, maxLength);
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private optionalText(value: unknown, field: string, maxLength: number): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return undefined;
    if (normalized.length > maxLength) {
      throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    }
    return normalized;
  }

  private optionalInteger(
    value: unknown,
    field: string,
    min: number,
    max: number
  ): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`${field} must be an integer between ${min} and ${max}`);
    }
    return parsed;
  }

  private normalizeOptionalLocation(value?: string) {
    if (value === undefined) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > 160) throw new BadRequestException("location must be at most 160 characters");
    return trimmed;
  }

  private normalizeCategory(value: string | null) {
    return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  }

  private normalizeLocation(value: string | null) {
    if (!value) return "";
    const city = value.split(",")[0] ?? value;
    return city
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, " ");
  }

  private locationMatches(viewerLocation: string | null, candidateLocation: string | null) {
    const viewer = this.normalizeLocation(viewerLocation);
    const candidate = this.normalizeLocation(candidateLocation);
    return Boolean(viewer && candidate && viewer === candidate);
  }
}

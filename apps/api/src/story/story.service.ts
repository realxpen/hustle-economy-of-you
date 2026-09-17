import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ProductStatus, ProfessionalProfileStatus, ServiceStatus, StoryType } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { BlockPolicyService } from "../trust-safety/block-policy.service";

export interface CreateStoryInput {
  type?: unknown;
  text?: unknown;
  mediaUrl?: unknown;
  mediaStorageKey?: unknown;
  background?: unknown;
  serviceId?: unknown;
  productId?: unknown;
}

export interface StoryViewInput {
  viewerKey?: unknown;
}

export interface StoryReactionInput {
  reaction?: unknown;
}

export interface StoryReplyInput {
  body?: unknown;
}

export interface StoryEventInput {
  name?: unknown;
  viewerKey?: unknown;
}

const storyReactions = new Set(["HEART", "FIRE", "CLAP", "HUNDRED"]);
const storyEvents = new Set(["PROFILE_CLICKED", "SERVICE_CLICKED", "PRODUCT_CLICKED"]);

@Injectable()
export class StoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockPolicy: BlockPolicyService
  ) {}

  async listActive(limitInput?: unknown) {
    const now = new Date();
    const stories = await this.prisma.story.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: this.limit(limitInput)
    });
    return this.resolveStories(stories, now);
  }

  async getPublic(storyIdInput: string) {
    const story = await this.requireActiveStory(storyIdInput);
    const [resolved] = await this.resolveStories([story], new Date());
    return resolved;
  }

  async listMine(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    const now = new Date();
    const stories = await this.prisma.story.findMany({
      where: { userId: user.id },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: 40
    });
    return this.resolveStories(stories, now);
  }

  async create(identity: AuthIdentity, input: CreateStoryInput) {
    const user = await this.requireUser(identity);
    const type = this.requiredType(input.type);
    const text = this.optionalText(input.text, "text", 700);
    const suppliedMediaUrl = this.optionalUrl(input.mediaUrl, "mediaUrl", 1600);
    const mediaStorageKey = this.optionalText(input.mediaStorageKey, "mediaStorageKey", 1000);
    const background = this.optionalBackground(input.background);
    const serviceId = this.optionalId(input.serviceId, "serviceId");
    const productId = this.optionalId(input.productId, "productId");

    if (mediaStorageKey && !mediaStorageKey.startsWith(`${identity.subject}/stories/`)) {
      throw new BadRequestException("Story media storage path does not belong to this identity");
    }

    const mediaUrl = mediaStorageKey
      ? this.publicStoryMediaUrl(mediaStorageKey) ?? suppliedMediaUrl
      : suppliedMediaUrl;

    if (type === StoryType.TEXT && !text) {
      throw new BadRequestException("text is required for a text Story");
    }
    if ((type === StoryType.IMAGE || type === StoryType.VIDEO) && !mediaUrl) {
      throw new BadRequestException("mediaUrl or uploaded Story media is required for an image or video Story");
    }
    if (type === StoryType.TEXT && (mediaUrl || mediaStorageKey)) {
      throw new BadRequestException("A text Story cannot include media");
    }

    if (serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: serviceId, status: ServiceStatus.PUBLISHED },
        select: { id: true }
      });
      if (!service) throw new BadRequestException("Attached service must be currently published");
    }

    if (productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, status: ProductStatus.PUBLISHED },
        select: { id: true }
      });
      if (!product) throw new BadRequestException("Attached product must be currently published");
    }

    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt.getTime() + 24 * 60 * 60 * 1000);
    const story = await this.prisma.story.create({
      data: {
        userId: user.id,
        type,
        text,
        mediaUrl,
        mediaStorageKey,
        background: background ?? (type === StoryType.TEXT ? "#111111" : null),
        serviceId,
        productId,
        publishedAt,
        expiresAt
      }
    });

    await this.prisma.systemEvent.create({
      data: {
        name: "story.published",
        source: "api",
        payload: {
          storyId: story.id,
          contentAuthorUserId: user.id,
          type,
          nativeMedia: Boolean(mediaStorageKey),
          serviceId,
          productId,
          mentionedUsernames: this.mentionUsernames(text),
          expiresAt: expiresAt.toISOString()
        }
      }
    });

    const [resolved] = await this.resolveStories([story], publishedAt);
    return resolved;
  }

  async recordView(storyIdInput: string, input: StoryViewInput) {
    const story = await this.requireActiveStory(storyIdInput);
    const viewerKey = this.requiredViewerKey(input.viewerKey);
    const key = { storyId_viewerKey: { storyId: story.id, viewerKey } };
    const existing = await this.prisma.storyView.findUnique({ where: key, select: { id: true } });

    await this.prisma.storyView.upsert({
      where: key,
      create: { storyId: story.id, viewerKey },
      update: { lastViewedAt: new Date() }
    });

    if (!existing) {
      await this.prisma.systemEvent.create({
        data: {
          name: "story.viewed",
          source: "web",
          payload: { storyId: story.id, viewerKey }
        }
      });
    }

    return {
      recorded: true,
      unique: !existing,
      views: await this.prisma.storyView.count({ where: { storyId: story.id } })
    };
  }

  async getInteractions(storyIdInput: string) {
    const story = await this.requireActiveStory(storyIdInput);
    return this.interactionSummary(story.id);
  }

  async getViewerInteraction(identity: AuthIdentity, storyIdInput: string) {
    const user = await this.requireUser(identity);
    const story = await this.requireActiveStory(storyIdInput);
    const [reaction, ownReplyCount] = await Promise.all([
      this.prisma.storyReaction.findUnique({
        where: { storyId_userId: { storyId: story.id, userId: user.id } },
        select: { reaction: true }
      }),
      this.prisma.storyReply.count({ where: { storyId: story.id, userId: user.id } })
    ]);
    return {
      viewerUserId: user.id,
      isOwner: story.userId === user.id,
      reaction: reaction?.reaction ?? null,
      ownReplyCount
    };
  }

  async react(identity: AuthIdentity, storyIdInput: string, input: StoryReactionInput) {
    const user = await this.requireUser(identity);
    const story = await this.requireActiveStory(storyIdInput);
    if (story.userId === user.id) throw new BadRequestException("You cannot react to your own Story");
    const reaction = this.requiredReaction(input.reaction);

    await this.prisma.storyReaction.upsert({
      where: { storyId_userId: { storyId: story.id, userId: user.id } },
      create: { storyId: story.id, userId: user.id, reaction },
      update: { reaction }
    });

    await this.prisma.systemEvent.create({
      data: {
        name: "story.reacted",
        source: "web",
        payload: { storyId: story.id, userId: user.id, reaction }
      }
    });

    return {
      ...(await this.getViewerInteraction(identity, story.id)),
      summary: await this.interactionSummary(story.id)
    };
  }

  async removeReaction(identity: AuthIdentity, storyIdInput: string) {
    const user = await this.requireUser(identity);
    const story = await this.requireActiveStory(storyIdInput);
    await this.prisma.storyReaction.deleteMany({ where: { storyId: story.id, userId: user.id } });
    return {
      ...(await this.getViewerInteraction(identity, story.id)),
      summary: await this.interactionSummary(story.id)
    };
  }

  async reply(identity: AuthIdentity, storyIdInput: string, input: StoryReplyInput) {
    const user = await this.requireUser(identity);
    const story = await this.requireActiveStory(storyIdInput);
    if (story.userId === user.id) throw new BadRequestException("You cannot reply to your own Story");
    await this.blockPolicy.assertDirectContact(identity, story.userId);
    const body = this.requiredText(input.body, "body", 1200);

    const reply = await this.prisma.storyReply.create({
      data: { storyId: story.id, userId: user.id, body }
    });
    await this.prisma.systemEvent.create({
      data: {
        name: "story.replied",
        source: "web",
        payload: { storyId: story.id, replyId: reply.id, replierUserId: user.id, creatorUserId: story.userId }
      }
    });
    return this.serializeReply(reply, user);
  }

  async listReplies(identity: AuthIdentity, storyIdInput: string) {
    const user = await this.requireUser(identity);
    const storyId = this.requiredId(storyIdInput, "storyId");
    const story = await this.prisma.story.findUnique({ where: { id: storyId }, select: { id: true, userId: true } });
    if (!story) throw new NotFoundException("Story not found");

    const replies = await this.prisma.storyReply.findMany({
      where: story.userId === user.id ? { storyId: story.id } : { storyId: story.id, userId: user.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100
    });
    const userIds = [...new Set(replies.map((reply) => reply.userId))];
    const users = userIds.length === 0 ? [] : await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, username: true, avatarUrl: true }
    });
    const usersById = new Map(users.map((item) => [item.id, item]));
    return {
      isOwner: story.userId === user.id,
      items: replies.flatMap((reply) => {
        const author = usersById.get(reply.userId);
        return author ? [this.serializeReply(reply, author)] : [];
      })
    };
  }

  async recordEvent(storyIdInput: string, input: StoryEventInput) {
    const story = await this.requireActiveStory(storyIdInput);
    const name = this.requiredEvent(input.name);
    const viewerKey = this.optionalViewerKey(input.viewerKey);

    if (name === "SERVICE_CLICKED" && !story.serviceId) {
      throw new BadRequestException("This Story has no Service reference");
    }
    if (name === "PRODUCT_CLICKED" && !story.productId) {
      throw new BadRequestException("This Story has no Product reference");
    }

    const targetId = name === "PROFILE_CLICKED"
      ? story.userId
      : name === "SERVICE_CLICKED"
        ? story.serviceId
        : story.productId;

    await this.prisma.systemEvent.create({
      data: {
        name: `story.${name.toLowerCase()}`,
        source: "web",
        payload: { storyId: story.id, viewerKey, targetId }
      }
    });
    return { recorded: true, name, targetId };
  }

  async remove(identity: AuthIdentity, storyIdInput: string) {
    const user = await this.requireUser(identity);
    const storyId = this.requiredId(storyIdInput, "storyId");
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException("Story not found");
    if (story.userId !== user.id) throw new ForbiddenException("Only the Story owner can remove it");

    await this.prisma.$transaction([
      this.prisma.storyView.deleteMany({ where: { storyId: story.id } }),
      this.prisma.storyReaction.deleteMany({ where: { storyId: story.id } }),
      this.prisma.storyReply.deleteMany({ where: { storyId: story.id } }),
      this.prisma.story.delete({ where: { id: story.id } }),
      this.prisma.systemEvent.create({
        data: {
          name: "story.removed",
          source: "api",
          payload: {
            storyId: story.id,
            contentAuthorUserId: user.id,
            mediaStorageKey: story.mediaStorageKey
          }
        }
      })
    ]);
    return { deleted: true, id: story.id, mediaStorageKey: story.mediaStorageKey };
  }

  private async resolveStories(
    stories: Array<{
      id: string;
      userId: string;
      type: StoryType;
      text: string | null;
      mediaUrl: string | null;
      mediaStorageKey: string | null;
      background: string | null;
      serviceId: string | null;
      productId: string | null;
      publishedAt: Date;
      expiresAt: Date;
      createdAt: Date;
      updatedAt: Date;
    }>,
    now: Date
  ) {
    if (stories.length === 0) return [];

    const storyIds = stories.map((story) => story.id);
    const userIds = [...new Set(stories.map((story) => story.userId))];
    const serviceIds = [...new Set(stories.flatMap((story) => story.serviceId ? [story.serviceId] : []))];
    const productIds = [...new Set(stories.flatMap((story) => story.productId ? [story.productId] : []))];
    const mentionNames = [...new Set(stories.flatMap((story) => this.mentionUsernames(story.text)))];

    const [users, services, products, mentionedUsers, views, reactions, replies] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          location: true,
          emailVerified: true,
          phoneVerified: true,
          professionalProfile: { select: { status: true, headline: true, primarySkill: true } }
        }
      }),
      serviceIds.length === 0 ? Promise.resolve([]) : this.prisma.service.findMany({
        where: { id: { in: serviceIds }, status: ServiceStatus.PUBLISHED },
        select: {
          id: true,
          title: true,
          category: true,
          priceMinor: true,
          currency: true,
          pricingType: true,
          deliveryMode: true,
          professionalProfile: { select: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true } } } }
        }
      }),
      productIds.length === 0 ? Promise.resolve([]) : this.prisma.product.findMany({
        where: { id: { in: productIds }, status: ProductStatus.PUBLISHED },
        select: {
          id: true,
          title: true,
          category: true,
          priceMinor: true,
          currency: true,
          type: true,
          trackInventory: true,
          inventoryQuantity: true,
          professionalProfile: { select: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true } } } }
        }
      }),
      mentionNames.length === 0 ? Promise.resolve([]) : this.prisma.user.findMany({
        where: { username: { in: mentionNames, mode: "insensitive" } },
        select: { id: true, displayName: true, username: true, avatarUrl: true, location: true }
      }),
      this.prisma.storyView.groupBy({ by: ["storyId"], where: { storyId: { in: storyIds } }, _count: { _all: true } }),
      this.prisma.storyReaction.groupBy({ by: ["storyId", "reaction"], where: { storyId: { in: storyIds } }, _count: { _all: true } }),
      this.prisma.storyReply.groupBy({ by: ["storyId"], where: { storyId: { in: storyIds } }, _count: { _all: true } })
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));
    const servicesById = new Map(services.map((service) => [service.id, service]));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const mentionedByUsername = new Map(
      mentionedUsers.flatMap((user) => user.username ? [[user.username.toLowerCase(), user] as const] : [])
    );
    const viewCountByStory = new Map(views.map((item) => [item.storyId, item._count._all]));
    const replyCountByStory = new Map(replies.map((item) => [item.storyId, item._count._all]));
    const reactionsByStory = new Map<string, Record<string, number>>();
    for (const item of reactions) {
      const current = reactionsByStory.get(item.storyId) ?? {};
      current[item.reaction] = item._count._all;
      reactionsByStory.set(item.storyId, current);
    }

    return stories.flatMap((story) => {
      const creator = usersById.get(story.userId);
      if (!creator) return [];
      const remainingMs = Math.max(0, story.expiresAt.getTime() - now.getTime());
      const creatorProfile = creator.professionalProfile?.status === ProfessionalProfileStatus.PUBLISHED
        ? {
            headline: creator.professionalProfile.headline,
            primarySkill: creator.professionalProfile.primarySkill,
            published: true
          }
        : null;
      return [{
        ...story,
        active: remainingMs > 0,
        remainingMs,
        creator: {
          id: creator.id,
          displayName: creator.displayName,
          username: creator.username,
          avatarUrl: creator.avatarUrl,
          location: creator.location,
          verified: creator.emailVerified || creator.phoneVerified,
          professionalProfile: creatorProfile
        },
        mentions: this.mentionUsernames(story.text)
          .map((username) => mentionedByUsername.get(username))
          .filter(Boolean),
        service: story.serviceId ? servicesById.get(story.serviceId) ?? null : null,
        product: story.productId ? productsById.get(story.productId) ?? null : null,
        interactions: {
          views: viewCountByStory.get(story.id) ?? 0,
          replies: replyCountByStory.get(story.id) ?? 0,
          reactions: reactionsByStory.get(story.id) ?? {}
        }
      }];
    });
  }

  private async interactionSummary(storyId: string) {
    const [views, replies, reactions] = await Promise.all([
      this.prisma.storyView.count({ where: { storyId } }),
      this.prisma.storyReply.count({ where: { storyId } }),
      this.prisma.storyReaction.groupBy({ by: ["reaction"], where: { storyId }, _count: { _all: true } })
    ]);
    return {
      views,
      replies,
      reactions: Object.fromEntries(reactions.map((item) => [item.reaction, item._count._all]))
    };
  }

  private serializeReply(
    reply: { id: string; storyId: string; userId: string; body: string; createdAt: Date; updatedAt: Date },
    user: { id: string; displayName?: string | null; username?: string | null; avatarUrl?: string | null }
  ) {
    return {
      id: reply.id,
      storyId: reply.storyId,
      body: reply.body,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      user: {
        id: user.id,
        displayName: user.displayName ?? null,
        username: user.username ?? null,
        avatarUrl: user.avatarUrl ?? null
      }
    };
  }

  private async requireActiveStory(storyIdInput: string) {
    const storyId = this.requiredId(storyIdInput, "storyId");
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, expiresAt: { gt: new Date() } }
    });
    if (!story) throw new NotFoundException("Story not found or expired");
    return story;
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private publicStoryMediaUrl(storageKey: string) {
    const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
    if (!base) return null;
    const encodedPath = storageKey.split("/").map(encodeURIComponent).join("/");
    return `${base}/storage/v1/object/public/story-media/${encodedPath}`;
  }

  private mentionUsernames(value: string | null) {
    if (!value) return [];
    const matches = value.matchAll(/(^|\s)@([a-zA-Z0-9._-]{2,40})\b/g);
    return [...new Set(Array.from(matches, (match) => match[2].toLowerCase()))].slice(0, 12);
  }

  private requiredType(value: unknown) {
    if (typeof value !== "string" || !Object.values(StoryType).includes(value as StoryType)) {
      throw new BadRequestException("type must be TEXT, IMAGE or VIDEO");
    }
    return value as StoryType;
  }

  private requiredReaction(value: unknown) {
    if (typeof value !== "string" || !storyReactions.has(value)) {
      throw new BadRequestException("reaction must be HEART, FIRE, CLAP or HUNDRED");
    }
    return value;
  }

  private requiredEvent(value: unknown) {
    if (typeof value !== "string" || !storyEvents.has(value)) {
      throw new BadRequestException("name must be PROFILE_CLICKED, SERVICE_CLICKED or PRODUCT_CLICKED");
    }
    return value;
  }

  private requiredViewerKey(value: unknown) {
    const normalized = this.requiredText(value, "viewerKey", 120);
    if (!/^[a-zA-Z0-9:_-]{10,120}$/.test(normalized)) {
      throw new BadRequestException("viewerKey is invalid");
    }
    return normalized;
  }

  private optionalViewerKey(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredViewerKey(value);
  }

  private requiredText(value: unknown, field: string, maxLength: number) {
    const normalized = this.optionalText(value, field, maxLength);
    if (!normalized) throw new BadRequestException(`${field} is required`);
    return normalized;
  }

  private optionalText(value: unknown, field: string, maxLength: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    return normalized;
  }

  private optionalUrl(value: unknown, field: string, maxLength: number) {
    const normalized = this.optionalText(value, field, maxLength);
    if (!normalized) return null;
    try {
      const url = new URL(normalized);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      return url.toString();
    } catch {
      throw new BadRequestException(`${field} must be a valid http or https URL`);
    }
  }

  private optionalBackground(value: unknown) {
    const normalized = this.optionalText(value, "background", 40);
    if (!normalized) return null;
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      throw new BadRequestException("background must be a 6-digit hex colour such as #111111");
    }
    return normalized;
  }

  private optionalId(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredId(value, field);
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private limit(value: unknown) {
    if (value === undefined || value === null || value === "") return 60;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new BadRequestException("limit must be an integer between 1 and 100");
    }
    return parsed;
  }
}

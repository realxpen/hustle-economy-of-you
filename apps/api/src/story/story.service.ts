import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ProductStatus, ProfessionalProfileStatus, ServiceStatus, StoryType } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface CreateStoryInput {
  type?: unknown;
  text?: unknown;
  mediaUrl?: unknown;
  background?: unknown;
  serviceId?: unknown;
  productId?: unknown;
}

@Injectable()
export class StoryService {
  constructor(private readonly prisma: PrismaService) {}

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
    const storyId = this.requiredId(storyIdInput, "storyId");
    const now = new Date();
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, expiresAt: { gt: now } }
    });
    if (!story) throw new NotFoundException("Story not found or expired");
    const [resolved] = await this.resolveStories([story], now);
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
    const mediaUrl = this.optionalUrl(input.mediaUrl, "mediaUrl", 1200);
    const background = this.optionalBackground(input.background);
    const serviceId = this.optionalId(input.serviceId, "serviceId");
    const productId = this.optionalId(input.productId, "productId");

    if (type === StoryType.TEXT && !text) {
      throw new BadRequestException("text is required for a text Story");
    }
    if ((type === StoryType.IMAGE || type === StoryType.VIDEO) && !mediaUrl) {
      throw new BadRequestException("mediaUrl is required for an image or video Story");
    }
    if (type === StoryType.TEXT && mediaUrl) {
      throw new BadRequestException("A text Story cannot include mediaUrl");
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

  async remove(identity: AuthIdentity, storyIdInput: string) {
    const user = await this.requireUser(identity);
    const storyId = this.requiredId(storyIdInput, "storyId");
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException("Story not found");
    if (story.userId !== user.id) throw new ForbiddenException("Only the Story owner can remove it");

    await this.prisma.$transaction([
      this.prisma.story.delete({ where: { id: story.id } }),
      this.prisma.systemEvent.create({
        data: {
          name: "story.removed",
          source: "api",
          payload: { storyId: story.id, contentAuthorUserId: user.id }
        }
      })
    ]);
    return { deleted: true, id: story.id };
  }

  private async resolveStories(
    stories: Array<{
      id: string;
      userId: string;
      type: StoryType;
      text: string | null;
      mediaUrl: string | null;
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

    const userIds = [...new Set(stories.map((story) => story.userId))];
    const serviceIds = [...new Set(stories.flatMap((story) => story.serviceId ? [story.serviceId] : []))];
    const productIds = [...new Set(stories.flatMap((story) => story.productId ? [story.productId] : []))];
    const mentionNames = [...new Set(stories.flatMap((story) => this.mentionUsernames(story.text)))];

    const [users, services, products, mentionedUsers] = await Promise.all([
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
          professionalProfile: {
            select: { status: true, headline: true, primarySkill: true }
          }
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
          professionalProfile: {
            select: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true } } }
          }
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
          professionalProfile: {
            select: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true } } }
          }
        }
      }),
      mentionNames.length === 0 ? Promise.resolve([]) : this.prisma.user.findMany({
        where: { username: { in: mentionNames, mode: "insensitive" } },
        select: { id: true, displayName: true, username: true, avatarUrl: true, location: true }
      })
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));
    const servicesById = new Map(services.map((service) => [service.id, service]));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const mentionedByUsername = new Map(
      mentionedUsers.flatMap((user) => user.username ? [[user.username.toLowerCase(), user] as const] : [])
    );

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
        product: story.productId ? productsById.get(story.productId) ?? null : null
      }];
    });
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true, username: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
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

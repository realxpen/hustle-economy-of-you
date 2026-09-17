import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  PostMediaType,
  PostStatus,
  ProductStatus,
  ProfessionalProfileStatus,
  ServiceStatus
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface SavePostInput {
  caption?: unknown;
  category?: unknown;
  location?: unknown;
  tags?: unknown;
}

export interface AddPostMediaInput {
  type?: unknown;
  storageKey?: unknown;
  mediaUrl?: unknown;
  position?: unknown;
  width?: unknown;
  height?: unknown;
  durationMs?: unknown;
}

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(identity: AuthIdentity) {
    const profile = await this.requireContentProfile(identity);
    return this.prisma.post.findMany({
      where: { professionalProfileId: profile.id },
      include: this.ownerInclude(),
      orderBy: { updatedAt: "desc" }
    });
  }

  async create(identity: AuthIdentity, input: SavePostInput) {
    const profile = await this.requireContentProfile(identity);
    const post = await this.prisma.post.create({
      data: {
        professionalProfileId: profile.id,
        ...this.normalizePostInput(input)
      }
    });

    await this.prisma.systemEvent.create({
      data: {
        name: "post.created",
        source: "api",
        payload: {
          postId: post.id,
          contentAuthorUserId: profile.userId,
          professionalProfileId: profile.id
        }
      }
    });

    return this.requireOwnedPost(profile.id, post.id);
  }

  async getMine(identity: AuthIdentity, postId: string) {
    const profile = await this.requireContentProfile(identity);
    return this.requireOwnedPost(profile.id, postId);
  }

  async save(identity: AuthIdentity, postId: string, input: SavePostInput) {
    const profile = await this.requireContentProfile(identity);
    await this.requireOwnedPost(profile.id, postId);
    await this.prisma.post.update({
      where: { id: postId },
      data: this.normalizePostInput(input)
    });
    return this.requireOwnedPost(profile.id, postId);
  }

  async addMedia(identity: AuthIdentity, postId: string, input: AddPostMediaInput) {
    const profile = await this.requireContentProfile(identity);
    const post = await this.requireOwnedPost(profile.id, postId);

    if (post.media.length >= 10) {
      throw new BadRequestException("A post can contain at most 10 media items");
    }

    const type = this.requiredMediaType(input.type);
    if (type === PostMediaType.VIDEO && post.media.length > 0) {
      throw new BadRequestException("A video post can contain only one video media item");
    }
    if (type === PostMediaType.IMAGE && post.media.some((item) => item.type === PostMediaType.VIDEO)) {
      throw new BadRequestException("Images cannot be mixed with video in the same MVP post");
    }

    const storageKey = this.optionalText(input.storageKey, "storageKey", 1200);
    const mediaUrl = this.optionalUrl(input.mediaUrl);
    if (!storageKey && !mediaUrl) {
      throw new BadRequestException("Provide a storageKey or mediaUrl for post media");
    }

    const nextPosition = post.media.length === 0
      ? 0
      : Math.max(...post.media.map((item) => item.position)) + 1;

    await this.prisma.postMedia.create({
      data: {
        postId,
        type,
        storageKey: storageKey ?? null,
        mediaUrl: mediaUrl ?? null,
        position: this.optionalInteger(input.position, "position", 0, 1000) ?? nextPosition,
        width: this.optionalInteger(input.width, "width", 1, 10000) ?? null,
        height: this.optionalInteger(input.height, "height", 1, 10000) ?? null,
        durationMs: this.optionalInteger(input.durationMs, "durationMs", 0, 86_400_000) ?? null
      }
    });

    return this.requireOwnedPost(profile.id, postId);
  }

  async removeMedia(identity: AuthIdentity, postId: string, mediaId: string) {
    const profile = await this.requireContentProfile(identity);
    await this.requireOwnedPost(profile.id, postId);
    const media = await this.prisma.postMedia.findFirst({ where: { id: mediaId, postId } });
    if (!media) throw new NotFoundException("Post media not found");
    await this.prisma.postMedia.delete({ where: { id: media.id } });
    return this.requireOwnedPost(profile.id, postId);
  }

  async attachService(identity: AuthIdentity, postId: string, serviceId: string) {
    const profile = await this.requireContentProfile(identity);
    await this.requireOwnedPost(profile.id, postId);

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, status: ServiceStatus.PUBLISHED },
      select: { id: true }
    });
    if (!service) throw new NotFoundException("Published service not found");

    await this.prisma.postServiceAttachment.upsert({
      where: { postId_serviceId: { postId, serviceId } },
      update: {},
      create: { postId, serviceId }
    });
    return this.requireOwnedPost(profile.id, postId);
  }

  async detachService(identity: AuthIdentity, postId: string, serviceId: string) {
    const profile = await this.requireContentProfile(identity);
    await this.requireOwnedPost(profile.id, postId);
    await this.prisma.postServiceAttachment.deleteMany({ where: { postId, serviceId } });
    return this.requireOwnedPost(profile.id, postId);
  }

  async attachProduct(identity: AuthIdentity, postId: string, productId: string) {
    const profile = await this.requireContentProfile(identity);
    await this.requireOwnedPost(profile.id, postId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.PUBLISHED },
      select: { id: true }
    });
    if (!product) throw new NotFoundException("Published product not found");

    await this.prisma.postProductAttachment.upsert({
      where: { postId_productId: { postId, productId } },
      update: {},
      create: { postId, productId }
    });
    return this.requireOwnedPost(profile.id, postId);
  }

  async detachProduct(identity: AuthIdentity, postId: string, productId: string) {
    const profile = await this.requireContentProfile(identity);
    await this.requireOwnedPost(profile.id, postId);
    await this.prisma.postProductAttachment.deleteMany({ where: { postId, productId } });
    return this.requireOwnedPost(profile.id, postId);
  }

  async publish(identity: AuthIdentity, postId: string) {
    const profile = await this.requireContentProfile(identity);
    const post = await this.requireOwnedPost(profile.id, postId);

    const missing: string[] = [];
    if (!post.caption) missing.push("caption");
    if (!post.category) missing.push("category");
    if (post.media.length === 0) missing.push("media");
    if (missing.length > 0) {
      throw new BadRequestException(`Complete these fields before publishing: ${missing.join(", ")}`);
    }

    const videos = post.media.filter((item) => item.type === PostMediaType.VIDEO);
    const images = post.media.filter((item) => item.type === PostMediaType.IMAGE);
    if ((videos.length === 1 && images.length > 0) || videos.length > 1) {
      throw new BadRequestException("A post must be either one video or one-to-ten images");
    }
    if (post.media.some((item) => !item.mediaUrl)) {
      throw new BadRequestException("Every media item needs a public mediaUrl before publication");
    }

    const publishedAt = post.publishedAt ?? new Date();
    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: post.id },
        data: { status: PostStatus.PUBLISHED, publishedAt }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "post.published",
          source: "api",
          payload: {
            postId: post.id,
            contentAuthorUserId: profile.userId,
            professionalProfileId: profile.id
          }
        }
      })
    ]);
    return this.requireOwnedPost(profile.id, post.id);
  }

  async archive(identity: AuthIdentity, postId: string) {
    const profile = await this.requireContentProfile(identity);
    const post = await this.requireOwnedPost(profile.id, postId);
    if (post.status === PostStatus.ARCHIVED) return post;

    await this.prisma.$transaction([
      this.prisma.post.update({ where: { id: post.id }, data: { status: PostStatus.ARCHIVED } }),
      this.prisma.systemEvent.create({
        data: {
          name: "post.archived",
          source: "api",
          payload: { postId: post.id, contentAuthorUserId: profile.userId }
        }
      })
    ]);
    return this.requireOwnedPost(profile.id, post.id);
  }

  async getPublic(postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, status: PostStatus.PUBLISHED },
      include: {
        ...this.ownerInclude(),
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
        }
      }
    });

    if (!post) throw new NotFoundException("Post not found or not currently public");

    const profile = post.professionalProfile;
    const owner = profile.user;
    const mentions = await this.resolveMentions(post.caption);
    const publicProfessionalProfile = profile.status === ProfessionalProfileStatus.PUBLISHED
      ? {
          id: profile.id,
          headline: profile.headline,
          primarySkill: profile.primarySkill,
          secondarySkills: profile.secondarySkills,
          category: profile.category,
          professionalSummary: profile.professionalSummary,
          yearsExperience: profile.yearsExperience
        }
      : null;

    const { professionalProfile: _profile, ...publicPost } = post;
    return {
      post: publicPost,
      owner: {
        id: owner.id,
        displayName: owner.displayName,
        username: owner.username,
        avatarUrl: owner.avatarUrl,
        bio: owner.bio,
        location: owner.location,
        verified: owner.emailVerified || owner.phoneVerified,
        professionalProfile: publicProfessionalProfile
      },
      mentions
    };
  }

  private ownerInclude() {
    return {
      media: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
      serviceAttachments: {
        include: {
          service: {
            include: {
              professionalProfile: {
                select: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true } } }
              }
            }
          }
        },
        orderBy: { createdAt: "asc" as const }
      },
      productAttachments: {
        include: {
          product: {
            include: {
              variants: { orderBy: { createdAt: "asc" as const } },
              professionalProfile: {
                select: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true } } }
              }
            }
          }
        },
        orderBy: { createdAt: "asc" as const }
      }
    };
  }

  private async requireContentProfile(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true, professionalProfile: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    if (user.professionalProfile) return user.professionalProfile;

    return this.prisma.professionalProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    });
  }

  private async requireOwnedPost(profileId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, professionalProfileId: profileId },
      include: this.ownerInclude()
    });
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  private async resolveMentions(caption: string | null) {
    const usernames = this.mentionUsernames(caption);
    if (usernames.length === 0) return [];
    return this.prisma.user.findMany({
      where: { username: { in: usernames, mode: "insensitive" } },
      select: { id: true, displayName: true, username: true, avatarUrl: true, location: true }
    });
  }

  private mentionUsernames(value: string | null) {
    if (!value) return [];
    const matches = value.matchAll(/(^|\s)@([a-zA-Z0-9._-]{2,40})\b/g);
    return [...new Set(Array.from(matches, (match) => match[2].toLowerCase()))].slice(0, 12);
  }

  private normalizePostInput(input: SavePostInput) {
    const caption = this.optionalText(input.caption, "caption", 4000);
    const category = this.optionalText(input.category, "category", 100);
    const location = this.optionalText(input.location, "location", 160);
    const tags = this.optionalTags(input.tags);
    return {
      ...(caption !== undefined ? { caption } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(tags !== undefined ? { tags } : {})
    };
  }

  private optionalText(value: unknown, field: string, maxLength: number): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    return normalized;
  }

  private optionalTags(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) throw new BadRequestException("tags must be a list");
    if (value.length > 20) throw new BadRequestException("A post can have at most 20 tags");
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") throw new BadRequestException("tags must contain text values only");
      const tag = item.trim();
      if (!tag || tag.length > 60) throw new BadRequestException("Each tag must be between 1 and 60 characters");
      const key = tag.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(tag);
      }
    }
    return normalized;
  }

  private requiredMediaType(value: unknown): PostMediaType {
    if (!Object.values(PostMediaType).includes(value as PostMediaType)) {
      throw new BadRequestException("Invalid post media type");
    }
    return value as PostMediaType;
  }

  private optionalUrl(value: unknown): string | null | undefined {
    const normalized = this.optionalText(value, "mediaUrl", 1200);
    if (normalized === undefined || normalized === null) return normalized;
    try {
      const url = new URL(normalized);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      return url.toString();
    } catch {
      throw new BadRequestException("mediaUrl must be a valid http or https URL");
    }
  }

  private optionalInteger(value: unknown, field: string, min: number, max: number): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`${field} must be an integer between ${min} and ${max}`);
    }
    return parsed;
  }
}

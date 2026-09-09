import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PostStatus, ProfessionalProfileStatus } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface CreatePostCommentInput {
  body?: unknown;
  parentId?: unknown;
}

@Injectable()
export class PostInteractionService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic(postId: string) {
    const post = await this.requirePublicPost(postId);

    const [likeCount, saveCount, commentCount, followerCount, comments] = await Promise.all([
      this.prisma.postLike.count({ where: { postId } }),
      this.prisma.postSave.count({ where: { postId } }),
      this.prisma.postComment.count({ where: { postId } }),
      this.prisma.userFollow.count({ where: { followingId: post.ownerUserId } }),
      this.prisma.postComment.findMany({
        where: { postId },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          postId: true,
          parentId: true,
          body: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true
            }
          }
        }
      })
    ]);

    return {
      likeCount,
      saveCount,
      commentCount,
      followerCount,
      comments
    };
  }

  async getViewerState(identity: AuthIdentity, postId: string) {
    const [user, post] = await Promise.all([
      this.requireUser(identity),
      this.requirePublicPost(postId)
    ]);

    const [like, save, follow] = await Promise.all([
      this.prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId: user.id } },
        select: { postId: true }
      }),
      this.prisma.postSave.findUnique({
        where: { postId_userId: { postId, userId: user.id } },
        select: { postId: true }
      }),
      this.prisma.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: post.ownerUserId
          }
        },
        select: { followerId: true }
      })
    ]);

    return {
      liked: Boolean(like),
      saved: Boolean(save),
      followingCreator: Boolean(follow),
      isCreator: user.id === post.ownerUserId,
      viewerUserId: user.id
    };
  }

  async like(identity: AuthIdentity, postId: string) {
    const [user] = await Promise.all([this.requireUser(identity), this.requirePublicPost(postId)]);
    await this.prisma.postLike.upsert({
      where: { postId_userId: { postId, userId: user.id } },
      update: {},
      create: { postId, userId: user.id }
    });
    return this.getViewerState(identity, postId);
  }

  async unlike(identity: AuthIdentity, postId: string) {
    const user = await this.requireUser(identity);
    await this.prisma.postLike.deleteMany({ where: { postId, userId: user.id } });
    return this.getViewerState(identity, postId);
  }

  async save(identity: AuthIdentity, postId: string) {
    const [user] = await Promise.all([this.requireUser(identity), this.requirePublicPost(postId)]);
    await this.prisma.postSave.upsert({
      where: { postId_userId: { postId, userId: user.id } },
      update: {},
      create: { postId, userId: user.id }
    });
    return this.getViewerState(identity, postId);
  }

  async unsave(identity: AuthIdentity, postId: string) {
    const user = await this.requireUser(identity);
    await this.prisma.postSave.deleteMany({ where: { postId, userId: user.id } });
    return this.getViewerState(identity, postId);
  }

  async comment(identity: AuthIdentity, postId: string, input: CreatePostCommentInput) {
    const [user] = await Promise.all([this.requireUser(identity), this.requirePublicPost(postId)]);
    const body = this.requiredBody(input.body);
    const parentId = this.optionalId(input.parentId, "parentId");

    if (parentId) {
      const parent = await this.prisma.postComment.findFirst({
        where: { id: parentId, postId },
        select: { id: true }
      });
      if (!parent) throw new BadRequestException("Reply parent must belong to this post");
    }

    return this.prisma.postComment.create({
      data: {
        postId,
        userId: user.id,
        body,
        parentId: parentId ?? null
      },
      select: {
        id: true,
        postId: true,
        parentId: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true
          }
        }
      }
    });
  }

  async removeComment(identity: AuthIdentity, postId: string, commentId: string) {
    const user = await this.requireUser(identity);
    const comment = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId, userId: user.id },
      select: { id: true }
    });
    if (!comment) throw new NotFoundException("Comment not found or not owned by you");

    await this.prisma.postComment.delete({ where: { id: comment.id } });
    return { deleted: true, id: comment.id };
  }

  async follow(identity: AuthIdentity, followingId: string) {
    const user = await this.requireUser(identity);
    if (user.id === followingId) throw new BadRequestException("You cannot follow yourself");

    const target = await this.prisma.user.findUnique({ where: { id: followingId }, select: { id: true } });
    if (!target) throw new NotFoundException("User not found");

    await this.prisma.userFollow.upsert({
      where: {
        followerId_followingId: {
          followerId: user.id,
          followingId
        }
      },
      update: {},
      create: { followerId: user.id, followingId }
    });

    return { following: true, userId: followingId };
  }

  async unfollow(identity: AuthIdentity, followingId: string) {
    const user = await this.requireUser(identity);
    await this.prisma.userFollow.deleteMany({ where: { followerId: user.id, followingId } });
    return { following: false, userId: followingId };
  }

  async recordShare(postId: string) {
    await this.requirePublicPost(postId);
    await this.prisma.systemEvent.create({
      data: {
        name: "post.shared",
        source: "web",
        payload: { postId }
      }
    });
    return { recorded: true, postId };
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private async requirePublicPost(postId: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.PUBLISHED,
        professionalProfile: {
          is: {
            status: ProfessionalProfileStatus.PUBLISHED,
            user: {
              capabilities: {
                some: { capability: "HUSTLER", status: "ACTIVE" }
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
    if (!post) throw new NotFoundException("Post not found or not currently public");
    return { id: post.id, ownerUserId: post.professionalProfile.userId };
  }

  private requiredBody(value: unknown) {
    if (typeof value !== "string") throw new BadRequestException("Comment body is required");
    const body = value.trim();
    if (!body || body.length > 1200) {
      throw new BadRequestException("Comment body must be between 1 and 1200 characters");
    }
    return body;
  }

  private optionalId(value: unknown, field: string): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || !value.trim() || value.length > 200) {
      throw new BadRequestException(`${field} must be a valid identifier`);
    }
    return value.trim();
  }
}

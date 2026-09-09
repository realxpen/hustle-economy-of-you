import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PostInteractionService, type CreatePostCommentInput } from "./post-interaction.service";

@Controller("posts")
export class PublicPostInteractionController {
  constructor(private readonly interactions: PostInteractionService) {}

  @Get(":postId/interactions")
  getPublic(@Param("postId") postId: string) {
    return this.interactions.getPublic(postId);
  }

  @Post(":postId/share")
  recordShare(@Param("postId") postId: string) {
    return this.interactions.recordShare(postId);
  }
}

@Controller("posts")
@UseGuards(AuthGuard)
export class AuthenticatedPostInteractionController {
  constructor(private readonly interactions: PostInteractionService) {}

  @Get(":postId/interactions/me")
  getViewerState(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string
  ) {
    return this.interactions.getViewerState(identity, postId);
  }

  @Post(":postId/like")
  like(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string
  ) {
    return this.interactions.like(identity, postId);
  }

  @Delete(":postId/like")
  unlike(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string
  ) {
    return this.interactions.unlike(identity, postId);
  }

  @Post(":postId/save")
  save(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string
  ) {
    return this.interactions.save(identity, postId);
  }

  @Delete(":postId/save")
  unsave(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string
  ) {
    return this.interactions.unsave(identity, postId);
  }

  @Post(":postId/comments")
  comment(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Body() body: CreatePostCommentInput
  ) {
    return this.interactions.comment(identity, postId, body);
  }

  @Delete(":postId/comments/:commentId")
  removeComment(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Param("commentId") commentId: string
  ) {
    return this.interactions.removeComment(identity, postId, commentId);
  }
}

@Controller("users")
@UseGuards(AuthGuard)
export class UserFollowController {
  constructor(private readonly interactions: PostInteractionService) {}

  @Post(":userId/follow")
  follow(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("userId") userId: string
  ) {
    return this.interactions.follow(identity, userId);
  }

  @Delete(":userId/follow")
  unfollow(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("userId") userId: string
  ) {
    return this.interactions.unfollow(identity, userId);
  }
}

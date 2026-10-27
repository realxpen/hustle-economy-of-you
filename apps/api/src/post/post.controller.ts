import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import type { Response } from "express";
import { StagingUploadService } from "./staging-upload.service";
import {
  PostService,
  type AddPostMediaInput,
  type SavePostInput
} from "./post.service";

@Controller("posts")
@UseGuards(AuthGuard)
export class OwnerPostController {
  constructor(private readonly posts: PostService, private readonly uploads: StagingUploadService) {}

  @Get("mine")
  listMine(@CurrentIdentity() identity: AuthIdentity) {
    return this.posts.listMine(identity);
  }

  @Post()
  create(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: SavePostInput
  ) {
    return this.posts.create(identity, body);
  }

  @Get("mine/:postId")
  getMine(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string
  ) {
    return this.posts.getMine(identity, postId);
  }

  @Put(":postId")
  save(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Body() body: SavePostInput
  ) {
    return this.posts.save(identity, postId, body);
  }

  @Post(":postId/media")
  addMedia(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Body() body: AddPostMediaInput
  ) {
    return this.posts.addMedia(identity, postId, body);
  }

  @Post(":postId/media/uploads/authorize")
  authorizeMediaUpload(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Body() body: { contentType?: unknown; size?: unknown }
  ) {
    return this.uploads.authorize(identity, postId, body);
  }

  @Post(":postId/media/uploads/confirm")
  confirmMediaUpload(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Body() body: { receipt?: unknown }
  ) {
    return this.uploads.confirm(identity, postId, body);
  }

  @Delete(":postId/media/:mediaId")
  removeMedia(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Param("mediaId") mediaId: string
  ) {
    return this.posts.removeMedia(identity, postId, mediaId);
  }

  @Post(":postId/services/:serviceId")
  attachService(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Param("serviceId") serviceId: string
  ) {
    return this.posts.attachService(identity, postId, serviceId);
  }

  @Delete(":postId/services/:serviceId")
  detachService(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Param("serviceId") serviceId: string
  ) {
    return this.posts.detachService(identity, postId, serviceId);
  }

  @Post(":postId/products/:productId")
  attachProduct(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Param("productId") productId: string
  ) {
    return this.posts.attachProduct(identity, postId, productId);
  }

  @Delete(":postId/products/:productId")
  detachProduct(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Param("productId") productId: string
  ) {
    return this.posts.detachProduct(identity, postId, productId);
  }

  @Post(":postId/publish")
  publish(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string
  ) {
    return this.posts.publish(identity, postId);
  }

  @Post(":postId/archive")
  archive(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string
  ) {
    return this.posts.archive(identity, postId);
  }
}

@Controller("posts")
export class PublicPostController {
  constructor(private readonly posts: PostService) {}

  @Get(":postId")
  getPublic(@Param("postId") postId: string) {
    return this.posts.getPublic(postId);
  }
}

/** A public post's media is served via a short-lived, private-bucket redirect.
 * Draft and archived media are never exposed through this public route.
 */
@Controller("media")
export class StagingPostMediaController {
  constructor(private readonly uploads: StagingUploadService) {}

  @Get("p/:postId/:mediaId")
  async public(
    @Param("postId") postId: string,
    @Param("mediaId") mediaId: string,
    @Res() response: Response
  ) {
    response.setHeader("Cache-Control", "private, no-store");
    response.redirect(307, await this.uploads.publicMedia(postId, mediaId));
  }

  @Get("o/:postId/:mediaId")
  @UseGuards(AuthGuard)
  async owner(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("postId") postId: string,
    @Param("mediaId") mediaId: string,
    @Res() response: Response
  ) {
    response.setHeader("Cache-Control", "private, no-store");
    response.redirect(307, await this.uploads.ownedMedia(identity, postId, mediaId));
  }
}

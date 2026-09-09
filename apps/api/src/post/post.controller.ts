import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";
import { Capability } from "@prisma/client";

import { AuthGuard } from "../auth/auth.guard";
import { CapabilityGuard } from "../auth/capability.guard";
import { RequireCapability } from "../auth/capability.decorator";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  PostService,
  type AddPostMediaInput,
  type SavePostInput
} from "./post.service";

@Controller("posts")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.HUSTLER)
export class OwnerPostController {
  constructor(private readonly posts: PostService) {}

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

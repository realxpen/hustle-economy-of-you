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
import type {
  AddPostMediaInput,
  SavePostInput
} from "../post/post.service";
import type { SaveProductInput } from "../product/product.service";
import type { SaveProfessionalProfileInput } from "../professional-profile/professional-profile.service";
import type { SaveServiceInput } from "../service/service.service";
import { AgentBusinessService } from "./agent-business.service";

@Controller("agent-business/:principalUserId")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.AGENT)
export class AgentBusinessController {
  constructor(private readonly business: AgentBusinessService) {}

  @Get()
  overview(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string
  ) {
    return this.business.overview(identity, principalUserId);
  }

  @Get("profile")
  getProfile(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string
  ) {
    return this.business.getProfile(identity, principalUserId);
  }

  @Put("profile")
  saveProfile(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Body() body: SaveProfessionalProfileInput
  ) {
    return this.business.saveProfile(identity, principalUserId, body);
  }

  @Post("profile/publish")
  publishProfile(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string
  ) {
    return this.business.publishProfile(identity, principalUserId);
  }

  @Post("profile/unpublish")
  unpublishProfile(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string
  ) {
    return this.business.unpublishProfile(identity, principalUserId);
  }

  @Get("services")
  listServices(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string
  ) {
    return this.business.listServices(identity, principalUserId);
  }

  @Post("services")
  createService(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Body() body: SaveServiceInput
  ) {
    return this.business.createService(identity, principalUserId, body);
  }

  @Put("services/:serviceId")
  saveService(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("serviceId") serviceId: string,
    @Body() body: SaveServiceInput
  ) {
    return this.business.saveService(identity, principalUserId, serviceId, body);
  }

  @Post("services/:serviceId/publish")
  publishService(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("serviceId") serviceId: string
  ) {
    return this.business.publishService(identity, principalUserId, serviceId);
  }

  @Post("services/:serviceId/pause")
  pauseService(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("serviceId") serviceId: string
  ) {
    return this.business.pauseService(identity, principalUserId, serviceId);
  }

  @Delete("services/:serviceId")
  removeService(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("serviceId") serviceId: string
  ) {
    return this.business.removeService(identity, principalUserId, serviceId);
  }

  @Get("products")
  listProducts(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string
  ) {
    return this.business.listProducts(identity, principalUserId);
  }

  @Post("products")
  createProduct(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Body() body: SaveProductInput
  ) {
    return this.business.createProduct(identity, principalUserId, body);
  }

  @Put("products/:productId")
  saveProduct(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("productId") productId: string,
    @Body() body: SaveProductInput
  ) {
    return this.business.saveProduct(identity, principalUserId, productId, body);
  }

  @Post("products/:productId/publish")
  publishProduct(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("productId") productId: string
  ) {
    return this.business.publishProduct(identity, principalUserId, productId);
  }

  @Post("products/:productId/pause")
  pauseProduct(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("productId") productId: string
  ) {
    return this.business.pauseProduct(identity, principalUserId, productId);
  }

  @Delete("products/:productId")
  removeProduct(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("productId") productId: string
  ) {
    return this.business.removeProduct(identity, principalUserId, productId);
  }

  @Get("posts")
  listPosts(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string
  ) {
    return this.business.listPosts(identity, principalUserId);
  }

  @Post("posts")
  createPost(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Body() body: SavePostInput
  ) {
    return this.business.createPost(identity, principalUserId, body);
  }

  @Put("posts/:postId")
  savePost(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("postId") postId: string,
    @Body() body: SavePostInput
  ) {
    return this.business.savePost(identity, principalUserId, postId, body);
  }

  @Post("posts/:postId/media")
  addPostMedia(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("postId") postId: string,
    @Body() body: AddPostMediaInput
  ) {
    return this.business.addPostMedia(identity, principalUserId, postId, body);
  }

  @Delete("posts/:postId/media/:mediaId")
  removePostMedia(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("postId") postId: string,
    @Param("mediaId") mediaId: string
  ) {
    return this.business.removePostMedia(
      identity,
      principalUserId,
      postId,
      mediaId
    );
  }

  @Post("posts/:postId/publish")
  publishPost(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("postId") postId: string
  ) {
    return this.business.publishPost(identity, principalUserId, postId);
  }

  @Post("posts/:postId/archive")
  archivePost(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("postId") postId: string
  ) {
    return this.business.archivePost(identity, principalUserId, postId);
  }
}

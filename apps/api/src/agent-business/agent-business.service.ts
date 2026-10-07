import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgentPermissionScope,
  Capability,
  PostMediaType,
  PostStatus,
  ProductStatus,
  ProductType,
  ProfessionalProfileStatus,
  ServiceDeliveryMode,
  ServicePricingType,
  ServiceStatus,
  type Prisma
} from "@prisma/client";

import { AgentRelationshipService } from "../agent-relationship/agent-relationship.service";
import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import type {
  AddPostMediaInput,
  SavePostInput
} from "../post/post.service";
import type { SaveProductInput } from "../product/product.service";
import type { SaveProfessionalProfileInput } from "../professional-profile/professional-profile.service";
import type { SaveServiceInput } from "../service/service.service";

type DelegationContext = {
  actorUserId: string;
  principalUserId: string;
  relationshipId: string;
  scope: AgentPermissionScope;
};

@Injectable()
export class AgentBusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationships: AgentRelationshipService
  ) {}

  async overview(identity: AuthIdentity, principalUserId: string) {
    const actor = await this.requireAgent(identity);
    const principalId = this.requiredId(principalUserId, "principalUserId");

    const relationship = await this.prisma.agentRelationship.findFirst({
      where: {
        agentUserId: actor.id,
        principalUserId: principalId,
        status: "ACTIVE"
      },
      include: {
        principal: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
            location: true,
            capabilities: {
              where: { status: "ACTIVE" },
              select: { capability: true, status: true, enabledAt: true },
              orderBy: { enabledAt: "asc" }
            }
          }
        },
        permissions: {
          where: { active: true },
          orderBy: { scope: "asc" }
        }
      }
    });

    if (!relationship) {
      throw new ForbiddenException("An ACTIVE Agent relationship is required");
    }

    await this.relationships.assertAgentPermission(
      actor.id,
      principalId,
      relationship.permissions[0]?.scope ?? AgentPermissionScope.CONTENT_MANAGE
    ).catch(async () => {
      const block = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerUserId: actor.id, blockedUserId: principalId },
            { blockerUserId: principalId, blockedUserId: actor.id }
          ]
        },
        select: { blockerUserId: true }
      });
      if (block) {
        throw new ForbiddenException(
          "This representation is unavailable because one user has blocked the other"
        );
      }
    });

    return relationship;
  }

  async getProfile(identity: AuthIdentity, principalUserId: string) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PROFILE_MANAGE,
      true
    );

    return this.prisma.professionalProfile.findUnique({
      where: { userId: ctx.principalUserId }
    });
  }

  async saveProfile(
    identity: AuthIdentity,
    principalUserId: string,
    input: SaveProfessionalProfileInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PROFILE_MANAGE,
      true
    );

    const data = this.normalizeProfileInput(input);

    return this.writeWithAudit(
      ctx,
      "agent.profile.saved",
      "ProfessionalProfile",
      null,
      async (tx) => {
        const profile = await tx.professionalProfile.upsert({
          where: { userId: ctx.principalUserId },
          create: {
            userId: ctx.principalUserId,
            ...data
          },
          update: data
        });
        return profile;
      }
    );
  }

  async publishProfile(identity: AuthIdentity, principalUserId: string) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PROFILE_MANAGE,
      true
    );

    const principal = await this.prisma.user.findUnique({
      where: { id: ctx.principalUserId },
      select: {
        username: true,
        professionalProfile: true
      }
    });
    const profile = principal?.professionalProfile;

    if (!principal || !profile) {
      throw new BadRequestException("Create the professional profile before publishing it");
    }

    const missing: string[] = [];
    if (!principal.username) missing.push("username");
    if (!profile.headline) missing.push("headline");
    if (!profile.primarySkill) missing.push("primarySkill");
    if (!profile.category) missing.push("category");
    if (!profile.professionalSummary) missing.push("professionalSummary");
    if (profile.yearsExperience === null) missing.push("yearsExperience");
    if (missing.length > 0) {
      throw new BadRequestException(
        `Complete these fields before publishing: ${missing.join(", ")}`
      );
    }

    return this.writeWithAudit(
      ctx,
      "agent.profile.published",
      "ProfessionalProfile",
      profile.id,
      (tx) =>
        tx.professionalProfile.update({
          where: { id: profile.id },
          data: {
            status: ProfessionalProfileStatus.PUBLISHED,
            publishedAt: profile.publishedAt ?? new Date()
          }
        })
    );
  }

  async unpublishProfile(identity: AuthIdentity, principalUserId: string) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PROFILE_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);

    return this.writeWithAudit(
      ctx,
      "agent.profile.unpublished",
      "ProfessionalProfile",
      profile.id,
      (tx) =>
        tx.professionalProfile.update({
          where: { id: profile.id },
          data: {
            status: ProfessionalProfileStatus.DRAFT,
            publishedAt: null
          }
        })
    );
  }

  async listServices(identity: AuthIdentity, principalUserId: string) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.SERVICE_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    return this.prisma.service.findMany({
      where: { professionalProfileId: profile.id },
      orderBy: { updatedAt: "desc" }
    });
  }

  async createService(
    identity: AuthIdentity,
    principalUserId: string,
    input: SaveServiceInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.SERVICE_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    const data = this.normalizeServiceInput(input);

    return this.writeWithAudit(
      ctx,
      "agent.service.created",
      "Service",
      null,
      (tx) =>
        tx.service.create({
          data: {
            professionalProfileId: profile.id,
            ...data
          }
        })
    );
  }

  async saveService(
    identity: AuthIdentity,
    principalUserId: string,
    serviceId: string,
    input: SaveServiceInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.SERVICE_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    const service = await this.requireOwnedService(profile.id, serviceId);

    return this.writeWithAudit(
      ctx,
      "agent.service.saved",
      "Service",
      service.id,
      (tx) =>
        tx.service.update({
          where: { id: service.id },
          data: this.normalizeServiceInput(input)
        })
    );
  }

  async publishService(
    identity: AuthIdentity,
    principalUserId: string,
    serviceId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.SERVICE_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    const service = await this.requireOwnedService(profile.id, serviceId);

    if (profile.status !== ProfessionalProfileStatus.PUBLISHED) {
      throw new BadRequestException(
        "Publish the principal's professional profile before publishing a service"
      );
    }

    const missing: string[] = [];
    if (!service.title) missing.push("title");
    if (!service.category) missing.push("category");
    if (!service.description) missing.push("description");
    if (service.priceMinor === null || service.priceMinor <= 0) missing.push("price");
    if (!service.availabilityNote) missing.push("availability");
    if (!service.deliveryTime) missing.push("deliveryTime");
    if (
      service.deliveryMode !== ServiceDeliveryMode.REMOTE &&
      !service.location
    ) {
      missing.push("location");
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `Complete these fields before publishing: ${missing.join(", ")}`
      );
    }

    return this.writeWithAudit(
      ctx,
      "agent.service.published",
      "Service",
      service.id,
      (tx) =>
        tx.service.update({
          where: { id: service.id },
          data: {
            status: ServiceStatus.PUBLISHED,
            publishedAt: service.publishedAt ?? new Date()
          }
        })
    );
  }

  async pauseService(
    identity: AuthIdentity,
    principalUserId: string,
    serviceId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.SERVICE_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    const service = await this.requireOwnedService(profile.id, serviceId);

    if (service.status === ServiceStatus.PAUSED) return service;
    if (service.status !== ServiceStatus.PUBLISHED) {
      throw new BadRequestException("Only a published service can be paused");
    }

    return this.writeWithAudit(
      ctx,
      "agent.service.paused",
      "Service",
      service.id,
      (tx) =>
        tx.service.update({
          where: { id: service.id },
          data: { status: ServiceStatus.PAUSED }
        })
    );
  }

  async removeService(
    identity: AuthIdentity,
    principalUserId: string,
    serviceId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.SERVICE_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    const service = await this.requireOwnedService(profile.id, serviceId);

    if (service.status === ServiceStatus.PUBLISHED) {
      throw new BadRequestException("Pause a published service before deleting it");
    }

    await this.writeWithAudit(
      ctx,
      "agent.service.deleted",
      "Service",
      service.id,
      async (tx) => {
        await tx.service.delete({ where: { id: service.id } });
        return { deleted: true, id: service.id };
      }
    );
    return { deleted: true, id: service.id };
  }

  async listProducts(identity: AuthIdentity, principalUserId: string) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PRODUCT_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    return this.prisma.product.findMany({
      where: { professionalProfileId: profile.id },
      include: { variants: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" }
    });
  }

  async createProduct(
    identity: AuthIdentity,
    principalUserId: string,
    input: SaveProductInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PRODUCT_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);

    return this.writeWithAudit(
      ctx,
      "agent.product.created",
      "Product",
      null,
      (tx) =>
        tx.product.create({
          data: {
            professionalProfileId: profile.id,
            ...this.normalizeProductInput(input)
          },
          include: { variants: true }
        })
    );
  }

  async saveProduct(
    identity: AuthIdentity,
    principalUserId: string,
    productId: string,
    input: SaveProductInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PRODUCT_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    const product = await this.requireOwnedProduct(profile.id, productId);

    return this.writeWithAudit(
      ctx,
      "agent.product.saved",
      "Product",
      product.id,
      (tx) =>
        tx.product.update({
          where: { id: product.id },
          data: this.normalizeProductInput(input),
          include: { variants: { orderBy: { createdAt: "asc" } } }
        })
    );
  }

  async publishProduct(
    identity: AuthIdentity,
    principalUserId: string,
    productId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PRODUCT_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    const product = await this.requireOwnedProduct(profile.id, productId);

    if (profile.status !== ProfessionalProfileStatus.PUBLISHED) {
      throw new BadRequestException(
        "Publish the principal's professional profile before publishing a product"
      );
    }

    const missing: string[] = [];
    if (!product.title) missing.push("title");
    if (!product.category) missing.push("category");
    if (!product.description) missing.push("description");
    if (product.mediaUrls.length === 0) missing.push("mediaUrls");
    if (product.priceMinor === null) missing.push("price");
    if (
      product.type === ProductType.PHYSICAL &&
      !product.deliveryInformation
    ) {
      missing.push("deliveryInformation");
    }
    if (product.trackInventory && product.inventoryQuantity === null) {
      missing.push("inventoryQuantity");
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `Complete these fields before publishing: ${missing.join(", ")}`
      );
    }

    return this.writeWithAudit(
      ctx,
      "agent.product.published",
      "Product",
      product.id,
      (tx) =>
        tx.product.update({
          where: { id: product.id },
          data: {
            status: ProductStatus.PUBLISHED,
            publishedAt: product.publishedAt ?? new Date()
          },
          include: { variants: { orderBy: { createdAt: "asc" } } }
        })
    );
  }

  async pauseProduct(
    identity: AuthIdentity,
    principalUserId: string,
    productId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PRODUCT_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    const product = await this.requireOwnedProduct(profile.id, productId);

    if (product.status === ProductStatus.PAUSED) return product;
    if (product.status !== ProductStatus.PUBLISHED) {
      throw new BadRequestException("Only a published product can be paused");
    }

    return this.writeWithAudit(
      ctx,
      "agent.product.paused",
      "Product",
      product.id,
      (tx) =>
        tx.product.update({
          where: { id: product.id },
          data: { status: ProductStatus.PAUSED },
          include: { variants: { orderBy: { createdAt: "asc" } } }
        })
    );
  }

  async removeProduct(
    identity: AuthIdentity,
    principalUserId: string,
    productId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.PRODUCT_MANAGE,
      true
    );
    const profile = await this.requirePrincipalProfile(ctx.principalUserId);
    const product = await this.requireOwnedProduct(profile.id, productId);

    if (product.status === ProductStatus.PUBLISHED) {
      throw new BadRequestException("Pause a published product before deleting it");
    }

    return this.writeWithAudit(
      ctx,
      "agent.product.deleted",
      "Product",
      product.id,
      async (tx) => {
        await tx.product.delete({ where: { id: product.id } });
        return { deleted: true, id: product.id };
      }
    );
  }

  async listPosts(identity: AuthIdentity, principalUserId: string) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CONTENT_MANAGE,
      false
    );
    const profile = await this.requireContentProfile(ctx.principalUserId);
    return this.prisma.post.findMany({
      where: { professionalProfileId: profile.id },
      include: this.postInclude(),
      orderBy: { updatedAt: "desc" }
    });
  }

  async createPost(
    identity: AuthIdentity,
    principalUserId: string,
    input: SavePostInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CONTENT_MANAGE,
      false
    );
    const profile = await this.requireContentProfile(ctx.principalUserId);

    return this.writeWithAudit(
      ctx,
      "agent.post.created",
      "Post",
      null,
      async (tx) => {
        const post = await tx.post.create({
          data: {
            professionalProfileId: profile.id,
            ...this.normalizePostInput(input)
          }
        });
        return tx.post.findUniqueOrThrow({
          where: { id: post.id },
          include: this.postInclude()
        });
      }
    );
  }

  async savePost(
    identity: AuthIdentity,
    principalUserId: string,
    postId: string,
    input: SavePostInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CONTENT_MANAGE,
      false
    );
    const profile = await this.requireContentProfile(ctx.principalUserId);
    const post = await this.requireOwnedPost(profile.id, postId);

    return this.writeWithAudit(
      ctx,
      "agent.post.saved",
      "Post",
      post.id,
      async (tx) => {
        await tx.post.update({
          where: { id: post.id },
          data: this.normalizePostInput(input)
        });
        return tx.post.findUniqueOrThrow({
          where: { id: post.id },
          include: this.postInclude()
        });
      }
    );
  }

  async addPostMedia(
    identity: AuthIdentity,
    principalUserId: string,
    postId: string,
    input: AddPostMediaInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CONTENT_MANAGE,
      false
    );
    const profile = await this.requireContentProfile(ctx.principalUserId);
    const post = await this.requireOwnedPost(profile.id, postId);

    if (post.media.length >= 10) {
      throw new BadRequestException("A post can contain at most 10 media items");
    }

    const type = this.requiredMediaType(input.type);
    if (type === PostMediaType.VIDEO && post.media.length > 0) {
      throw new BadRequestException("A video post can contain only one video media item");
    }
    if (
      type === PostMediaType.IMAGE &&
      post.media.some((item) => item.type === PostMediaType.VIDEO)
    ) {
      throw new BadRequestException(
        "Images cannot be mixed with video in the same MVP post"
      );
    }

    const storageKey = this.optionalText(input.storageKey, "storageKey", 1200);
    const mediaUrl = this.optionalUrl(input.mediaUrl, "mediaUrl", 1200);
    if (!storageKey && !mediaUrl) {
      throw new BadRequestException("Provide a storageKey or mediaUrl for post media");
    }

    const nextPosition =
      post.media.length === 0
        ? 0
        : Math.max(...post.media.map((item) => item.position)) + 1;

    return this.writeWithAudit(
      ctx,
      "agent.post.media_added",
      "Post",
      post.id,
      async (tx) => {
        await tx.postMedia.create({
          data: {
            postId: post.id,
            type,
            storageKey: storageKey ?? null,
            mediaUrl: mediaUrl ?? null,
            position:
              this.optionalInteger(input.position, "position", 0, 1000) ??
              nextPosition,
            width:
              this.optionalInteger(input.width, "width", 1, 10000) ?? null,
            height:
              this.optionalInteger(input.height, "height", 1, 10000) ?? null,
            durationMs:
              this.optionalInteger(
                input.durationMs,
                "durationMs",
                0,
                86_400_000
              ) ?? null
          }
        });
        return tx.post.findUniqueOrThrow({
          where: { id: post.id },
          include: this.postInclude()
        });
      }
    );
  }

  async removePostMedia(
    identity: AuthIdentity,
    principalUserId: string,
    postId: string,
    mediaId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CONTENT_MANAGE,
      false
    );
    const profile = await this.requireContentProfile(ctx.principalUserId);
    const post = await this.requireOwnedPost(profile.id, postId);
    const media = await this.prisma.postMedia.findFirst({
      where: { id: this.requiredId(mediaId, "mediaId"), postId: post.id }
    });
    if (!media) throw new NotFoundException("Post media not found");

    return this.writeWithAudit(
      ctx,
      "agent.post.media_removed",
      "Post",
      post.id,
      async (tx) => {
        await tx.postMedia.delete({ where: { id: media.id } });
        return tx.post.findUniqueOrThrow({
          where: { id: post.id },
          include: this.postInclude()
        });
      }
    );
  }

  async publishPost(
    identity: AuthIdentity,
    principalUserId: string,
    postId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CONTENT_MANAGE,
      false
    );
    const profile = await this.requireContentProfile(ctx.principalUserId);
    const post = await this.requireOwnedPost(profile.id, postId);

    const missing: string[] = [];
    if (!post.caption) missing.push("caption");
    if (!post.category) missing.push("category");
    if (post.media.length === 0) missing.push("media");
    if (missing.length > 0) {
      throw new BadRequestException(
        `Complete these fields before publishing: ${missing.join(", ")}`
      );
    }

    const videos = post.media.filter((item) => item.type === PostMediaType.VIDEO);
    const images = post.media.filter((item) => item.type === PostMediaType.IMAGE);
    if ((videos.length === 1 && images.length > 0) || videos.length > 1) {
      throw new BadRequestException(
        "A post must be either one video or one-to-ten images"
      );
    }
    if (post.media.some((item) => !item.mediaUrl)) {
      throw new BadRequestException(
        "Every media item needs a public mediaUrl before publication"
      );
    }

    return this.writeWithAudit(
      ctx,
      "agent.post.published",
      "Post",
      post.id,
      async (tx) => {
        await tx.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.PUBLISHED,
            publishedAt: post.publishedAt ?? new Date()
          }
        });
        return tx.post.findUniqueOrThrow({
          where: { id: post.id },
          include: this.postInclude()
        });
      }
    );
  }

  async archivePost(
    identity: AuthIdentity,
    principalUserId: string,
    postId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CONTENT_MANAGE,
      false
    );
    const profile = await this.requireContentProfile(ctx.principalUserId);
    const post = await this.requireOwnedPost(profile.id, postId);

    if (post.status === PostStatus.ARCHIVED) return post;

    return this.writeWithAudit(
      ctx,
      "agent.post.archived",
      "Post",
      post.id,
      async (tx) => {
        await tx.post.update({
          where: { id: post.id },
          data: { status: PostStatus.ARCHIVED }
        });
        return tx.post.findUniqueOrThrow({
          where: { id: post.id },
          include: this.postInclude()
        });
      }
    );
  }

  private async requireDelegation(
    identity: AuthIdentity,
    principalUserId: string,
    scope: AgentPermissionScope,
    requiresHustler: boolean
  ): Promise<DelegationContext> {
    const actor = await this.requireAgent(identity);
    const principalId = this.requiredId(principalUserId, "principalUserId");

    const relationship = await this.relationships.assertAgentPermission(
      actor.id,
      principalId,
      scope
    );

    if (requiresHustler) {
      const capability = await this.prisma.userCapability.findUnique({
        where: {
          userId_capability: {
            userId: principalId,
            capability: Capability.HUSTLER
          }
        },
        select: { status: true }
      });

      if (capability?.status !== "ACTIVE") {
        throw new ForbiddenException(
          "The represented account needs ACTIVE HUSTLER capability for this delegated action"
        );
      }
    }

    return {
      actorUserId: actor.id,
      principalUserId: principalId,
      relationshipId: relationship.id,
      scope
    };
  }

  private async requireAgent(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        capabilities: {
          where: { capability: Capability.AGENT },
          select: { status: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("Hustle account is not synchronized");
    }
    if (user.capabilities[0]?.status !== "ACTIVE") {
      throw new ForbiddenException("ACTIVE AGENT capability required");
    }
    return user;
  }

  private async requirePrincipalProfile(principalUserId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId: principalUserId }
    });
    if (!profile) {
      throw new BadRequestException(
        "Create the principal's professional profile before managing this surface"
      );
    }
    return profile;
  }

  private async requireContentProfile(principalUserId: string) {
    return this.prisma.professionalProfile.upsert({
      where: { userId: principalUserId },
      update: {},
      create: { userId: principalUserId }
    });
  }

  private async requireOwnedService(profileId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        id: this.requiredId(serviceId, "serviceId"),
        professionalProfileId: profileId
      }
    });
    if (!service) throw new NotFoundException("Service not found");
    return service;
  }

  private async requireOwnedProduct(profileId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: this.requiredId(productId, "productId"),
        professionalProfileId: profileId
      },
      include: { variants: { orderBy: { createdAt: "asc" } } }
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  private async requireOwnedPost(profileId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: this.requiredId(postId, "postId"),
        professionalProfileId: profileId
      },
      include: this.postInclude()
    });
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  private postInclude() {
    return {
      media: {
        orderBy: [
          { position: "asc" as const },
          { createdAt: "asc" as const }
        ]
      },
      serviceAttachments: {
        include: { service: true },
        orderBy: { createdAt: "asc" as const }
      },
      productAttachments: {
        include: {
          product: {
            include: {
              variants: { orderBy: { createdAt: "asc" as const } }
            }
          }
        },
        orderBy: { createdAt: "asc" as const }
      }
    };
  }

  private normalizeProfileInput(input: SaveProfessionalProfileInput) {
    const headline = this.optionalText(input.headline, "headline", 160);
    const coverUrl = this.optionalUrl(input.coverUrl, "coverUrl", 1000);
    const primarySkill = this.optionalText(
      input.primarySkill,
      "primarySkill",
      100
    );
    const secondarySkills = this.optionalSkills(input.secondarySkills);
    const category = this.optionalText(input.category, "category", 100);
    const professionalSummary = this.optionalText(
      input.professionalSummary,
      "professionalSummary",
      1800
    );
    const yearsExperience = this.optionalYearsExperience(input.yearsExperience);

    return {
      ...(headline !== undefined ? { headline } : {}),
      ...(coverUrl !== undefined ? { coverUrl } : {}),
      ...(primarySkill !== undefined ? { primarySkill } : {}),
      ...(secondarySkills !== undefined ? { secondarySkills } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(professionalSummary !== undefined
        ? { professionalSummary }
        : {}),
      ...(yearsExperience !== undefined ? { yearsExperience } : {})
    };
  }

  private normalizeServiceInput(input: SaveServiceInput) {
    const title = this.optionalText(input.title, "title", 120);
    const category = this.optionalText(input.category, "category", 100);
    const description = this.optionalText(
      input.description,
      "description",
      3000
    );
    const mediaUrls = this.optionalUrls(input.mediaUrls, 8, "service");
    const priceMinor = this.optionalMoney(input.priceMinor, "priceMinor");
    const pricingType = this.optionalEnum(
      input.pricingType,
      ServicePricingType,
      "pricingType"
    );
    const deliveryMode = this.optionalEnum(
      input.deliveryMode,
      ServiceDeliveryMode,
      "deliveryMode"
    );
    const location = this.optionalText(input.location, "location", 160);
    const availabilityNote = this.optionalText(
      input.availabilityNote,
      "availabilityNote",
      500
    );
    const deliveryTime = this.optionalText(
      input.deliveryTime,
      "deliveryTime",
      120
    );
    const requirements = this.optionalText(
      input.requirements,
      "requirements",
      1500
    );

    return {
      ...(title !== undefined ? { title } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(mediaUrls !== undefined ? { mediaUrls } : {}),
      ...(priceMinor !== undefined ? { priceMinor } : {}),
      ...(pricingType !== undefined ? { pricingType } : {}),
      ...(deliveryMode !== undefined ? { deliveryMode } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(availabilityNote !== undefined ? { availabilityNote } : {}),
      ...(deliveryTime !== undefined ? { deliveryTime } : {}),
      ...(requirements !== undefined ? { requirements } : {})
    };
  }

  private normalizeProductInput(input: SaveProductInput) {
    const title = this.optionalText(input.title, "title", 160);
    const description = this.optionalText(
      input.description,
      "description",
      5000
    );
    const category = this.optionalText(input.category, "category", 100);
    const mediaUrls = this.optionalUrls(input.mediaUrls, 10, "product");
    const type = this.optionalEnum(input.type, ProductType, "type");
    const priceMinor = this.optionalMoney(input.priceMinor, "priceMinor");
    const trackInventory = this.optionalBoolean(
      input.trackInventory,
      "trackInventory"
    );
    const inventoryQuantity = this.optionalInventoryQuantity(
      input.inventoryQuantity
    );
    const deliveryInformation = this.optionalText(
      input.deliveryInformation,
      "deliveryInformation",
      1500
    );

    return {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(mediaUrls !== undefined ? { mediaUrls } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(priceMinor !== undefined ? { priceMinor } : {}),
      ...(trackInventory !== undefined ? { trackInventory } : {}),
      ...(inventoryQuantity !== undefined ? { inventoryQuantity } : {}),
      ...(deliveryInformation !== undefined
        ? { deliveryInformation }
        : {})
    };
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

  private async writeWithAudit<T>(
    ctx: DelegationContext,
    action: string,
    entityType: string,
    entityId: string | null,
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const result = await operation(tx);
      const resolvedEntityId =
        entityId ??
        (typeof result === "object" &&
        result !== null &&
        "id" in result &&
        typeof (result as { id?: unknown }).id === "string"
          ? (result as { id: string }).id
          : null);

      await tx.agentDelegationAudit.create({
        data: {
          relationshipId: ctx.relationshipId,
          actorUserId: ctx.actorUserId,
          ownerUserId: ctx.principalUserId,
          permissionScope: ctx.scope,
          action,
          entityType,
          entityId: resolvedEntityId
        }
      });

      await tx.systemEvent.create({
        data: {
          name: action,
          source: "api",
          payload: {
            relationshipId: ctx.relationshipId,
            actorUserId: ctx.actorUserId,
            principalUserId: ctx.principalUserId,
            permissionScope: ctx.scope,
            entityType,
            entityId: resolvedEntityId
          }
        }
      });

      return result;
    });
  }

  private optionalText(
    value: unknown,
    field: string,
    maxLength: number
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value !== "string") {
      throw new BadRequestException(`${field} must be text`);
    }
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) {
      throw new BadRequestException(
        `${field} must be at most ${maxLength} characters`
      );
    }
    return normalized;
  }

  private optionalUrl(
    value: unknown,
    field: string,
    maxLength: number
  ): string | null | undefined {
    const normalized = this.optionalText(value, field, maxLength);
    if (!normalized) return normalized;
    try {
      const url = new URL(normalized);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error();
      }
      return url.toString();
    } catch {
      throw new BadRequestException(
        `${field} must be a valid http or https URL`
      );
    }
  }

  private optionalUrls(
    value: unknown,
    maxItems: number,
    noun: string
  ): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      throw new BadRequestException("mediaUrls must be a list");
    }
    if (value.length > maxItems) {
      throw new BadRequestException(
        `A ${noun} can have at most ${maxItems} media items`
      );
    }
    return value.map((item) => {
      if (typeof item !== "string") {
        throw new BadRequestException(
          "mediaUrls must contain text values only"
        );
      }
      const url = this.optionalUrl(item, "mediaUrl", 1200);
      if (!url) {
        throw new BadRequestException("mediaUrls cannot contain empty values");
      }
      return url;
    });
  }

  private optionalSkills(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      throw new BadRequestException("secondarySkills must be a list");
    }
    const normalized = value
      .map((skill) => {
        if (typeof skill !== "string") {
          throw new BadRequestException(
            "secondarySkills must contain text values only"
          );
        }
        const item = skill.trim();
        if (!item) return null;
        if (item.length > 80) {
          throw new BadRequestException(
            "Each secondary skill must be at most 80 characters"
          );
        }
        return item;
      })
      .filter((skill): skill is string => Boolean(skill));

    const unique = Array.from(
      new Map(
        normalized.map((skill) => [skill.toLowerCase(), skill])
      ).values()
    );
    if (unique.length > 12) {
      throw new BadRequestException(
        "A professional profile can have at most 12 secondary skills"
      );
    }
    return unique;
  }

  private optionalTags(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      throw new BadRequestException("tags must be a list");
    }
    if (value.length > 20) {
      throw new BadRequestException("A post can have at most 20 tags");
    }
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") {
        throw new BadRequestException("tags must contain text values only");
      }
      const tag = item.trim();
      if (!tag || tag.length > 60) {
        throw new BadRequestException(
          "Each tag must be between 1 and 60 characters"
        );
      }
      const key = tag.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(tag);
      }
    }
    return normalized;
  }

  private optionalYearsExperience(
    value: unknown
  ): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 80) {
      throw new BadRequestException(
        "yearsExperience must be an integer between 0 and 80"
      );
    }
    return number;
  }

  private optionalMoney(
    value: unknown,
    field: string
  ): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const amount = typeof value === "number" ? value : Number(value);
    if (
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > 2_000_000_000
    ) {
      throw new BadRequestException(
        `${field} must be an integer between 0 and 2000000000`
      );
    }
    return amount;
  }

  private optionalInventoryQuantity(
    value: unknown
  ): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const quantity = typeof value === "number" ? value : Number(value);
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 2_000_000_000
    ) {
      throw new BadRequestException(
        "inventoryQuantity must be an integer between 0 and 2000000000"
      );
    }
    return quantity;
  }

  private optionalBoolean(
    value: unknown,
    field: string
  ): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") {
      throw new BadRequestException(`${field} must be true or false`);
    }
    return value;
  }

  private optionalEnum<T extends Record<string, string>>(
    value: unknown,
    enumObject: T,
    field: string
  ): T[keyof T] | undefined {
    if (value === undefined) return undefined;
    if (
      typeof value !== "string" ||
      !Object.values(enumObject).includes(value)
    ) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return value as T[keyof T];
  }

  private requiredMediaType(value: unknown): PostMediaType {
    if (
      typeof value !== "string" ||
      !Object.values(PostMediaType).includes(value as PostMediaType)
    ) {
      throw new BadRequestException("Invalid post media type");
    }
    return value as PostMediaType;
  }

  private optionalInteger(
    value: unknown,
    field: string,
    min: number,
    max: number
  ): number | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(
        `${field} must be an integer between ${min} and ${max}`
      );
    }
    return parsed;
  }

  private requiredId(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > 200
    ) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import {
  Capability,
  CapabilityStatus,
  PostStatus,
  ProductStatus,
  ProfessionalProfileStatus,
  ServiceStatus
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { PublicTrustService } from "../trust/public-trust.service";

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicTrust: PublicTrustService
  ) {}

  async getPublic(usernameInput: string) {
    const username = usernameInput.trim().replace(/^@/, "");
    if (!username) throw new NotFoundException("Storefront not found");

    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
        professionalProfile: {
          is: { status: ProfessionalProfileStatus.PUBLISHED }
        },
        capabilities: {
          some: {
            capability: Capability.HUSTLER,
            status: CapabilityStatus.ACTIVE
          }
        }
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        bio: true,
        location: true,
        emailVerified: true,
        phoneVerified: true,
        professionalProfile: {
          select: {
            id: true,
            headline: true,
            coverUrl: true,
            primarySkill: true,
            secondarySkills: true,
            category: true,
            professionalSummary: true,
            yearsExperience: true,
            publishedAt: true
          }
        }
      }
    });

    if (!user?.professionalProfile) throw new NotFoundException("Storefront not found");

    const profileId = user.professionalProfile.id;
    const [
      services,
      products,
      posts,
      serviceCount,
      productCount,
      postCount,
      followerCount,
      trust
    ] = await Promise.all([
      this.prisma.service.findMany({
        where: {
          professionalProfileId: profileId,
          status: ServiceStatus.PUBLISHED
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 12,
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          mediaUrls: true,
          priceMinor: true,
          currency: true,
          pricingType: true,
          deliveryMode: true,
          location: true,
          availabilityNote: true,
          deliveryTime: true,
          publishedAt: true
        }
      }),
      this.prisma.product.findMany({
        where: {
          professionalProfileId: profileId,
          status: ProductStatus.PUBLISHED
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 12,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          mediaUrls: true,
          type: true,
          priceMinor: true,
          currency: true,
          trackInventory: true,
          inventoryQuantity: true,
          deliveryInformation: true,
          publishedAt: true,
          variants: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              optionValues: true,
              priceOverrideMinor: true,
              inventoryQuantity: true
            }
          }
        }
      }),
      this.prisma.post.findMany({
        where: {
          professionalProfileId: profileId,
          status: PostStatus.PUBLISHED
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 9,
        select: {
          id: true,
          caption: true,
          category: true,
          location: true,
          tags: true,
          publishedAt: true,
          media: {
            orderBy: { position: "asc" },
            take: 3,
            select: {
              id: true,
              type: true,
              mediaUrl: true,
              position: true,
              width: true,
              height: true,
              durationMs: true
            }
          },
          serviceAttachments: {
            where: { service: { status: ServiceStatus.PUBLISHED } },
            select: {
              service: {
                select: {
                  id: true,
                  title: true,
                  priceMinor: true,
                  currency: true,
                  pricingType: true
                }
              }
            }
          },
          productAttachments: {
            where: { product: { status: ProductStatus.PUBLISHED } },
            select: {
              product: {
                select: {
                  id: true,
                  title: true,
                  priceMinor: true,
                  currency: true
                }
              }
            }
          },
          _count: {
            select: { likes: true, comments: true }
          }
        }
      }),
      this.prisma.service.count({
        where: { professionalProfileId: profileId, status: ServiceStatus.PUBLISHED }
      }),
      this.prisma.product.count({
        where: { professionalProfileId: profileId, status: ProductStatus.PUBLISHED }
      }),
      this.prisma.post.count({
        where: { professionalProfileId: profileId, status: PostStatus.PUBLISHED }
      }),
      this.prisma.userFollow.count({ where: { followingId: user.id } }),
      this.publicTrust.providerSummary(user.id, 8)
    ]);

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        location: user.location,
        verified: user.emailVerified || user.phoneVerified
      },
      profile: user.professionalProfile,
      socialProof: {
        followerCount
      },
      counts: {
        services: serviceCount,
        products: productCount,
        posts: postCount,
        verifiedReviews: trust.reputation.verifiedReviewCount
      },
      services,
      products: products.map((product) => ({
        ...product,
        inStock: this.productInStock(product)
      })),
      posts,
      trust
    };
  }

  private productInStock(product: {
    trackInventory: boolean;
    inventoryQuantity: number | null;
    variants: Array<{ inventoryQuantity: number | null }>;
  }) {
    if (!product.trackInventory) return true;
    const variantInventory = product.variants
      .map((variant) => variant.inventoryQuantity)
      .filter((quantity): quantity is number => typeof quantity === "number");
    if (variantInventory.length > 0) return variantInventory.some((quantity) => quantity > 0);
    return (product.inventoryQuantity ?? 0) > 0;
  }
}

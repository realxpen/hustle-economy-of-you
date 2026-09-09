import { Injectable, NotFoundException } from "@nestjs/common";
import { ProductStatus, ProfessionalProfileStatus } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

@Injectable()
export class PublicProductService {
  constructor(private readonly prisma: PrismaService) {}

  async get(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        status: ProductStatus.PUBLISHED,
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
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" }
        },
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

    if (!product) {
      throw new NotFoundException("Product not found or not currently public");
    }

    const { professionalProfile, ...publicProduct } = product;
    const owner = professionalProfile.user;
    const variantInventory = product.variants
      .map((variant) => variant.inventoryQuantity)
      .filter((quantity): quantity is number => quantity !== null);
    const inStock = !product.trackInventory
      ? true
      : variantInventory.length > 0
        ? variantInventory.some((quantity) => quantity > 0)
        : (product.inventoryQuantity ?? 0) > 0;

    return {
      product: {
        ...publicProduct,
        inStock
      },
      owner: {
        id: owner.id,
        displayName: owner.displayName,
        username: owner.username,
        avatarUrl: owner.avatarUrl,
        bio: owner.bio,
        location: owner.location,
        verified: owner.emailVerified || owner.phoneVerified,
        professionalProfile: {
          id: professionalProfile.id,
          headline: professionalProfile.headline,
          primarySkill: professionalProfile.primarySkill,
          secondarySkills: professionalProfile.secondarySkills,
          category: professionalProfile.category,
          professionalSummary: professionalProfile.professionalSummary,
          yearsExperience: professionalProfile.yearsExperience
        }
      }
    };
  }
}

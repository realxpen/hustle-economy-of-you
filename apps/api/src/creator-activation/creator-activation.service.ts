import { Injectable, NotFoundException } from "@nestjs/common";
import { BookingStatus, PostStatus, ProductStatus, ProfessionalProfileStatus, ServiceStatus } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

/**
 * UX010: private, read-only progress through Hustle's actual content ->
 * discoverable identity -> attached economic opportunity loop.
 *
 * A draft ProfessionalProfile remains a storage anchor for Client-authored
 * posts (ADR-0027); it never grants HUSTLER capability or a public storefront.
 */
@Injectable()
export class CreatorActivationService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(identity: AuthIdentity) {
    const owner = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        username: true,
        displayName: true,
        capabilities: { select: { capability: true, status: true } },
        professionalProfile: {
          select: { id: true, status: true }
        }
      }
    });
    if (!owner) throw new NotFoundException("Hustle account is not synchronized");

    const hustlerActive = owner.capabilities.some(
      capability => capability.capability === "HUSTLER" && capability.status === "ACTIVE"
    );
    const profile = owner.professionalProfile;

    // Do not create a professional profile or any content by reading this page.
    const [posts, publishedServices, publishedProducts, completedBookings] = await Promise.all([
      profile
        ? this.prisma.post.findMany({
            where: { professionalProfileId: profile.id },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            select: {
              id: true, status: true, caption: true, publishedAt: true,
              media: { select: { id: true } },
              serviceAttachments: {
                where: { service: { status: ServiceStatus.PUBLISHED } },
                select: { serviceId: true }
              },
              productAttachments: {
                where: { product: { status: ProductStatus.PUBLISHED } },
                select: { productId: true }
              }
            }
          })
        : Promise.resolve([]),
      profile && hustlerActive
        ? this.prisma.service.count({
            where: { professionalProfileId: profile.id, status: ServiceStatus.PUBLISHED }
          })
        : Promise.resolve(0),
      profile && hustlerActive
        ? this.prisma.product.count({
            where: { professionalProfileId: profile.id, status: ProductStatus.PUBLISHED }
          })
        : Promise.resolve(0),
      hustlerActive
        ? this.prisma.booking.count({
            where: { hustlerUserId: owner.id, status: BookingStatus.COMPLETED }
          })
        : Promise.resolve(0)
    ]);

    const published = posts.filter(post => post.status === PostStatus.PUBLISHED);
    const linkedPublishedPosts = published.filter(
      post => post.serviceAttachments.length > 0 || post.productAttachments.length > 0
    );
    return {
      identity: {
        displayName: owner.displayName,
        username: owner.username,
        hustlerActive,
        professionalProfilePublished: hustlerActive &&
          profile?.status === ProfessionalProfileStatus.PUBLISHED
      },
      counts: {
        posts: posts.length,
        publishedPosts: published.length,
        drafts: posts.filter(post => post.status === PostStatus.DRAFT).length,
        linkedPublishedPosts: linkedPublishedPosts.length,
        publishedServices,
        publishedProducts,
        completedBookings
      },
      // Only return posts owned by the requester. Full media URLs and unrelated
      // buyer/seller private records are never included in this projection.
      recentPosts: posts.slice(0, 6).map(post => ({
        id: post.id,
        status: post.status,
        caption: post.caption?.slice(0, 150) ?? null,
        publishedAt: post.publishedAt,
        mediaCount: post.media.length,
        publishedOfferReferences:
          post.serviceAttachments.length + post.productAttachments.length
      })),
      readOnly: true as const
    };
  }
}

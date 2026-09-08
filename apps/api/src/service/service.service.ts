import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ProfessionalProfileStatus,
  ServiceDeliveryMode,
  ServicePricingType,
  ServiceStatus
} from "@prisma/client";

import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";

export interface SaveServiceInput {
  title?: unknown;
  category?: unknown;
  description?: unknown;
  mediaUrls?: unknown;
  priceMinor?: unknown;
  pricingType?: unknown;
  deliveryMode?: unknown;
  location?: unknown;
  availabilityNote?: unknown;
  deliveryTime?: unknown;
  requirements?: unknown;
}

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(identity: AuthIdentity) {
    const profile = await this.requireOwnerProfile(identity);
    return this.prisma.service.findMany({
      where: { professionalProfileId: profile.id },
      orderBy: { updatedAt: "desc" }
    });
  }

  async create(identity: AuthIdentity, input: SaveServiceInput) {
    const profile = await this.requireOwnerProfile(identity);
    const data = this.normalizeInput(input);

    const service = await this.prisma.service.create({
      data: {
        professionalProfileId: profile.id,
        ...data
      }
    });

    await this.prisma.systemEvent.create({
      data: {
        name: "service.created",
        source: "api",
        payload: {
          serviceId: service.id,
          professionalProfileId: profile.id,
          userId: profile.userId
        }
      }
    });

    return service;
  }

  async getMine(identity: AuthIdentity, serviceId: string) {
    const profile = await this.requireOwnerProfile(identity);
    return this.requireOwnedService(profile.id, serviceId);
  }

  async save(identity: AuthIdentity, serviceId: string, input: SaveServiceInput) {
    const profile = await this.requireOwnerProfile(identity);
    await this.requireOwnedService(profile.id, serviceId);

    return this.prisma.service.update({
      where: { id: serviceId },
      data: this.normalizeInput(input)
    });
  }

  async publish(identity: AuthIdentity, serviceId: string) {
    const profile = await this.requireOwnerProfile(identity);
    const service = await this.requireOwnedService(profile.id, serviceId);

    if (profile.status !== ProfessionalProfileStatus.PUBLISHED) {
      throw new BadRequestException(
        "Publish your professional profile before publishing a service"
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

    const publishedAt = service.publishedAt ?? new Date();

    await this.prisma.$transaction([
      this.prisma.service.update({
        where: { id: service.id },
        data: {
          status: ServiceStatus.PUBLISHED,
          publishedAt
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "service.published",
          source: "api",
          payload: {
            serviceId: service.id,
            professionalProfileId: profile.id,
            userId: profile.userId
          }
        }
      })
    ]);

    return this.requireOwnedService(profile.id, service.id);
  }

  async pause(identity: AuthIdentity, serviceId: string) {
    const profile = await this.requireOwnerProfile(identity);
    const service = await this.requireOwnedService(profile.id, serviceId);

    if (service.status === ServiceStatus.PAUSED) return service;
    if (service.status !== ServiceStatus.PUBLISHED) {
      throw new BadRequestException("Only a published service can be paused");
    }

    await this.prisma.$transaction([
      this.prisma.service.update({
        where: { id: service.id },
        data: { status: ServiceStatus.PAUSED }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "service.paused",
          source: "api",
          payload: {
            serviceId: service.id,
            professionalProfileId: profile.id,
            userId: profile.userId
          }
        }
      })
    ]);

    return this.requireOwnedService(profile.id, service.id);
  }

  async remove(identity: AuthIdentity, serviceId: string) {
    const profile = await this.requireOwnerProfile(identity);
    const service = await this.requireOwnedService(profile.id, serviceId);

    if (service.status === ServiceStatus.PUBLISHED) {
      throw new BadRequestException("Pause a published service before deleting it");
    }

    await this.prisma.$transaction([
      this.prisma.service.delete({ where: { id: service.id } }),
      this.prisma.systemEvent.create({
        data: {
          name: "service.deleted",
          source: "api",
          payload: {
            serviceId: service.id,
            professionalProfileId: profile.id,
            userId: profile.userId
          }
        }
      })
    ]);

    return { deleted: true, id: service.id };
  }

  async getPublic(serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        status: ServiceStatus.PUBLISHED,
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

    if (!service) {
      throw new NotFoundException("Service not found or not currently public");
    }

    const { professionalProfile, ...publicService } = service;
    const owner = professionalProfile.user;

    return {
      service: publicService,
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

  private async requireOwnerProfile(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        capabilities: {
          where: { capability: "HUSTLER" },
          select: { status: true }
        },
        professionalProfile: true
      }
    });

    if (!user) {
      throw new NotFoundException("Hustle account is not synchronized");
    }

    if (user.capabilities[0]?.status !== "ACTIVE") {
      throw new BadRequestException("An ACTIVE HUSTLER capability is required");
    }

    if (!user.professionalProfile) {
      throw new BadRequestException(
        "Create your professional profile before creating services"
      );
    }

    return user.professionalProfile;
  }

  private async requireOwnedService(profileId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        professionalProfileId: profileId
      }
    });

    if (!service) {
      throw new NotFoundException("Service not found");
    }

    return service;
  }

  private normalizeInput(input: SaveServiceInput) {
    const title = this.optionalText(input.title, "title", 120);
    const category = this.optionalText(input.category, "category", 100);
    const description = this.optionalText(input.description, "description", 3000);
    const mediaUrls = this.optionalUrls(input.mediaUrls);
    const priceMinor = this.optionalPriceMinor(input.priceMinor);
    const pricingType = this.optionalPricingType(input.pricingType);
    const deliveryMode = this.optionalDeliveryMode(input.deliveryMode);
    const location = this.optionalText(input.location, "location", 160);
    const availabilityNote = this.optionalText(
      input.availabilityNote,
      "availabilityNote",
      500
    );
    const deliveryTime = this.optionalText(input.deliveryTime, "deliveryTime", 120);
    const requirements = this.optionalText(input.requirements, "requirements", 1500);

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
      throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    }
    return normalized;
  }

  private optionalUrls(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      throw new BadRequestException("mediaUrls must be a list");
    }

    if (value.length > 8) {
      throw new BadRequestException("A service can have at most 8 media items");
    }

    return value.map((item) => {
      if (typeof item !== "string") {
        throw new BadRequestException("mediaUrls must contain text values only");
      }
      const normalized = item.trim();
      if (!normalized) {
        throw new BadRequestException("mediaUrls cannot contain empty values");
      }
      if (normalized.length > 1200) {
        throw new BadRequestException("Each media URL must be at most 1200 characters");
      }
      try {
        const url = new URL(normalized);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
        return url.toString();
      } catch {
        throw new BadRequestException("Each media item must be a valid http or https URL");
      }
    });
  }

  private optionalPriceMinor(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(amount) || amount < 0 || amount > 2_000_000_000) {
      throw new BadRequestException(
        "priceMinor must be an integer between 0 and 2000000000"
      );
    }
    return amount;
  }

  private optionalPricingType(value: unknown): ServicePricingType | undefined {
    if (value === undefined) return undefined;
    if (!Object.values(ServicePricingType).includes(value as ServicePricingType)) {
      throw new BadRequestException("Invalid service pricing type");
    }
    return value as ServicePricingType;
  }

  private optionalDeliveryMode(value: unknown): ServiceDeliveryMode | undefined {
    if (value === undefined) return undefined;
    if (!Object.values(ServiceDeliveryMode).includes(value as ServiceDeliveryMode)) {
      throw new BadRequestException("Invalid service delivery mode");
    }
    return value as ServiceDeliveryMode;
  }
}

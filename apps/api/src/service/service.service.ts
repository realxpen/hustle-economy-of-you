import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Prisma,
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
  bookingMode?: unknown;
  consultationPolicy?: unknown;
  consultationFeeMinor?: unknown;
  consultationCreditEnabled?: unknown;
  maxPartySize?: unknown;
  bookingTimezone?: unknown;
  resourcePoolKey?: unknown;
  defaultDurationMinutes?: unknown;
  prepMinutes?: unknown;
  bufferMinutes?: unknown;
  parallelCapacity?: unknown;
  overbookingAllowance?: unknown;
  weeklyHours?: unknown;
  blackoutDates?: unknown;
  maxActiveJobs?: unknown;
  turnaroundHours?: unknown;
  autoExtensionMinutes?: unknown;
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

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.service.updateMany({
        where: {
          id: service.id,
          professionalProfileId: profile.id,
          moderationState: "CLEAR"
        },
        data: { status: ServiceStatus.PUBLISHED, publishedAt }
      });
      if (changed.count !== 1) {
        throw new ConflictException("This service is under moderation hold or no longer belongs to your profile");
      }
      await tx.systemEvent.create({
        data: {
          name: "service.published",
          source: "api",
          payload: {
            serviceId: service.id,
            professionalProfileId: profile.id,
            userId: profile.userId
          }
        }
      });
    });

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

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.service.deleteMany({
        where: {
          id: service.id,
          professionalProfileId: profile.id,
          moderationState: "CLEAR"
        }
      });
      if (deleted.count !== 1) {
        throw new ConflictException("Moderation-held listings cannot be deleted");
      }
      await tx.systemEvent.create({
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

    });

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

    const mode = input.bookingMode === undefined ? undefined : input.bookingMode;
    if (mode !== undefined && !["APPOINTMENT", "WORK_QUEUE", "CONSULTATION"].includes(String(mode))) {
      throw new BadRequestException("Invalid FlowTime booking mode");
    }
    const timezone = input.bookingTimezone === undefined ? undefined : this.optionalText(input.bookingTimezone, "bookingTimezone", 64);
    if (timezone !== undefined) {
      if (!timezone) throw new BadRequestException("FlowTime timezone is required");
      try { new Intl.DateTimeFormat("en", { timeZone: timezone }); }
      catch { throw new BadRequestException("Unknown FlowTime timezone"); }
    }
    const pool = input.resourcePoolKey === undefined ? undefined : this.optionalText(input.resourcePoolKey, "resourcePoolKey", 40);
    if (pool !== undefined && (!pool || !/^[a-zA-Z0-9_-]{2,40}$/.test(pool))) {
      throw new BadRequestException("Resource pool must be 2–40 letters, digits, _ or -");
    }
    const number = (value: unknown, label: string, min: number, max: number) => {
      if (value === undefined) return undefined;
      if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
        throw new BadRequestException(`${label} must be an integer from ${min} to ${max}`);
      }
      return value;
    };
    const policy = input.consultationPolicy;
    if (policy !== undefined && !["OFF","OPTIONAL","REQUIRED"].includes(String(policy))) {
      throw new BadRequestException("consultationPolicy must be OFF, OPTIONAL or REQUIRED");
    }
    if (input.consultationCreditEnabled !== undefined && typeof input.consultationCreditEnabled !== "boolean") {
      throw new BadRequestException("consultationCreditEnabled must be boolean");
    }
    if (policy === "OFF" && ((input.consultationFeeMinor !== undefined && input.consultationFeeMinor !== 0) ||
      input.consultationCreditEnabled === true)) {
      throw new BadRequestException("Disabled consultation cannot have a fee or credit");
    }
    const numeric = {
      consultationFeeMinor: number(input.consultationFeeMinor, "Consultation fee", 0, 2_000_000_000),
      maxPartySize: number(input.maxPartySize, "Maximum party size", 1, 50),
      defaultDurationMinutes: number(input.defaultDurationMinutes, "Default duration", 5, 1440),
      prepMinutes: number(input.prepMinutes, "Preparation", 0, 120),
      bufferMinutes: number(input.bufferMinutes, "Recovery buffer", 0, 180),
      parallelCapacity: number(input.parallelCapacity, "Parallel capacity", 1, 100),
      overbookingAllowance: number(input.overbookingAllowance, "Overbooking allowance", 0, 10),
      maxActiveJobs: number(input.maxActiveJobs, "Maximum active jobs", 1, 10000),
      turnaroundHours: number(input.turnaroundHours, "Turnaround", 1, 8760),
      autoExtensionMinutes: number(input.autoExtensionMinutes, "Auto-extension limit", 0, 120)
    };
    let hours: { day: number; start: string; end: string }[] | null | undefined;
    if (input.weeklyHours !== undefined) {
      if (input.weeklyHours !== null && !Array.isArray(input.weeklyHours)) {
        throw new BadRequestException("Weekly hours must be a list or null");
      }
      hours = input.weeklyHours === null ? null : (input.weeklyHours as unknown[]).map((raw) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Invalid weekly opening window");
        const item = raw as Record<string, unknown>;
        const clock = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
        if (typeof item.day !== "number" || !Number.isInteger(item.day) || item.day < 0 || item.day > 6 ||
            !clock(item.start) || !clock(item.end) || String(item.end) <= String(item.start)) {
          throw new BadRequestException("Weekly hours need a weekday and increasing 24-hour start/end");
        }
        return { day: Number(item.day), start: String(item.start), end: String(item.end) };
      });
      if (hours && hours.length > 21) throw new BadRequestException("Too many weekly windows");
      if (hours) {
        for (const item of hours) for (const other of hours) {
          if (item !== other && item.day === other.day && item.start < other.end && other.start < item.end)
            throw new BadRequestException("Weekly opening windows must not overlap");
        }
      }
    }
    let blackoutDates: string[] | undefined;
    if (input.blackoutDates !== undefined) {
      if (!Array.isArray(input.blackoutDates) || input.blackoutDates.length > 365 ||
          input.blackoutDates.some((d) => typeof d !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
            Number.isNaN(new Date(d + "T00:00:00Z").getTime()) ||
            new Date(d + "T00:00:00Z").toISOString().slice(0, 10) !== d)) {
        throw new BadRequestException("Blackout dates must be valid ISO calendar dates");
      }
      blackoutDates = [...new Set(input.blackoutDates as string[])];
    }

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
      ...(requirements !== undefined ? { requirements } : {}),
      ...(mode !== undefined ? { bookingMode: mode as "APPOINTMENT" | "WORK_QUEUE" | "CONSULTATION" } : {}),
      ...(policy !== undefined ? { consultationPolicy: policy as "OFF" | "OPTIONAL" | "REQUIRED" } : {}),
      ...(input.consultationCreditEnabled !== undefined ? { consultationCreditEnabled: input.consultationCreditEnabled } : {}),
      ...(timezone !== undefined ? { bookingTimezone: timezone } : {}),
      ...(pool !== undefined ? { resourcePoolKey: pool } : {}),
      ...Object.fromEntries(Object.entries(numeric).filter(([, value]) => value !== undefined)),
      ...(hours !== undefined ? { weeklyHours: hours === null ? Prisma.DbNull : hours } : {}),
      ...(blackoutDates !== undefined ? { blackoutDates } : {})
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

import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ProfessionalProfileStatus } from "@prisma/client";

import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";

export interface SaveProfessionalProfileInput {
  headline?: unknown;
  coverUrl?: unknown;
  primarySkill?: unknown;
  secondarySkills?: unknown;
  category?: unknown;
  professionalSummary?: unknown;
  yearsExperience?: unknown;
}

@Injectable()
export class ProfessionalProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(identity: AuthIdentity) {
    const user = await this.requireHustlerUser(identity);

    const existing = await this.prisma.professionalProfile.findUnique({
      where: { userId: user.id }
    });

    if (existing) return existing;

    const application = await this.prisma.hustlerApplication.findUnique({
      where: { userId: user.id },
      select: {
        status: true,
        primarySkill: true,
        category: true,
        experienceSummary: true,
        yearsExperience: true
      }
    });

    return this.prisma.professionalProfile.create({
      data: {
        userId: user.id,
        primarySkill: application?.status === "APPROVED" ? application.primarySkill : null,
        category: application?.status === "APPROVED" ? application.category : null,
        professionalSummary:
          application?.status === "APPROVED" ? application.experienceSummary : null,
        yearsExperience:
          application?.status === "APPROVED" ? application.yearsExperience : null
      }
    });
  }

  async save(identity: AuthIdentity, input: SaveProfessionalProfileInput) {
    const user = await this.requireHustlerUser(identity);
    await this.ensureProfile(identity);

    const headline = this.optionalText(input.headline, "headline", 160);
    const coverUrl = this.optionalUrl(input.coverUrl, "coverUrl", 1000);
    const primarySkill = this.optionalText(input.primarySkill, "primarySkill", 100);
    const secondarySkills = this.optionalSkills(input.secondarySkills);
    const category = this.optionalText(input.category, "category", 100);
    const professionalSummary = this.optionalText(
      input.professionalSummary,
      "professionalSummary",
      1800
    );
    const yearsExperience = this.optionalYearsExperience(input.yearsExperience);

    return this.prisma.professionalProfile.update({
      where: { userId: user.id },
      data: {
        ...(headline !== undefined ? { headline } : {}),
        ...(coverUrl !== undefined ? { coverUrl } : {}),
        ...(primarySkill !== undefined ? { primarySkill } : {}),
        ...(secondarySkills !== undefined ? { secondarySkills } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(professionalSummary !== undefined ? { professionalSummary } : {}),
        ...(yearsExperience !== undefined ? { yearsExperience } : {})
      }
    });
  }

  async publish(identity: AuthIdentity) {
    const user = await this.requireHustlerUser(identity);
    const profile = await this.ensureProfile(identity);

    const missing: string[] = [];
    if (!user.username) missing.push("username");
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

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.professionalProfile.update({
        where: { userId: user.id },
        data: {
          status: ProfessionalProfileStatus.PUBLISHED,
          publishedAt: now
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "professional_profile.published",
          source: "api",
          payload: {
            userId: user.id,
            username: user.username
          }
        }
      })
    ]);

    return this.prisma.professionalProfile.findUniqueOrThrow({
      where: { userId: user.id }
    });
  }

  async unpublish(identity: AuthIdentity) {
    const user = await this.requireHustlerUser(identity);
    await this.ensureProfile(identity);

    await this.prisma.$transaction([
      this.prisma.professionalProfile.update({
        where: { userId: user.id },
        data: {
          status: ProfessionalProfileStatus.DRAFT,
          publishedAt: null
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "professional_profile.unpublished",
          source: "api",
          payload: { userId: user.id }
        }
      })
    ]);

    return this.prisma.professionalProfile.findUniqueOrThrow({
      where: { userId: user.id }
    });
  }

  async getPublic(username: string) {
    const normalized = username.trim().replace(/^@/, "");
    if (!normalized) throw new NotFoundException("Professional profile not found");

    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: normalized, mode: "insensitive" },
        professionalProfile: {
          is: { status: ProfessionalProfileStatus.PUBLISHED }
        },
        capabilities: {
          some: { capability: "HUSTLER", status: "ACTIVE" }
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
        capabilities: {
          where: { status: "ACTIVE" },
          select: {
            capability: true,
            status: true,
            enabledAt: true
          },
          orderBy: { enabledAt: "asc" }
        },
        professionalProfile: true
      }
    });

    if (!user?.professionalProfile) {
      throw new NotFoundException("Professional profile not found");
    }

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        location: user.location,
        verified: user.emailVerified || user.phoneVerified,
        capabilities: user.capabilities
      },
      profile: user.professionalProfile
    };
  }

  private async ensureProfile(identity: AuthIdentity) {
    const user = await this.requireHustlerUser(identity);
    const existing = await this.prisma.professionalProfile.findUnique({
      where: { userId: user.id }
    });
    if (existing) return existing;
    return this.getMine(identity);
  }

  private async requireHustlerUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        username: true,
        capabilities: {
          where: { capability: "HUSTLER" },
          select: { status: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("Hustle account is not synchronized");
    }

    if (user.capabilities[0]?.status !== "ACTIVE") {
      throw new BadRequestException("An ACTIVE HUSTLER capability is required");
    }

    return user;
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

  private optionalUrl(
    value: unknown,
    field: string,
    maxLength: number
  ): string | null | undefined {
    const normalized = this.optionalText(value, field, maxLength);
    if (!normalized) return normalized;

    try {
      const url = new URL(normalized);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      return url.toString();
    } catch {
      throw new BadRequestException(`${field} must be a valid http or https URL`);
    }
  }

  private optionalSkills(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      throw new BadRequestException("secondarySkills must be a list");
    }

    const normalized = value.map((skill) => {
      if (typeof skill !== "string") {
        throw new BadRequestException("secondarySkills must contain text values only");
      }
      const item = skill.trim();
      if (!item) return null;
      if (item.length > 80) {
        throw new BadRequestException("Each secondary skill must be at most 80 characters");
      }
      return item;
    }).filter((skill): skill is string => Boolean(skill));

    const unique = Array.from(new Map(normalized.map((skill) => [skill.toLowerCase(), skill])).values());
    if (unique.length > 12) {
      throw new BadRequestException("A professional profile can have at most 12 secondary skills");
    }
    return unique;
  }

  private optionalYearsExperience(value: unknown): number | null | undefined {
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
}

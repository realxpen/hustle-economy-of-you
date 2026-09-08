import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";

import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";

export interface SaveHustlerApplicationInput {
  primarySkill?: unknown;
  category?: unknown;
  experienceSummary?: unknown;
  yearsExperience?: unknown;
  businessName?: unknown;
  businessInfo?: unknown;
}

@Injectable()
export class HustlerApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(identity: AuthIdentity) {
    const user = await this.requireUser(identity);

    return this.prisma.hustlerApplication.findUnique({
      where: { userId: user.id },
      include: {
        proofs: {
          orderBy: { createdAt: "asc" }
        }
      }
    });
  }

  async saveDraft(
    identity: AuthIdentity,
    input: SaveHustlerApplicationInput
  ) {
    const user = await this.requireUser(identity);

    const existing = await this.prisma.hustlerApplication.findUnique({
      where: { userId: user.id }
    });

    if (existing && existing.status !== "DRAFT") {
      throw new BadRequestException(
        `Applications in ${existing.status} state cannot be edited`
      );
    }

    const primarySkill = this.optionalText(
      input.primarySkill,
      "primarySkill",
      100
    );

    const category = this.optionalText(
      input.category,
      "category",
      100
    );

    const experienceSummary = this.optionalText(
      input.experienceSummary,
      "experienceSummary",
      1200
    );

    const yearsExperience = this.optionalYearsExperience(
      input.yearsExperience
    );

    const businessName = this.optionalText(
      input.businessName,
      "businessName",
      120
    );

    const businessInfo = this.optionalText(
      input.businessInfo,
      "businessInfo",
      800
    );

    await this.prisma.hustlerApplication.upsert({
      where: { userId: user.id },

      create: {
        userId: user.id,
        ...(primarySkill !== undefined ? { primarySkill } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(experienceSummary !== undefined
          ? { experienceSummary }
          : {}),
        ...(yearsExperience !== undefined
          ? { yearsExperience }
          : {}),
        ...(businessName !== undefined ? { businessName } : {}),
        ...(businessInfo !== undefined ? { businessInfo } : {})
      },

      update: {
        ...(primarySkill !== undefined ? { primarySkill } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(experienceSummary !== undefined
          ? { experienceSummary }
          : {}),
        ...(yearsExperience !== undefined
          ? { yearsExperience }
          : {}),
        ...(businessName !== undefined ? { businessName } : {}),
        ...(businessInfo !== undefined ? { businessInfo } : {})
      }
    });

    return this.getMine(identity);
  }

  async submit(identity: AuthIdentity) {
    const user = await this.requireUser(identity);

    const application =
      await this.prisma.hustlerApplication.findUnique({
        where: { userId: user.id },
        include: {
          proofs: true
        }
      });

    if (!application) {
      throw new NotFoundException(
        "Create your Hustler application before submitting it"
      );
    }

    if (application.status !== "DRAFT") {
      throw new BadRequestException(
        `Application is already ${application.status}`
      );
    }

    const missing: string[] = [];

    if (!application.primarySkill) {
      missing.push("primarySkill");
    }

    if (!application.category) {
      missing.push("category");
    }

    if (!application.experienceSummary) {
      missing.push("experienceSummary");
    }

    if (application.yearsExperience === null) {
      missing.push("yearsExperience");
    }

    if (application.proofs.length === 0) {
      missing.push("proof");
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Complete these fields before submitting: ${missing.join(", ")}`
      );
    }

    await this.prisma.hustlerApplication.update({
      where: { id: application.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date()
      }
    });

    return this.getMine(identity);
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: {
        authSubject: identity.subject
      },
      select: {
        id: true
      }
    });

    if (!user) {
      throw new NotFoundException(
        "Hustle account is not synchronized"
      );
    }

    return user;
  }

  private optionalText(
    value: unknown,
    field: string,
    maxLength: number
  ): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException(`${field} must be text`);
    }

    const normalized = value.trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(
        `${field} must be at most ${maxLength} characters`
      );
    }

    return normalized;
  }

  private optionalYearsExperience(
    value: unknown
  ): number | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    const number =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;

    if (
      !Number.isInteger(number) ||
      number < 0 ||
      number > 80
    ) {
      throw new BadRequestException(
        "yearsExperience must be an integer between 0 and 80"
      );
    }

    return number;
  }
}

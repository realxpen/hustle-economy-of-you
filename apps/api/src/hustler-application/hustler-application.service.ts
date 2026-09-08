import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { HustlerProofType, Prisma } from "@prisma/client";

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

export interface AddHustlerProofInput {
  type?: unknown;
  storageKey?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
}

const allowedProofMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const maxProofBytes = 10 * 1024 * 1024;

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

    const primarySkill = this.optionalText(input.primarySkill, "primarySkill", 100);
    const category = this.optionalText(input.category, "category", 100);
    const experienceSummary = this.optionalText(
      input.experienceSummary,
      "experienceSummary",
      1200
    );
    const yearsExperience = this.optionalYearsExperience(input.yearsExperience);
    const businessName = this.optionalText(input.businessName, "businessName", 120);
    const businessInfo = this.optionalText(input.businessInfo, "businessInfo", 800);

    await this.prisma.hustlerApplication.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...(primarySkill !== undefined ? { primarySkill } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(experienceSummary !== undefined ? { experienceSummary } : {}),
        ...(yearsExperience !== undefined ? { yearsExperience } : {}),
        ...(businessName !== undefined ? { businessName } : {}),
        ...(businessInfo !== undefined ? { businessInfo } : {})
      },
      update: {
        ...(primarySkill !== undefined ? { primarySkill } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(experienceSummary !== undefined ? { experienceSummary } : {}),
        ...(yearsExperience !== undefined ? { yearsExperience } : {}),
        ...(businessName !== undefined ? { businessName } : {}),
        ...(businessInfo !== undefined ? { businessInfo } : {})
      }
    });

    return this.getMine(identity);
  }

  async addProof(identity: AuthIdentity, input: AddHustlerProofInput) {
    const user = await this.requireUser(identity);
    const application = await this.prisma.hustlerApplication.findUnique({
      where: { userId: user.id }
    });

    if (!application) {
      throw new NotFoundException("Save your Hustler application before attaching proof");
    }

    if (application.status !== "DRAFT") {
      throw new BadRequestException(
        `Applications in ${application.status} state cannot accept new proof`
      );
    }

    const type = this.requiredProofType(input.type);
    const storageKey = this.requiredText(input.storageKey, "storageKey", 500);
    const fileName = this.requiredText(input.fileName, "fileName", 180);
    const mimeType = this.requiredText(input.mimeType, "mimeType", 100).toLowerCase();
    const sizeBytes = this.requiredFileSize(input.sizeBytes);

    if (!storageKey.startsWith(`${identity.subject}/`)) {
      throw new BadRequestException("Proof storage path does not belong to this identity");
    }

    if (!allowedProofMimeTypes.has(mimeType)) {
      throw new BadRequestException("Proof must be a PDF, JPEG, PNG or WebP file");
    }

    try {
      await this.prisma.hustlerApplicationProof.create({
        data: {
          applicationId: application.id,
          type,
          storageKey,
          fileName,
          mimeType,
          sizeBytes
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("That proof file is already attached");
      }
      throw error;
    }

    return this.getMine(identity);
  }

  async removeProof(identity: AuthIdentity, proofId: string) {
    const user = await this.requireUser(identity);
    const proof = await this.prisma.hustlerApplicationProof.findUnique({
      where: { id: proofId },
      include: {
        application: {
          select: {
            userId: true,
            status: true
          }
        }
      }
    });

    if (!proof || proof.application.userId !== user.id) {
      throw new NotFoundException("Proof item not found");
    }

    if (proof.application.status !== "DRAFT") {
      throw new BadRequestException(
        `Proof cannot be removed while the application is ${proof.application.status}`
      );
    }

    await this.prisma.hustlerApplicationProof.delete({
      where: { id: proof.id }
    });

    return this.getMine(identity);
  }

  async submit(identity: AuthIdentity) {
    const user = await this.requireUser(identity);

    const application = await this.prisma.hustlerApplication.findUnique({
      where: { userId: user.id },
      include: { proofs: true }
    });

    if (!application) {
      throw new NotFoundException(
        "Create your Hustler application before submitting it"
      );
    }

    if (application.status !== "DRAFT") {
      throw new BadRequestException(`Application is already ${application.status}`);
    }

    const missing: string[] = [];
    if (!application.primarySkill) missing.push("primarySkill");
    if (!application.category) missing.push("category");
    if (!application.experienceSummary) missing.push("experienceSummary");
    if (application.yearsExperience === null) missing.push("yearsExperience");
    if (application.proofs.length === 0) missing.push("proof");

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
      where: { authSubject: identity.subject },
      select: { id: true }
    });

    if (!user) {
      throw new NotFoundException("Hustle account is not synchronized");
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

  private requiredText(value: unknown, field: string, maxLength: number): string {
    const normalized = this.optionalText(value, field, maxLength);
    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }
    return normalized;
  }

  private optionalYearsExperience(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;

    const number =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;

    if (!Number.isInteger(number) || number < 0 || number > 80) {
      throw new BadRequestException(
        "yearsExperience must be an integer between 0 and 80"
      );
    }

    return number;
  }

  private requiredProofType(value: unknown): HustlerProofType {
    if (
      typeof value !== "string" ||
      !Object.values(HustlerProofType).includes(value as HustlerProofType)
    ) {
      throw new BadRequestException("Invalid proof type");
    }
    return value as HustlerProofType;
  }

  private requiredFileSize(value: unknown): number {
    const size = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(size) || size <= 0 || size > maxProofBytes) {
      throw new BadRequestException("Proof file must be no larger than 10 MB");
    }
    return size;
  }
}

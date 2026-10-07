import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AgentProofType, Prisma } from "@prisma/client";

import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";

export interface SaveAgentApplicationInput {
  motivation?: unknown;
  experienceSummary?: unknown;
  operatingArea?: unknown;
  organizationName?: unknown;
  organizationInfo?: unknown;
}

export interface AddAgentProofInput {
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
export class AgentApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(identity: AuthIdentity) {
    const user = await this.requireUser(identity);

    return this.prisma.agentApplication.findUnique({
      where: { userId: user.id },
      include: {
        proofs: {
          orderBy: { createdAt: "asc" }
        }
      }
    });
  }

  async saveDraft(identity: AuthIdentity, input: SaveAgentApplicationInput) {
    const user = await this.requireUser(identity);
    await this.assertAgentNotActive(user.id);

    const existing = await this.prisma.agentApplication.findUnique({
      where: { userId: user.id }
    });

    if (existing && existing.status !== "DRAFT") {
      throw new BadRequestException(
        `Applications in ${existing.status} state cannot be edited`
      );
    }

    const motivation = this.optionalText(input.motivation, "motivation", 1200);
    const experienceSummary = this.optionalText(
      input.experienceSummary,
      "experienceSummary",
      1200
    );
    const operatingArea = this.optionalText(input.operatingArea, "operatingArea", 160);
    const organizationName = this.optionalText(
      input.organizationName,
      "organizationName",
      160
    );
    const organizationInfo = this.optionalText(
      input.organizationInfo,
      "organizationInfo",
      800
    );

    await this.prisma.agentApplication.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...(motivation !== undefined ? { motivation } : {}),
        ...(experienceSummary !== undefined ? { experienceSummary } : {}),
        ...(operatingArea !== undefined ? { operatingArea } : {}),
        ...(organizationName !== undefined ? { organizationName } : {}),
        ...(organizationInfo !== undefined ? { organizationInfo } : {})
      },
      update: {
        ...(motivation !== undefined ? { motivation } : {}),
        ...(experienceSummary !== undefined ? { experienceSummary } : {}),
        ...(operatingArea !== undefined ? { operatingArea } : {}),
        ...(organizationName !== undefined ? { organizationName } : {}),
        ...(organizationInfo !== undefined ? { organizationInfo } : {})
      }
    });

    return this.getMine(identity);
  }

  async addProof(identity: AuthIdentity, input: AddAgentProofInput) {
    const user = await this.requireUser(identity);
    await this.assertAgentNotActive(user.id);

    const application = await this.prisma.agentApplication.findUnique({
      where: { userId: user.id }
    });

    if (!application) {
      throw new NotFoundException("Save your Agent application before attaching proof");
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
      await this.prisma.agentApplicationProof.create({
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

    const proof = await this.prisma.agentApplicationProof.findUnique({
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

    await this.prisma.agentApplicationProof.delete({
      where: { id: proof.id }
    });

    return this.getMine(identity);
  }

  async submit(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    await this.assertAgentNotActive(user.id);

    const application = await this.prisma.agentApplication.findUnique({
      where: { userId: user.id },
      include: { proofs: true }
    });

    if (!application) {
      throw new NotFoundException("Create your Agent application before submitting it");
    }

    if (application.status !== "DRAFT") {
      throw new BadRequestException(`Application is already ${application.status}`);
    }

    const missing: string[] = [];
    if (!application.motivation) missing.push("motivation");
    if (!application.experienceSummary) missing.push("experienceSummary");
    if (!application.operatingArea) missing.push("operatingArea");
    if (application.proofs.length === 0) missing.push("proof");

    if (missing.length > 0) {
      throw new BadRequestException(
        `Complete these fields before submitting: ${missing.join(", ")}`
      );
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.agentApplication.update({
        where: { id: application.id },
        data: {
          status: "SUBMITTED",
          submittedAt: now
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "agent_application.submitted",
          source: "api",
          userId: user.id,
          payload: {
            applicationId: application.id,
            applicantUserId: user.id
          }
        }
      })
    ]);

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

  private async assertAgentNotActive(userId: string) {
    const capability = await this.prisma.userCapability.findUnique({
      where: {
        userId_capability: {
          userId,
          capability: "AGENT"
        }
      }
    });

    if (capability?.status === "ACTIVE") {
      throw new BadRequestException("This Hustle identity already has the Agent capability");
    }
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

  private requiredProofType(value: unknown): AgentProofType {
    if (
      typeof value !== "string" ||
      !Object.values(AgentProofType).includes(value as AgentProofType)
    ) {
      throw new BadRequestException("Invalid proof type");
    }
    return value as AgentProofType;
  }

  private requiredFileSize(value: unknown): number {
    const size = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(size) || size <= 0 || size > maxProofBytes) {
      throw new BadRequestException("Proof file must be no larger than 10 MB");
    }
    return size;
  }
}

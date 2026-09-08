import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HustlerApplicationStatus, VerificationStatus } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";

export interface HustlerReviewDecisionInput {
  notes?: unknown;
  rejectionReason?: unknown;
  status?: unknown;
}

const reviewerStatuses = new Set<HustlerApplicationStatus>([
  HustlerApplicationStatus.SUBMITTED,
  HustlerApplicationStatus.UNDER_REVIEW,
  HustlerApplicationStatus.APPROVED,
  HustlerApplicationStatus.REJECTED
]);

@Injectable()
export class HustlerReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async list(identity: AuthIdentity, status?: string) {
    await this.requireReviewerUser(identity);

    const normalized = status?.trim().toUpperCase();
    const requestedStatus = normalized
      ? this.requiredReviewStatus(normalized)
      : undefined;

    return this.prisma.hustlerApplication.findMany({
      where: requestedStatus
        ? { status: requestedStatus }
        : {
            status: {
              in: [
                HustlerApplicationStatus.SUBMITTED,
                HustlerApplicationStatus.UNDER_REVIEW
              ]
            }
          },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            email: true,
            phone: true,
            location: true
          }
        },
        proofs: {
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: [
        { submittedAt: "asc" },
        { createdAt: "asc" }
      ]
    });
  }

  async get(identity: AuthIdentity, applicationId: string) {
    await this.requireReviewerUser(identity);

    const application = await this.prisma.hustlerApplication.findUnique({
      where: { id: applicationId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            email: true,
            phone: true,
            location: true,
            capabilities: {
              orderBy: { enabledAt: "asc" }
            }
          }
        },
        reviewer: {
          select: {
            id: true,
            displayName: true,
            username: true,
            email: true
          }
        },
        proofs: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!application) {
      throw new NotFoundException("Hustler application not found");
    }

    return application;
  }

  async start(identity: AuthIdentity, applicationId: string) {
    const reviewer = await this.requireReviewerUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertNotSelfReview(application.userId, reviewer.id);

    if (
      application.status === HustlerApplicationStatus.UNDER_REVIEW &&
      application.reviewerId === reviewer.id
    ) {
      return this.get(identity, applicationId);
    }

    if (application.status !== HustlerApplicationStatus.SUBMITTED) {
      throw new BadRequestException(
        `Only SUBMITTED applications can enter review. Current state: ${application.status}`
      );
    }

    await this.prisma.hustlerApplication.update({
      where: { id: application.id },
      data: {
        status: HustlerApplicationStatus.UNDER_REVIEW,
        reviewerId: reviewer.id,
        identityVerificationStatus:
          application.identityVerificationStatus === VerificationStatus.NOT_STARTED
            ? VerificationStatus.PENDING
            : application.identityVerificationStatus,
        reviewNotes: null,
        rejectionReason: null,
        reviewedAt: null
      }
    });

    return this.get(identity, applicationId);
  }

  async setVerification(
    identity: AuthIdentity,
    applicationId: string,
    input: HustlerReviewDecisionInput
  ) {
    const reviewer = await this.requireReviewerUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertAssigned(application, reviewer.id);

    if (application.status !== HustlerApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException("Identity verification is only available during review");
    }

    const status = this.requiredVerificationDecision(input.status);

    await this.prisma.hustlerApplication.update({
      where: { id: application.id },
      data: {
        identityVerificationStatus: status
      }
    });

    return this.get(identity, applicationId);
  }

  async createProofReadUrl(
    identity: AuthIdentity,
    applicationId: string,
    proofId: string
  ) {
    const reviewer = await this.requireReviewerUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertAssigned(application, reviewer.id);

    if (application.status !== HustlerApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException("Proof preview is only available during active review");
    }

    const proof = await this.prisma.hustlerApplicationProof.findFirst({
      where: {
        id: proofId,
        applicationId
      }
    });

    if (!proof) {
      throw new NotFoundException("Hustler proof item not found");
    }

    const supabaseUrl = this.config.get<string>("SUPABASE_URL");
    const supabaseSecretKey = this.config.get<string>("SUPABASE_SECRET_KEY");

    if (!supabaseUrl || !supabaseSecretKey) {
      throw new ServiceUnavailableException(
        "Reviewer proof preview is not configured on the API"
      );
    }

    const storage = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const expiresInSeconds = 300;
    const { data, error } = await storage.storage
      .from("hustler-proofs")
      .createSignedUrl(proof.storageKey, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException(
        error?.message ?? "Could not create a secure proof preview"
      );
    }

    return {
      url: data.signedUrl,
      expiresInSeconds,
      proof: {
        id: proof.id,
        fileName: proof.fileName,
        type: proof.type,
        mimeType: proof.mimeType,
        sizeBytes: proof.sizeBytes
      }
    };
  }

  async approve(
    identity: AuthIdentity,
    applicationId: string,
    input: HustlerReviewDecisionInput
  ) {
    const reviewer = await this.requireReviewerUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertAssigned(application, reviewer.id);

    if (application.status !== HustlerApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException("Only an application under review can be approved");
    }

    if (application.identityVerificationStatus !== VerificationStatus.VERIFIED) {
      throw new BadRequestException("Identity verification must be VERIFIED before approval");
    }

    const proofCount = await this.prisma.hustlerApplicationProof.count({
      where: { applicationId: application.id }
    });

    if (proofCount === 0) {
      throw new BadRequestException("At least one capability proof is required for approval");
    }

    const notes = this.optionalText(input.notes, "notes", 2000);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const clientCapability = await tx.userCapability.findUnique({
        where: {
          userId_capability: {
            userId: application.userId,
            capability: "CLIENT"
          }
        }
      });

      if (!clientCapability || clientCapability.status !== "ACTIVE") {
        throw new BadRequestException(
          "The applicant must retain an ACTIVE CLIENT capability before Hustler activation"
        );
      }

      await tx.hustlerApplication.update({
        where: { id: application.id },
        data: {
          status: HustlerApplicationStatus.APPROVED,
          reviewedAt: now,
          reviewNotes: notes,
          rejectionReason: null
        }
      });

      await tx.userCapability.upsert({
        where: {
          userId_capability: {
            userId: application.userId,
            capability: "HUSTLER"
          }
        },
        create: {
          userId: application.userId,
          capability: "HUSTLER",
          status: "ACTIVE",
          enabledAt: now
        },
        update: {
          status: "ACTIVE",
          enabledAt: now
        }
      });

      await tx.systemEvent.create({
        data: {
          name: "hustler_application.approved",
          source: "api",
          payload: {
            applicationId: application.id,
            applicantUserId: application.userId,
            reviewerUserId: reviewer.id
          }
        }
      });
    });

    return this.get(identity, applicationId);
  }

  async reject(
    identity: AuthIdentity,
    applicationId: string,
    input: HustlerReviewDecisionInput
  ) {
    const reviewer = await this.requireReviewerUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertAssigned(application, reviewer.id);

    if (application.status !== HustlerApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException("Only an application under review can be rejected");
    }

    const rejectionReason = this.requiredText(
      input.rejectionReason,
      "rejectionReason",
      1000
    );
    const notes = this.optionalText(input.notes, "notes", 2000);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.hustlerApplication.update({
        where: { id: application.id },
        data: {
          status: HustlerApplicationStatus.REJECTED,
          reviewedAt: now,
          reviewNotes: notes,
          rejectionReason
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "hustler_application.rejected",
          source: "api",
          payload: {
            applicationId: application.id,
            applicantUserId: application.userId,
            reviewerUserId: reviewer.id,
            rejectionReason
          }
        }
      })
    ]);

    return this.get(identity, applicationId);
  }

  private async requireReviewerUser(identity: AuthIdentity) {
    const reviewer = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        email: true
      }
    });

    if (!reviewer) {
      throw new NotFoundException("Reviewer Hustle account is not synchronized");
    }

    return reviewer;
  }

  private async requireApplication(applicationId: string) {
    const application = await this.prisma.hustlerApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      throw new NotFoundException("Hustler application not found");
    }

    return application;
  }

  private assertNotSelfReview(applicantUserId: string, reviewerUserId: string) {
    if (applicantUserId === reviewerUserId) {
      throw new ForbiddenException("Applicants cannot review their own Hustler application");
    }
  }

  private assertAssigned(
    application: { userId: string; reviewerId: string | null },
    reviewerUserId: string
  ) {
    this.assertNotSelfReview(application.userId, reviewerUserId);

    if (application.reviewerId !== reviewerUserId) {
      throw new ForbiddenException("This Hustler application is assigned to another reviewer");
    }
  }

  private requiredReviewStatus(value: string): HustlerApplicationStatus {
    if (
      !Object.values(HustlerApplicationStatus).includes(
        value as HustlerApplicationStatus
      ) ||
      !reviewerStatuses.has(value as HustlerApplicationStatus)
    ) {
      throw new BadRequestException("Invalid Hustler review status");
    }

    return value as HustlerApplicationStatus;
  }

  private requiredVerificationDecision(value: unknown): VerificationStatus {
    if (
      value !== VerificationStatus.VERIFIED &&
      value !== VerificationStatus.REJECTED
    ) {
      throw new BadRequestException("Verification status must be VERIFIED or REJECTED");
    }

    return value;
  }

  private optionalText(
    value: unknown,
    field: string,
    maxLength: number
  ): string | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

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

  private requiredText(value: unknown, field: string, maxLength: number): string {
    const normalized = this.optionalText(value, field, maxLength);
    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }
    return normalized;
  }
}

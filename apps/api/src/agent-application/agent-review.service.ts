import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  AgentApplicationStatus,
  VerificationStatus
} from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

export interface AgentReviewDecisionInput {
  notes?: unknown;
  rejectionReason?: unknown;
  status?: unknown;
}

const reviewerStatuses = new Set<AgentApplicationStatus>([
  AgentApplicationStatus.SUBMITTED,
  AgentApplicationStatus.UNDER_REVIEW,
  AgentApplicationStatus.APPROVED,
  AgentApplicationStatus.REJECTED
]);

@Injectable()
export class AgentReviewService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async list(identity: AuthIdentity, status?: string) {
    await this.requireAdminUser(identity);

    const normalized = status?.trim().toUpperCase();
    const requestedStatus = normalized
      ? this.requiredReviewStatus(normalized)
      : undefined;

    return this.prisma.agentApplication.findMany({
      where: requestedStatus
        ? { status: requestedStatus }
        : {
            status: {
              in: [
                AgentApplicationStatus.SUBMITTED,
                AgentApplicationStatus.UNDER_REVIEW
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
    await this.requireAdminUser(identity);

    const application = await this.prisma.agentApplication.findUnique({
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
      throw new NotFoundException("Agent application not found");
    }

    return application;
  }

  async start(identity: AuthIdentity, applicationId: string) {
    const reviewer = await this.requireAdminUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertNotSelfReview(application.userId, reviewer.id);

    if (
      application.status === AgentApplicationStatus.UNDER_REVIEW &&
      application.reviewerId === reviewer.id
    ) {
      return this.get(identity, applicationId);
    }

    if (application.status !== AgentApplicationStatus.SUBMITTED) {
      throw new BadRequestException(
        `Only SUBMITTED applications can enter review. Current state: ${application.status}`
      );
    }

    await this.prisma.$transaction([
      this.prisma.agentApplication.update({
        where: { id: application.id },
        data: {
          status: AgentApplicationStatus.UNDER_REVIEW,
          reviewerId: reviewer.id,
          identityVerificationStatus:
            application.identityVerificationStatus === VerificationStatus.NOT_STARTED
              ? VerificationStatus.PENDING
              : application.identityVerificationStatus,
          reviewNotes: null,
          rejectionReason: null,
          reviewedAt: null
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "agent_application.review_started",
          source: "admin",
          payload: {
            applicationId: application.id,
            applicantUserId: application.userId,
            reviewerUserId: reviewer.id
          }
        }
      })
    ]);

    return this.get(identity, applicationId);
  }

  async setVerification(
    identity: AuthIdentity,
    applicationId: string,
    input: AgentReviewDecisionInput
  ) {
    const reviewer = await this.requireAdminUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertAssigned(application, reviewer.id);

    if (application.status !== AgentApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException("Identity verification is only available during review");
    }

    const status = this.requiredVerificationDecision(input.status);

    await this.prisma.$transaction([
      this.prisma.agentApplication.update({
        where: { id: application.id },
        data: {
          identityVerificationStatus: status
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "agent_application.verification_changed",
          source: "admin",
          payload: {
            applicationId: application.id,
            applicantUserId: application.userId,
            reviewerUserId: reviewer.id,
            status
          }
        }
      })
    ]);

    return this.get(identity, applicationId);
  }

  async createProofReadUrl(
    identity: AuthIdentity,
    applicationId: string,
    proofId: string
  ) {
    const reviewer = await this.requireAdminUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertAssigned(application, reviewer.id);

    if (application.status !== AgentApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException("Proof preview is only available during active review");
    }

    const proof = await this.prisma.agentApplicationProof.findFirst({
      where: {
        id: proofId,
        applicationId
      }
    });

    if (!proof) {
      throw new NotFoundException("Agent proof item not found");
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      throw new ServiceUnavailableException(
        "Secure proof preview is not configured on the API. Add SUPABASE_SECRET_KEY to the API environment."
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
      .from("agent-proofs")
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
    input: AgentReviewDecisionInput
  ) {
    const reviewer = await this.requireAdminUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertAssigned(application, reviewer.id);

    if (application.status !== AgentApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException("Only an application under review can be approved");
    }

    if (application.identityVerificationStatus !== VerificationStatus.VERIFIED) {
      throw new BadRequestException("Identity verification must be VERIFIED before approval");
    }

    const proofCount = await this.prisma.agentApplicationProof.count({
      where: { applicationId: application.id }
    });

    if (proofCount === 0) {
      throw new BadRequestException("At least one Agent proof item is required for approval");
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
          "The applicant must retain an ACTIVE CLIENT capability before Agent activation"
        );
      }

      await tx.agentApplication.update({
        where: { id: application.id },
        data: {
          status: AgentApplicationStatus.APPROVED,
          reviewedAt: now,
          reviewNotes: notes,
          rejectionReason: null
        }
      });

      await tx.userCapability.upsert({
        where: {
          userId_capability: {
            userId: application.userId,
            capability: "AGENT"
          }
        },
        create: {
          userId: application.userId,
          capability: "AGENT",
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
          name: "agent_application.approved",
          source: "admin",
          payload: {
            applicationId: application.id,
            applicantUserId: application.userId,
            reviewerUserId: reviewer.id,
            activatedCapability: "AGENT"
          }
        }
      });
      await this.notifications.recordCapabilityApplication(tx, {
        applicationId: application.id,
        applicantUserId: application.userId,
        capability: "AGENT",
        status: "APPROVED"
      });
    });

    return this.get(identity, applicationId);
  }

  async reject(
    identity: AuthIdentity,
    applicationId: string,
    input: AgentReviewDecisionInput
  ) {
    const reviewer = await this.requireAdminUser(identity);
    const application = await this.requireApplication(applicationId);
    this.assertAssigned(application, reviewer.id);

    if (application.status !== AgentApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException("Only an application under review can be rejected");
    }

    const rejectionReason = this.requiredText(
      input.rejectionReason,
      "rejectionReason",
      1000
    );
    const notes = this.optionalText(input.notes, "notes", 2000);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.agentApplication.update({
        where: { id: application.id },
        data: {
          status: AgentApplicationStatus.REJECTED,
          reviewedAt: now,
          reviewNotes: notes,
          rejectionReason
        }
      }),
      await tx.systemEvent.create({
        data: {
          name: "agent_application.rejected",
          source: "admin",
          payload: {
            applicationId: application.id,
            applicantUserId: application.userId,
            reviewerUserId: reviewer.id,
            rejectionReason
          }
        }
      });
      await this.notifications.recordCapabilityApplication(tx, {
        applicationId: application.id,
        applicantUserId: application.userId,
        capability: "AGENT",
        status: "REJECTED"
      });
    });

    return this.get(identity, applicationId);
  }

  private async requireAdminUser(identity: AuthIdentity) {
    const reviewer = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        email: true
      }
    });

    if (!reviewer) {
      throw new NotFoundException("Admin Hustle account is not synchronized");
    }

    return reviewer;
  }

  private async requireApplication(applicationId: string) {
    const application = await this.prisma.agentApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      throw new NotFoundException("Agent application not found");
    }

    return application;
  }

  private assertNotSelfReview(applicantUserId: string, reviewerUserId: string) {
    if (applicantUserId === reviewerUserId) {
      throw new ForbiddenException("Applicants cannot review their own Agent application");
    }
  }

  private assertAssigned(
    application: { userId: string; reviewerId: string | null },
    reviewerUserId: string
  ) {
    this.assertNotSelfReview(application.userId, reviewerUserId);

    if (application.reviewerId !== reviewerUserId) {
      throw new ForbiddenException("This Agent application is assigned to another admin");
    }
  }

  private requiredReviewStatus(value: string): AgentApplicationStatus {
    if (
      !Object.values(AgentApplicationStatus).includes(
        value as AgentApplicationStatus
      ) ||
      !reviewerStatuses.has(value as AgentApplicationStatus)
    ) {
      throw new BadRequestException("Invalid Agent review status");
    }

    return value as AgentApplicationStatus;
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

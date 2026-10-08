import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgentPermissionScope,
  Capability,
  HustlerApplicationStatus,
  HustlerProofType,
  Prisma
} from "@prisma/client";

import { AgentRelationshipService } from "../agent-relationship/agent-relationship.service";
import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface UpdateDelegatedIdentityInput {
  displayName?: unknown;
  username?: unknown;
  location?: unknown;
  bio?: unknown;
  avatarUrl?: unknown;
}

export interface SaveDelegatedHustlerApplicationInput {
  primarySkill?: unknown;
  category?: unknown;
  experienceSummary?: unknown;
  yearsExperience?: unknown;
  businessName?: unknown;
  businessInfo?: unknown;
}

export interface AddDelegatedHustlerProofInput {
  type?: unknown;
  storageKey?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
}

const onboardingScopes: AgentPermissionScope[] = [
  AgentPermissionScope.ACCOUNT_ONBOARDING_MANAGE,
  AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
];

const allowedProofMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const maxProofBytes = 10 * 1024 * 1024;

@Injectable()
export class AgentPrincipalOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationships: AgentRelationshipService
  ) {}

  async get(identity: AuthIdentity, principalUserId: string) {
    const agent = await this.requireAgent(identity);
    const principalId = this.requiredText(principalUserId, "principalUserId", 200);
    return this.view(identity, agent.id, principalId);
  }

  async updateIdentity(
    identity: AuthIdentity,
    principalUserId: string,
    input: UpdateDelegatedIdentityInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.ACCOUNT_ONBOARDING_MANAGE
    );

    const existing = await this.prisma.user.findUnique({
      where: { id: ctx.principalUserId },
      select: {
        displayName: true,
        username: true
      }
    });
    if (!existing) throw new NotFoundException("Represented Hustle account not found");

    const displayName =
      input.displayName === undefined
        ? undefined
        : this.requiredText(input.displayName, "displayName", 80);
    const username =
      input.username === undefined
        ? undefined
        : this.requiredUsername(input.username);
    const location = this.optionalText(input.location, "location", 120);
    const bio = this.optionalText(input.bio, "bio", 300);
    const avatarUrl = this.optionalUrl(input.avatarUrl, "avatarUrl", 1000);

    if (username !== undefined) {
      await this.assertUsernameAvailable(username, ctx.principalUserId);
    }

    const resultingDisplayName = displayName ?? existing.displayName;
    const resultingUsername = username ?? existing.username;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: ctx.principalUserId },
          data: {
            ...(displayName !== undefined ? { displayName } : {}),
            ...(username !== undefined ? { username } : {}),
            ...(location !== undefined ? { location } : {}),
            ...(bio !== undefined ? { bio } : {}),
            ...(avatarUrl !== undefined ? { avatarUrl } : {}),
            onboardingCompleted: Boolean(resultingDisplayName && resultingUsername)
          }
        });

        await this.writeAudit(
          tx,
          ctx,
          "agent.account_onboarding.identity_updated",
          "User",
          ctx.principalUserId
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new BadRequestException("That username is already taken");
      }
      throw error;
    }

    return this.view(identity, ctx.actorUserId, ctx.principalUserId);
  }

  async saveHustlerApplication(
    identity: AuthIdentity,
    principalUserId: string,
    input: SaveDelegatedHustlerApplicationInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
    );

    const [existing, activeHustler] = await Promise.all([
      this.prisma.hustlerApplication.findUnique({
        where: { userId: ctx.principalUserId }
      }),
      this.prisma.userCapability.findUnique({
        where: {
          userId_capability: {
            userId: ctx.principalUserId,
            capability: Capability.HUSTLER
          }
        },
        select: { status: true }
      })
    ]);

    if (!existing && activeHustler?.status === "ACTIVE") {
      throw new BadRequestException("This represented account is already an ACTIVE HUSTLER");
    }

    if (existing && existing.status !== HustlerApplicationStatus.DRAFT) {
      throw new BadRequestException(
        "Applications in " + existing.status + " state cannot be edited"
      );
    }

    const data = {
      primarySkill: this.optionalText(input.primarySkill, "primarySkill", 100),
      category: this.optionalText(input.category, "category", 100),
      experienceSummary: this.optionalText(
        input.experienceSummary,
        "experienceSummary",
        1200
      ),
      yearsExperience: this.optionalYearsExperience(input.yearsExperience),
      businessName: this.optionalText(input.businessName, "businessName", 120),
      businessInfo: this.optionalText(input.businessInfo, "businessInfo", 800)
    };

    await this.prisma.$transaction(async (tx) => {
      const application = await tx.hustlerApplication.upsert({
        where: { userId: ctx.principalUserId },
        create: {
          userId: ctx.principalUserId,
          ...(data.primarySkill !== undefined ? { primarySkill: data.primarySkill } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.experienceSummary !== undefined
            ? { experienceSummary: data.experienceSummary }
            : {}),
          ...(data.yearsExperience !== undefined
            ? { yearsExperience: data.yearsExperience }
            : {}),
          ...(data.businessName !== undefined ? { businessName: data.businessName } : {}),
          ...(data.businessInfo !== undefined ? { businessInfo: data.businessInfo } : {})
        },
        update: {
          ...(data.primarySkill !== undefined ? { primarySkill: data.primarySkill } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.experienceSummary !== undefined
            ? { experienceSummary: data.experienceSummary }
            : {}),
          ...(data.yearsExperience !== undefined
            ? { yearsExperience: data.yearsExperience }
            : {}),
          ...(data.businessName !== undefined ? { businessName: data.businessName } : {}),
          ...(data.businessInfo !== undefined ? { businessInfo: data.businessInfo } : {})
        }
      });

      await this.writeAudit(
        tx,
        ctx,
        "agent.hustler_application.saved",
        "HustlerApplication",
        application.id
      );
    });

    return this.view(identity, ctx.actorUserId, ctx.principalUserId);
  }

  async addProof(
    identity: AuthIdentity,
    principalUserId: string,
    input: AddDelegatedHustlerProofInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
    );

    const application = await this.prisma.hustlerApplication.findUnique({
      where: { userId: ctx.principalUserId }
    });

    if (!application) {
      throw new NotFoundException(
        "Save the represented Client's Hustler application before attaching proof"
      );
    }
    if (application.status !== HustlerApplicationStatus.DRAFT) {
      throw new BadRequestException(
        "Applications in " + application.status + " state cannot accept new proof"
      );
    }

    const type = this.requiredProofType(input.type);
    const storageKey = this.requiredText(input.storageKey, "storageKey", 500);
    const fileName = this.requiredText(input.fileName, "fileName", 180);
    const mimeType = this.requiredText(input.mimeType, "mimeType", 100).toLowerCase();
    const sizeBytes = this.requiredFileSize(input.sizeBytes);

    if (!storageKey.startsWith(identity.subject + "/")) {
      throw new BadRequestException(
        "Delegated proof storage path must belong to the authenticated Agent"
      );
    }
    if (!allowedProofMimeTypes.has(mimeType)) {
      throw new BadRequestException("Proof must be a PDF, JPEG, PNG or WebP file");
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.hustlerApplicationProof.create({
          data: {
            applicationId: application.id,
            type,
            storageKey,
            fileName,
            mimeType,
            sizeBytes
          }
        });

        await this.writeAudit(
          tx,
          ctx,
          "agent.hustler_application.proof_added",
          "HustlerApplication",
          application.id
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new BadRequestException("That proof file is already attached");
      }
      throw error;
    }

    return this.view(identity, ctx.actorUserId, ctx.principalUserId);
  }

  async removeProof(
    identity: AuthIdentity,
    principalUserId: string,
    proofId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
    );

    const proof = await this.prisma.hustlerApplicationProof.findFirst({
      where: {
        id: this.requiredText(proofId, "proofId", 200),
        application: { userId: ctx.principalUserId }
      },
      include: {
        application: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    if (!proof) throw new NotFoundException("Hustler proof item not found");
    if (proof.application.status !== HustlerApplicationStatus.DRAFT) {
      throw new BadRequestException(
        "Proof cannot be removed while the application is " + proof.application.status
      );
    }
    if (!proof.storageKey.startsWith(identity.subject + "/")) {
      throw new ForbiddenException(
        "An Agent can only remove proof files that Agent uploaded"
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.hustlerApplicationProof.delete({ where: { id: proof.id } });
      await this.writeAudit(
        tx,
        ctx,
        "agent.hustler_application.proof_removed",
        "HustlerApplication",
        proof.application.id
      );
    });

    return this.view(identity, ctx.actorUserId, ctx.principalUserId);
  }

  async submitHustlerApplication(
    identity: AuthIdentity,
    principalUserId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
    );

    const application = await this.prisma.hustlerApplication.findUnique({
      where: { userId: ctx.principalUserId },
      include: { proofs: true }
    });

    if (!application) {
      throw new NotFoundException(
        "Create the represented Client's Hustler application first"
      );
    }
    if (application.status !== HustlerApplicationStatus.DRAFT) {
      throw new BadRequestException(
        "Application is already " + application.status
      );
    }

    const missing: string[] = [];
    if (!application.primarySkill) missing.push("primarySkill");
    if (!application.category) missing.push("category");
    if (!application.experienceSummary) missing.push("experienceSummary");
    if (application.yearsExperience === null) missing.push("yearsExperience");
    if (application.proofs.length === 0) missing.push("proof");

    if (missing.length > 0) {
      throw new BadRequestException(
        "Complete these fields before submitting: " + missing.join(", ")
      );
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.hustlerApplication.update({
        where: { id: application.id },
        data: {
          status: HustlerApplicationStatus.SUBMITTED,
          submittedAt: now
        }
      });

      await this.writeAudit(
        tx,
        ctx,
        "agent.hustler_application.submitted",
        "HustlerApplication",
        application.id
      );
    });

    return this.view(identity, ctx.actorUserId, ctx.principalUserId);
  }

  private async view(
    identity: AuthIdentity,
    agentUserId: string,
    principalUserId: string
  ) {
    const relationship = await this.prisma.agentRelationship.findFirst({
      where: {
        agentUserId,
        principalUserId,
        status: "ACTIVE"
      },
      include: {
        permissions: {
          where: { active: true },
          orderBy: { scope: "asc" }
        },
        principal: {
          select: {
            id: true,
            displayName: true,
            username: true,
            bio: true,
            location: true,
            avatarUrl: true,
            onboardingCompleted: true,
            capabilities: {
              orderBy: { enabledAt: "asc" }
            },
            hustlerApplication: {
              include: {
                proofs: {
                  orderBy: { createdAt: "asc" }
                }
              }
            }
          }
        }
      }
    });

    if (!relationship) {
      throw new ForbiddenException("An ACTIVE Agent relationship is required");
    }

    const permittedScope = relationship.permissions.find((grant) =>
      onboardingScopes.includes(grant.scope)
    )?.scope;

    if (!permittedScope) {
      throw new ForbiddenException(
        "Account onboarding or Hustler application permission is required"
      );
    }

    await this.relationships.assertAgentPermission(
      agentUserId,
      principalUserId,
      permittedScope
    );

    const application = relationship.principal.hustlerApplication;

    return {
      relationshipId: relationship.id,
      permissions: relationship.permissions,
      principal: {
        ...relationship.principal,
        hustlerApplication: application
          ? {
              ...application,
              proofs: application.proofs.map((proof) => ({
                ...proof,
                agentCanRemove: proof.storageKey.startsWith(identity.subject + "/")
              }))
            }
          : null
      }
    };
  }

  private async requireDelegation(
    identity: AuthIdentity,
    principalUserId: string,
    scope: AgentPermissionScope
  ) {
    const actor = await this.requireAgent(identity);
    const principalId = this.requiredText(principalUserId, "principalUserId", 200);
    const relationship = await this.relationships.assertAgentPermission(
      actor.id,
      principalId,
      scope
    );

    return {
      actorUserId: actor.id,
      principalUserId: principalId,
      relationshipId: relationship.id,
      scope
    };
  }

  private async requireAgent(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        capabilities: {
          where: { capability: Capability.AGENT },
          select: { status: true }
        }
      }
    });

    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    if (user.capabilities[0]?.status !== "ACTIVE") {
      throw new ForbiddenException("ACTIVE AGENT capability required");
    }
    return user;
  }

  private async assertUsernameAvailable(username: string, excludingUserId: string) {
    const collision = await this.prisma.user.findFirst({
      where: {
        id: { not: excludingUserId },
        username: {
          equals: username,
          mode: "insensitive"
        }
      },
      select: { id: true }
    });

    if (collision) {
      throw new BadRequestException("That username is already taken");
    }
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    ctx: {
      actorUserId: string;
      principalUserId: string;
      relationshipId: string;
      scope: AgentPermissionScope;
    },
    action: string,
    entityType: string,
    entityId: string | null
  ) {
    await tx.agentDelegationAudit.create({
      data: {
        relationshipId: ctx.relationshipId,
        actorUserId: ctx.actorUserId,
        ownerUserId: ctx.principalUserId,
        permissionScope: ctx.scope,
        action,
        entityType,
        entityId
      }
    });

    await tx.systemEvent.create({
      data: {
        name: action,
        source: "api",
        payload: {
          relationshipId: ctx.relationshipId,
          actorUserId: ctx.actorUserId,
          principalUserId: ctx.principalUserId,
          permissionScope: ctx.scope,
          entityType,
          entityId
        }
      }
    });
  }

  private requiredUsername(value: unknown): string {
    const username = this.requiredText(value, "username", 30).toLowerCase();
    if (username.length < 3 || !/^[a-z0-9._]+$/.test(username)) {
      throw new BadRequestException(
        "Username must be 3–30 characters using letters, numbers, dots or underscores"
      );
    }
    return username;
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

  private optionalYearsExperience(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;

    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 80) {
      throw new BadRequestException(
        "yearsExperience must be an integer between 0 and 80"
      );
    }
    return parsed;
  }

  private requiredFileSize(value: unknown): number {
    const size = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(size) || size <= 0 || size > maxProofBytes) {
      throw new BadRequestException("Proof file must be no larger than 10 MB");
    }
    return size;
  }

  private optionalUrl(
    value: unknown,
    field: string,
    maxLength: number
  ): string | null | undefined {
    const normalized = this.optionalText(value, field, maxLength);
    if (normalized === undefined || normalized === null) return normalized;

    try {
      return new URL(normalized).toString();
    } catch {
      throw new BadRequestException(field + " must be a valid URL");
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
      throw new BadRequestException(field + " must be text");
    }

    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) {
      throw new BadRequestException(
        field + " must be at most " + maxLength + " characters"
      );
    }
    return normalized;
  }

  private requiredText(value: unknown, field: string, maxLength: number): string {
    const normalized = this.optionalText(value, field, maxLength);
    if (!normalized) throw new BadRequestException(field + " is required");
    return normalized;
  }
}

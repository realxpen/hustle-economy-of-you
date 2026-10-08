import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgentPermissionScope,
  AgentRelationshipStatus,
  AssistedConsentMethod,
  AssistedRegistrationStatus,
  Capability,
  HustlerProofType,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { AgentRelationshipService } from "../agent-relationship/agent-relationship.service";

export interface CreateAssistedRegistrationInput {
  displayName?: unknown;
  username?: unknown;
  location?: unknown;
  bio?: unknown;
  email?: unknown;
  phone?: unknown;
  consentConfirmed?: unknown;
  consentMethod?: unknown;
  consentNote?: unknown;
  permissions?: unknown;
}

export interface UpdateAssistedPermissionsInput {
  permissions?: unknown;
  consentConfirmed?: unknown;
  consentMethod?: unknown;
  consentNote?: unknown;
}

export interface UpdateAssistedIdentityInput {
  displayName?: unknown;
  username?: unknown;
  location?: unknown;
  bio?: unknown;
  email?: unknown;
  phone?: unknown;
}

export interface SaveAssistedHustlerApplicationInput {
  primarySkill?: unknown;
  category?: unknown;
  experienceSummary?: unknown;
  yearsExperience?: unknown;
  businessName?: unknown;
  businessInfo?: unknown;
}

export interface AddAssistedHustlerProofInput {
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
export class AgentAssistedOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationships: AgentRelationshipService
  ) {}

  async list(identity: AuthIdentity) {
    const agent = await this.requireAgent(identity);
    return this.prisma.agentAssistedRegistration.findMany({
      where: { agentUserId: agent.id },
      include: this.registrationInclude(agent.id),
      orderBy: { createdAt: "desc" }
    });
  }

  async get(identity: AuthIdentity, registrationId: string) {
    const agent = await this.requireAgent(identity);
    return this.requireRegistration(registrationId, agent.id);
  }

  async create(identity: AuthIdentity, input: CreateAssistedRegistrationInput) {
    const agent = await this.requireAgent(identity);

    if (input.consentConfirmed !== true) {
      throw new BadRequestException(
        "Confirm that the person explicitly consented to Agent-assisted registration"
      );
    }

    const displayName = this.requiredText(input.displayName, "displayName", 80);
    const username = this.requiredUsername(input.username);
    const location = this.optionalText(input.location, "location", 120);
    const bio = this.optionalText(input.bio, "bio", 300);
    const email = this.optionalEmail(input.email);
    const phone = this.optionalText(input.phone, "phone", 40);
    const consentMethod = this.requiredConsentMethod(input.consentMethod);
    const consentNote = this.optionalText(input.consentNote, "consentNote", 1000);
    const permissions = this.registrationPermissions(input.permissions);

    await this.assertIdentityAvailable(username, email, phone);

    const now = new Date();
    const provisionalSubject = `assisted:${randomUUID()}`;

    const registrationId = await this.prisma.$transaction(async (tx) => {
      const principal = await tx.user.create({
        data: {
          authSubject: provisionalSubject,
          displayName,
          username,
          location,
          bio,
          email,
          phone,
          emailVerified: false,
          phoneVerified: false,
          onboardingCompleted: true,
          capabilities: {
            create: {
              capability: Capability.CLIENT,
              status: "ACTIVE",
              enabledAt: now
            }
          }
        }
      });

      const registration = await tx.agentAssistedRegistration.create({
        data: {
          agentUserId: agent.id,
          principalUserId: principal.id,
          status: AssistedRegistrationStatus.ACTIVE,
          consentMethod,
          consentNote,
          consentConfirmedAt: now
        }
      });

      const relationship = await tx.agentRelationship.create({
        data: {
          principalUserId: principal.id,
          agentUserId: agent.id,
          status: AgentRelationshipStatus.ACTIVE,
          invitedAt: now,
          respondedAt: now,
          activatedAt: now
        }
      });

      for (const scope of permissions) {
        await tx.agentPermissionGrant.create({
          data: {
            relationshipId: relationship.id,
            scope,
            active: true,
            grantedByUserId: principal.id,
            grantedAt: now
          }
        });
      }

      await tx.agentDelegationAudit.create({
        data: {
          relationshipId: relationship.id,
          actorUserId: agent.id,
          ownerUserId: principal.id,
          permissionScope: AgentPermissionScope.ACCOUNT_ONBOARDING_MANAGE,
          action: "agent_assisted_registration.created",
          entityType: "User",
          entityId: principal.id,
          metadata: {
            registrationId: registration.id,
            consentMethod,
            permissions
          }
        }
      });

      await tx.systemEvent.create({
        data: {
          name: "agent_assisted_registration.created",
          source: "api",
          payload: {
            registrationId: registration.id,
            agentUserId: agent.id,
            principalUserId: principal.id,
            consentMethod,
            permissions
          }
        }
      });

      return registration.id;
    });

    return this.requireRegistration(registrationId, agent.id);
  }

  async updatePermissions(
    identity: AuthIdentity,
    registrationId: string,
    input: UpdateAssistedPermissionsInput
  ) {
    const agent = await this.requireAgent(identity);
    const registration = await this.requireRegistration(registrationId, agent.id);

    if (
      registration.status !== AssistedRegistrationStatus.ACTIVE ||
      !registration.principal.authSubject.startsWith("assisted:")
    ) {
      throw new ForbiddenException(
        "Assisted permissions cannot change after the account is claimed"
      );
    }
    if (registration.relationship.status !== AgentRelationshipStatus.ACTIVE) {
      throw new ForbiddenException("The assisted Agent relationship is not active");
    }
    if (input.consentConfirmed !== true) {
      throw new BadRequestException(
        "Confirm that the account owner expressly agreed to the updated permissions"
      );
    }
    const consentMethod = this.requiredConsentMethod(input.consentMethod);
    const consentNote = this.optionalText(input.consentNote, "consentNote", 1000);
    if (!Array.isArray(input.permissions)) {
      throw new BadRequestException("permissions must be a list");
    }
    const next = this.registrationPermissions(input.permissions).sort();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Lock the assisted record against a simultaneous account claim.
      const activeRegistration = await tx.agentAssistedRegistration.updateMany({
        where: {
          id: registration.id,
          agentUserId: agent.id,
          status: AssistedRegistrationStatus.ACTIVE
        },
        data: { updatedAt: now }
      });
      if (activeRegistration.count !== 1) {
        throw new ForbiddenException("The account has already been claimed");
      }

      const relationship = await tx.agentRelationship.findUnique({
        where: { id: registration.relationship.id }
      });
      if (relationship?.status !== AgentRelationshipStatus.ACTIVE) {
        throw new ForbiddenException("The assisted Agent relationship is no longer active");
      }

      const activeGrants = await tx.agentPermissionGrant.findMany({
        where: { relationshipId: relationship.id, active: true },
        select: { scope: true }
      });
      const previous = activeGrants.map((item) => item.scope).sort();
      const before = new Set(previous);
      const after = new Set(next);
      const added = next.filter((scope) => !before.has(scope));
      const removed = previous.filter((scope) => !after.has(scope));

      if (added.length === 0 && removed.length === 0) return;

      if (removed.length) {
        await tx.agentPermissionGrant.updateMany({
          where: { relationshipId: relationship.id, scope: { in: removed }, active: true },
          data: { active: false, revokedAt: now }
        });
      }
      for (const scope of added) {
        await tx.agentPermissionGrant.upsert({
          where: { relationshipId_scope: { relationshipId: relationship.id, scope } },
          create: {
            relationshipId: relationship.id,
            scope,
            active: true,
            grantedByUserId: registration.principalUserId,
            grantedAt: now
          },
          update: {
            active: true,
            grantedByUserId: registration.principalUserId,
            grantedAt: now,
            revokedAt: null
          }
        });
      }
      const metadata = {
        registrationId: registration.id,
        previous,
        next,
        added,
        removed,
        consentMethod,
        consentNote: consentNote ?? null,
        consentConfirmedAt: now.toISOString(),
        temporaryUntilClaim: true
      };
      await tx.agentDelegationAudit.create({
        data: {
          relationshipId: relationship.id,
          actorUserId: agent.id,
          ownerUserId: registration.principalUserId,
          action: "agent_assisted_registration.permissions_updated",
          entityType: "AgentRelationship",
          entityId: relationship.id,
          metadata
        }
      });
      await tx.systemEvent.create({
        data: {
          name: "agent_assisted_registration.permissions_updated",
          source: "api",
          payload: {
            relationshipId: relationship.id,
            actorUserId: agent.id,
            principalUserId: registration.principalUserId,
            ...metadata
          }
        }
      });
    });

    return this.requireRegistration(registration.id, agent.id);
  }

  async updateIdentity(
    identity: AuthIdentity,
    registrationId: string,
    input: UpdateAssistedIdentityInput
  ) {
    const agent = await this.requireAgent(identity);
    const registration = await this.requireRegistration(registrationId, agent.id);

    if (registration.status !== AssistedRegistrationStatus.ACTIVE) {
      throw new BadRequestException(
        "Claimed or cancelled assisted identities cannot be edited from assisted onboarding"
      );
    }

    await this.relationships.assertAgentPermission(
      agent.id,
      registration.principalUserId,
      AgentPermissionScope.ACCOUNT_ONBOARDING_MANAGE
    );

    const displayName = this.optionalText(input.displayName, "displayName", 80);
    const username =
      input.username === undefined ? undefined : this.requiredUsername(input.username);
    const location = this.optionalText(input.location, "location", 120);
    const bio = this.optionalText(input.bio, "bio", 300);
    const email = this.optionalEmail(input.email);
    const phone = this.optionalText(input.phone, "phone", 40);

    if (username !== undefined || email !== undefined || phone !== undefined) {
      await this.assertIdentityAvailable(
        username ?? registration.principal.username ?? "",
        email === undefined ? registration.principal.email : email,
        phone === undefined ? registration.principal.phone : phone,
        registration.principalUserId
      );
    }

    await this.prisma.user.update({
      where: { id: registration.principalUserId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(username !== undefined ? { username } : {}),
        ...(location !== undefined ? { location } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {})
      }
    });

    await this.audit(
      registration.relationship.id,
      agent.id,
      registration.principalUserId,
      AgentPermissionScope.ACCOUNT_ONBOARDING_MANAGE,
      "agent_assisted_registration.identity_updated",
      "User",
      registration.principalUserId
    );

    return this.requireRegistration(registration.id, agent.id);
  }

  async saveHustlerApplication(
    identity: AuthIdentity,
    registrationId: string,
    input: SaveAssistedHustlerApplicationInput
  ) {
    const agent = await this.requireAgent(identity);
    const registration = await this.requireRegistration(registrationId, agent.id);

    await this.relationships.assertAgentPermission(
      agent.id,
      registration.principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
    );

    const existing = await this.prisma.hustlerApplication.findUnique({
      where: { userId: registration.principalUserId }
    });

    if (existing && existing.status !== "DRAFT") {
      throw new BadRequestException(
        `Applications in ${existing.status} state cannot be edited`
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

    await this.prisma.hustlerApplication.upsert({
      where: { userId: registration.principalUserId },
      create: {
        userId: registration.principalUserId,
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

    await this.audit(
      registration.relationship.id,
      agent.id,
      registration.principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE,
      "agent_assisted_hustler_application.saved",
      "HustlerApplication",
      existing?.id ?? null
    );

    return this.requireRegistration(registration.id, agent.id);
  }

  async addProof(
    identity: AuthIdentity,
    registrationId: string,
    input: AddAssistedHustlerProofInput
  ) {
    const agent = await this.requireAgent(identity);
    const registration = await this.requireRegistration(registrationId, agent.id);

    await this.relationships.assertAgentPermission(
      agent.id,
      registration.principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
    );

    const application = await this.prisma.hustlerApplication.findUnique({
      where: { userId: registration.principalUserId }
    });
    if (!application) {
      throw new NotFoundException(
        "Save the assisted Hustler application before attaching proof"
      );
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
      throw new BadRequestException(
        "Assisted proof storage path must belong to the authenticated Agent"
      );
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new BadRequestException("That proof file is already attached");
      }
      throw error;
    }

    await this.audit(
      registration.relationship.id,
      agent.id,
      registration.principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE,
      "agent_assisted_hustler_application.proof_added",
      "HustlerApplication",
      application.id
    );

    return this.requireRegistration(registration.id, agent.id);
  }

  async removeProof(
    identity: AuthIdentity,
    registrationId: string,
    proofId: string
  ) {
    const agent = await this.requireAgent(identity);
    const registration = await this.requireRegistration(registrationId, agent.id);

    await this.relationships.assertAgentPermission(
      agent.id,
      registration.principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
    );

    const proof = await this.prisma.hustlerApplicationProof.findFirst({
      where: {
        id: this.requiredText(proofId, "proofId", 200),
        application: { userId: registration.principalUserId }
      },
      include: {
        application: { select: { id: true, status: true } }
      }
    });

    if (!proof) throw new NotFoundException("Hustler proof item not found");
    if (proof.application.status !== "DRAFT") {
      throw new BadRequestException(
        `Proof cannot be removed while the application is ${proof.application.status}`
      );
    }
    if (!proof.storageKey.startsWith(`${identity.subject}/`)) {
      throw new ForbiddenException(
        "Only the Agent who uploaded this proof can remove its metadata"
      );
    }

    await this.prisma.hustlerApplicationProof.delete({ where: { id: proof.id } });

    return this.requireRegistration(registration.id, agent.id);
  }

  async submitHustlerApplication(identity: AuthIdentity, registrationId: string) {
    const agent = await this.requireAgent(identity);
    const registration = await this.requireRegistration(registrationId, agent.id);

    await this.relationships.assertAgentPermission(
      agent.id,
      registration.principalUserId,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
    );

    const application = await this.prisma.hustlerApplication.findUnique({
      where: { userId: registration.principalUserId },
      include: { proofs: true }
    });

    if (!application) {
      throw new NotFoundException("Create the assisted Hustler application first");
    }
    if (application.status !== "DRAFT") {
      throw new BadRequestException(
        `Application is already ${application.status}`
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
        `Complete these fields before submitting: ${missing.join(", ")}`
      );
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.hustlerApplication.update({
        where: { id: application.id },
        data: { status: "SUBMITTED", submittedAt: now }
      }),
      this.prisma.agentDelegationAudit.create({
        data: {
          relationshipId: registration.relationship.id,
          actorUserId: agent.id,
          ownerUserId: registration.principalUserId,
          permissionScope: AgentPermissionScope.HUSTLER_APPLICATION_MANAGE,
          action: "agent_assisted_hustler_application.submitted",
          entityType: "HustlerApplication",
          entityId: application.id,
          metadata: { registrationId: registration.id }
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "agent_assisted_hustler_application.submitted",
          source: "api",
          payload: {
            registrationId: registration.id,
            applicationId: application.id,
            agentUserId: agent.id,
            principalUserId: registration.principalUserId
          }
        }
      })
    ]);

    return this.requireRegistration(registration.id, agent.id);
  }

  private registrationInclude(agentUserId: string) {
    return {
      principal: {
        include: {
          capabilities: { orderBy: { enabledAt: "asc" as const } },
          hustlerApplication: {
            include: {
              proofs: { orderBy: { createdAt: "asc" as const } }
            }
          },
          principalAgentRelationships: {
            where: { agentUserId },
            include: {
              permissions: {
                where: { active: true },
                orderBy: { scope: "asc" as const }
              }
            }
          }
        }
      },
      agent: {
        select: {
          id: true,
          displayName: true,
          username: true,
          email: true
        }
      }
    };
  }

  private async requireRegistration(registrationId: string, agentUserId: string) {
    const registration = await this.prisma.agentAssistedRegistration.findFirst({
      where: {
        id: this.requiredText(registrationId, "registrationId", 200),
        agentUserId
      },
      include: this.registrationInclude(agentUserId)
    });

    if (!registration) {
      throw new NotFoundException("Assisted registration not found");
    }

    const relationship = registration.principal.principalAgentRelationships[0];
    if (!relationship) {
      throw new ForbiddenException(
        "The Agent relationship for this assisted identity is unavailable"
      );
    }

    return {
      ...registration,
      relationship
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

  private async assertIdentityAvailable(
    username: string,
    email: string | null | undefined,
    phone: string | null | undefined,
    excludingUserId?: string
  ) {
    const collision = await this.prisma.user.findFirst({
      where: {
        ...(excludingUserId ? { id: { not: excludingUserId } } : {}),
        OR: [
          { username: { equals: username, mode: "insensitive" } },
          ...(email
            ? [{ email: { equals: email, mode: "insensitive" as const } }]
            : []),
          ...(phone ? [{ phone }] : [])
        ]
      },
      select: { id: true, username: true, email: true, phone: true }
    });

    if (collision) {
      throw new BadRequestException(
        "That username, email or phone is already connected to another Hustle identity"
      );
    }
  }

  private registrationPermissions(value: unknown): AgentPermissionScope[] {
    const required: AgentPermissionScope[] = [
      AgentPermissionScope.ACCOUNT_ONBOARDING_MANAGE,
      AgentPermissionScope.HUSTLER_APPLICATION_MANAGE
    ];
    if (value === undefined || value === null) return required;
    if (!Array.isArray(value)) {
      throw new BadRequestException("permissions must be a list");
    }

    const result = [...required];
    for (const item of value) {
      if (
        typeof item !== "string" ||
        !Object.values(AgentPermissionScope).includes(item as AgentPermissionScope)
      ) {
        throw new BadRequestException("Invalid Agent permission scope");
      }
      const scope = item as AgentPermissionScope;
      if (!result.includes(scope)) result.push(scope);
    }
    return result;
  }

  private requiredConsentMethod(value: unknown): AssistedConsentMethod {
    if (
      typeof value !== "string" ||
      !Object.values(AssistedConsentMethod).includes(value as AssistedConsentMethod)
    ) {
      throw new BadRequestException("A valid consentMethod is required");
    }
    return value as AssistedConsentMethod;
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

  private optionalEmail(value: unknown): string | null | undefined {
    const normalized = this.optionalText(value, "email", 254);
    if (normalized === undefined || normalized === null) return normalized;
    const email = normalized.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("email must be valid");
    }
    return email;
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

  private requiredFileSize(value: unknown): number {
    const size = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(size) || size <= 0 || size > maxProofBytes) {
      throw new BadRequestException("Proof file must be no larger than 10 MB");
    }
    return size;
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
      throw new BadRequestException(
        `${field} must be at most ${maxLength} characters`
      );
    }
    return normalized;
  }

  private requiredText(value: unknown, field: string, maxLength: number) {
    const normalized = this.optionalText(value, field, maxLength);
    if (!normalized) throw new BadRequestException(`${field} is required`);
    return normalized;
  }

  private async audit(
    relationshipId: string,
    actorUserId: string,
    ownerUserId: string,
    permissionScope: AgentPermissionScope,
    action: string,
    entityType: string,
    entityId: string | null
  ) {
    await this.prisma.$transaction([
      this.prisma.agentDelegationAudit.create({
        data: {
          relationshipId,
          actorUserId,
          ownerUserId,
          permissionScope,
          action,
          entityType,
          entityId
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: action,
          source: "api",
          payload: {
            relationshipId,
            actorUserId,
            principalUserId: ownerUserId,
            permissionScope,
            entityType,
            entityId
          }
        }
      })
    ]);
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";

export interface UpdateProfileInput {
  displayName?: unknown;
  username?: unknown;
  bio?: unknown;
  location?: unknown;
  avatarUrl?: unknown;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(identity: AuthIdentity) {
    let account = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject }
    });

    if (account) {
      account = await this.prisma.user.update({
        where: { id: account.id },
        data: {
          email: identity.email ?? account.email,
          phone: identity.phone ?? account.phone,
          emailVerified: identity.emailVerified,
          phoneVerified: identity.phoneVerified
        }
      });
    } else {
      const assisted = await this.findClaimableAssistedRegistration(identity);

      if (assisted) {
        const now = new Date();
        account = await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.user.update({
            where: { id: assisted.principalUserId },
            data: {
              authSubject: identity.subject,
              email: identity.email ?? assisted.principal.email,
              phone: identity.phone ?? assisted.principal.phone,
              emailVerified: identity.emailVerified,
              phoneVerified: identity.phoneVerified
            }
          });

          await tx.agentAssistedRegistration.update({
            where: { id: assisted.id },
            data: {
              status: "CLAIMED",
              claimedAt: now
            }
          });

          // Claim ends every permission inherited from the assisted-registration consent.
          // The new owner may explicitly invite this Agent again after claiming.
          const relationship = await tx.agentRelationship.findFirst({
            where: {
              principalUserId: assisted.principalUserId,
              agentUserId: assisted.agentUserId
            },
            include: { permissions: { where: { active: true }, select: { scope: true } } }
          });
          if (relationship?.status === "ACTIVE") {
            await tx.agentRelationship.update({
              where: { id: relationship.id },
              data: {
                status: "REVOKED",
                revokedAt: now,
                revokedByUserId: assisted.principalUserId
              }
            });
            await tx.agentPermissionGrant.updateMany({
              where: { relationshipId: relationship.id, active: true },
              data: { active: false, revokedAt: now }
            });
            await tx.agentDelegationAudit.create({
              data: {
                relationshipId: relationship.id,
                actorUserId: assisted.principalUserId,
                ownerUserId: assisted.principalUserId,
                action: "agent_assisted_registration.permissions_revoked_on_claim",
                entityType: "AgentRelationship",
                entityId: relationship.id,
                metadata: {
                  registrationId: assisted.id,
                  agentUserId: assisted.agentUserId,
                  revokedScopes: relationship.permissions.map((permission) => permission.scope)
                }
              }
            });
          }

          await tx.systemEvent.create({
            data: {
              name: "agent_assisted_registration.claimed",
              source: "api",
              payload: {
                registrationId: assisted.id,
                principalUserId: assisted.principalUserId,
                agentUserId: assisted.agentUserId,
                assistedPermissionRelationshipRevoked: relationship?.status === "ACTIVE"
              }
            }
          });

          return claimed;
        });
      } else {
        account = await this.prisma.user.create({
          data: {
            authSubject: identity.subject,
            email: identity.email ?? null,
            phone: identity.phone ?? null,
            emailVerified: identity.emailVerified,
            phoneVerified: identity.phoneVerified,
            capabilities: { create: { capability: "CLIENT", status: "ACTIVE" } }
          }
        });
      }
    }

    await this.prisma.userCapability.upsert({
      where: { userId_capability: { userId: account.id, capability: "CLIENT" } },
      update: { status: "ACTIVE" },
      create: { userId: account.id, capability: "CLIENT", status: "ACTIVE" }
    });

    return this.getBySubject(identity.subject);
  }

  async me(identity: AuthIdentity) {
    return this.getBySubject(identity.subject);
  }

  async updateProfile(identity: AuthIdentity, input: UpdateProfileInput) {
    const existing = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true, displayName: true, username: true }
    });
    if (!existing) throw new NotFoundException("Hustle account not synchronized");

    const displayName = this.optionalText(input.displayName, "displayName", 80);
    const username = this.optionalUsername(input.username);
    const bio = this.optionalText(input.bio, "bio", 300);
    const location = this.optionalText(input.location, "location", 120);
    const avatarUrl = this.optionalUrl(input.avatarUrl);
    const resultingDisplayName = displayName === undefined ? existing.displayName : displayName;
    const resultingUsername = username === undefined ? existing.username : username;

    try {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(displayName !== undefined ? { displayName } : {}),
          ...(username !== undefined ? { username } : {}),
          ...(bio !== undefined ? { bio } : {}),
          ...(location !== undefined ? { location } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          onboardingCompleted: Boolean(resultingDisplayName && resultingUsername)
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("That username is already taken");
      }
      throw error;
    }
    return this.getBySubject(identity.subject);
  }

  private async findClaimableAssistedRegistration(identity: AuthIdentity) {
    const contactPredicates: Prisma.AgentAssistedRegistrationWhereInput[] = [];

    if (identity.email && identity.emailVerified) {
      contactPredicates.push({
        principal: {
          email: {
            equals: identity.email,
            mode: "insensitive"
          }
        }
      });
    }

    if (identity.phone && identity.phoneVerified) {
      contactPredicates.push({
        principal: {
          phone: identity.phone
        }
      });
    }

    if (contactPredicates.length === 0) return null;

    const matches = await this.prisma.agentAssistedRegistration.findMany({
      where: {
        status: "ACTIVE",
        principal: {
          authSubject: { startsWith: "assisted:" }
        },
        OR: contactPredicates
      },
      include: {
        principal: {
          select: {
            id: true,
            email: true,
            phone: true
          }
        }
      },
      take: 2
    });

    if (matches.length > 1) {
      throw new BadRequestException(
        "More than one assisted Hustle identity matches this verified contact. Contact Hustle support before continuing."
      );
    }

    return matches[0] ?? null;
  }

  private async getBySubject(subject: string) {
    const account = await this.prisma.user.findUnique({
      where: { authSubject: subject },
      include: { capabilities: { orderBy: { enabledAt: "asc" } } }
    });
    if (!account) throw new NotFoundException("Hustle account not synchronized");
    return account;
  }

  private optionalText(value: unknown, field: string, max: number): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > max) throw new BadRequestException(`${field} is too long`);
    return normalized;
  }

  private optionalUsername(value: unknown): string | null | undefined {
    const normalized = this.optionalText(value, "username", 30);
    if (normalized === undefined || normalized === null) return normalized;
    const username = normalized.toLowerCase();
    if (username.length < 3 || !/^[a-z0-9._]+$/.test(username)) {
      throw new BadRequestException("Username must be 3–30 characters using letters, numbers, dots or underscores");
    }
    return username;
  }

  private optionalUrl(value: unknown): string | null | undefined {
    const normalized = this.optionalText(value, "avatarUrl", 500);
    if (normalized === undefined || normalized === null) return normalized;
    try { return new URL(normalized).toString(); } catch { throw new BadRequestException("avatarUrl must be a valid URL"); }
  }
}

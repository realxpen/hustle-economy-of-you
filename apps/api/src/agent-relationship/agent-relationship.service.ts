import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgentPermissionScope,
  AgentRelationshipStatus,
  Capability
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface CreateAgentInvitationInput {
  agentUsername?: unknown;
  permissions?: unknown;
}

export interface UpdateAgentPermissionsInput {
  permissions?: unknown;
}

const partySelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  location: true
} as const;

@Injectable()
export class AgentRelationshipService {
  constructor(private readonly prisma: PrismaService) {}

  async listForHustler(identity: AuthIdentity) {
    const hustler = await this.requireActiveUser(identity, Capability.HUSTLER);
    return this.prisma.agentRelationship.findMany({
      where: { hustlerUserId: hustler.id },
      include: {
        hustler: { select: partySelect },
        agent: { select: partySelect },
        permissions: {
          where: { active: true },
          orderBy: { scope: "asc" }
        }
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });
  }

  async invite(identity: AuthIdentity, input: CreateAgentInvitationInput) {
    const hustler = await this.requireActiveUser(identity, Capability.HUSTLER);
    const username = this.requiredUsername(input.agentUsername);
    const permissions = this.requiredPermissions(input.permissions);

    const agent = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
        capabilities: {
          some: {
            capability: Capability.AGENT,
            status: "ACTIVE"
          }
        }
      },
      select: { blockerUserId: true }
    });

    if (!agent) {
      throw new NotFoundException("No ACTIVE Hustle Agent was found with that username");
    }
    if (agent.id === hustler.id) {
      throw new BadRequestException("You cannot create an Agent relationship with yourself");
    }

    await this.assertUsersNotBlocked(hustler.id, agent.id);

    const existing = await this.prisma.agentRelationship.findUnique({
      where: {
        hustlerUserId_agentUserId: {
          hustlerUserId: hustler.id,
          agentUserId: agent.id
        }
      }
    });

    if (
      existing?.status === AgentRelationshipStatus.PENDING ||
      existing?.status === AgentRelationshipStatus.ACTIVE
    ) {
      throw new BadRequestException(
        existing.status === AgentRelationshipStatus.ACTIVE
          ? "This Agent already represents you"
          : "An invitation to this Agent is already pending"
      );
    }

    const now = new Date();
    const relationshipId = await this.prisma.$transaction(async (tx) => {
      const relationship = existing
        ? await tx.agentRelationship.update({
            where: { id: existing.id },
            data: {
              status: AgentRelationshipStatus.PENDING,
              invitedAt: now,
              respondedAt: null,
              activatedAt: null,
              revokedAt: null,
              revokedByUserId: null
            }
          })
        : await tx.agentRelationship.create({
            data: {
              hustlerUserId: hustler.id,
              agentUserId: agent.id,
              status: AgentRelationshipStatus.PENDING,
              invitedAt: now
            }
          });

      await tx.agentPermissionGrant.updateMany({
        where: { relationshipId: relationship.id, active: true },
        data: { active: false, revokedAt: now }
      });

      for (const scope of permissions) {
        await tx.agentPermissionGrant.upsert({
          where: {
            relationshipId_scope: {
              relationshipId: relationship.id,
              scope
            }
          },
          create: {
            relationshipId: relationship.id,
            scope,
            active: true,
            grantedByUserId: hustler.id,
            grantedAt: now
          },
          update: {
            active: true,
            grantedByUserId: hustler.id,
            grantedAt: now,
            revokedAt: null
          }
        });
      }

      await tx.agentDelegationAudit.create({
        data: {
          relationshipId: relationship.id,
          actorUserId: hustler.id,
          ownerUserId: hustler.id,
          action: "agent_relationship.invited",
          metadata: { agentUserId: agent.id, permissions }
        }
      });

      await tx.systemEvent.create({
        data: {
          name: "agent_relationship.invited",
          source: "api",
          payload: {
            relationshipId: relationship.id,
            hustlerUserId: hustler.id,
            agentUserId: agent.id,
            permissions
          }
        }
      });

      return relationship.id;
    });

    return this.relationshipView(relationshipId);
  }

  async updatePermissions(
    identity: AuthIdentity,
    relationshipId: string,
    input: UpdateAgentPermissionsInput
  ) {
    const hustler = await this.requireActiveUser(identity, Capability.HUSTLER);
    const relationship = await this.requireHustlerRelationship(relationshipId, hustler.id);

    if (
      relationship.status !== AgentRelationshipStatus.PENDING &&
      relationship.status !== AgentRelationshipStatus.ACTIVE
    ) {
      throw new BadRequestException(
        "Permissions can only be changed on pending or active Agent relationships"
      );
    }

    const permissions = this.requiredPermissions(input.permissions);
    const current = await this.prisma.agentPermissionGrant.findMany({
      where: { relationshipId: relationship.id, active: true },
      select: { scope: true }
    });

    const previous = current.map((item) => item.scope).sort();
    const next = [...permissions].sort();

    if (
      previous.length === next.length &&
      previous.every((scope, index) => scope === next[index])
    ) {
      return this.relationshipView(relationship.id);
    }

    const previousSet = new Set(previous);
    const nextSet = new Set(next);
    const added = next.filter((scope) => !previousSet.has(scope));
    const removed = previous.filter((scope) => !nextSet.has(scope));
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (removed.length > 0) {
        await tx.agentPermissionGrant.updateMany({
          where: {
            relationshipId: relationship.id,
            scope: { in: removed },
            active: true
          },
          data: { active: false, revokedAt: now }
        });
      }

      for (const scope of added) {
        await tx.agentPermissionGrant.upsert({
          where: {
            relationshipId_scope: {
              relationshipId: relationship.id,
              scope
            }
          },
          create: {
            relationshipId: relationship.id,
            scope,
            active: true,
            grantedByUserId: hustler.id,
            grantedAt: now
          },
          update: {
            active: true,
            grantedByUserId: hustler.id,
            grantedAt: now,
            revokedAt: null
          }
        });
      }

      await tx.agentDelegationAudit.create({
        data: {
          relationshipId: relationship.id,
          actorUserId: hustler.id,
          ownerUserId: hustler.id,
          action: "agent_relationship.permissions_updated",
          metadata: { previous, next, added, removed }
        }
      });

      await tx.systemEvent.create({
        data: {
          name: "agent_relationship.permissions_updated",
          source: "api",
          payload: {
            relationshipId: relationship.id,
            hustlerUserId: hustler.id,
            agentUserId: relationship.agentUserId,
            previous,
            next,
            added,
            removed
          }
        }
      });
    });

    return this.relationshipView(relationship.id);
  }

  async revokeAsHustler(identity: AuthIdentity, relationshipId: string) {
    const hustler = await this.requireActiveUser(identity, Capability.HUSTLER);
    const relationship = await this.requireHustlerRelationship(relationshipId, hustler.id);

    if (relationship.status === AgentRelationshipStatus.REVOKED) {
      return this.relationshipView(relationship.id);
    }
    if (
      relationship.status !== AgentRelationshipStatus.PENDING &&
      relationship.status !== AgentRelationshipStatus.ACTIVE
    ) {
      throw new BadRequestException("This Agent relationship cannot be revoked");
    }

    await this.endRelationship(
      relationship.id,
      hustler.id,
      hustler.id,
      relationship.agentUserId,
      "agent_relationship.revoked_by_hustler"
    );

    return this.relationshipView(relationship.id);
  }

  async listForAgent(identity: AuthIdentity) {
    const agent = await this.requireActiveUser(identity, Capability.AGENT);
    return this.prisma.agentRelationship.findMany({
      where: { agentUserId: agent.id },
      include: {
        hustler: { select: partySelect },
        agent: { select: partySelect },
        permissions: {
          where: { active: true },
          orderBy: { scope: "asc" }
        }
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });
  }

  async accept(identity: AuthIdentity, relationshipId: string) {
    const agent = await this.requireActiveUser(identity, Capability.AGENT);
    const relationship = await this.requireAgentRelationship(relationshipId, agent.id);

    if (relationship.status !== AgentRelationshipStatus.PENDING) {
      throw new BadRequestException("Only pending Agent invitations can be accepted");
    }

    await this.requireCapabilityByUserId(relationship.hustlerUserId, Capability.HUSTLER);
    await this.assertUsersNotBlocked(relationship.hustlerUserId, agent.id);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.agentRelationship.update({
        where: { id: relationship.id },
        data: {
          status: AgentRelationshipStatus.ACTIVE,
          respondedAt: now,
          activatedAt: now,
          revokedAt: null,
          revokedByUserId: null
        }
      }),
      this.prisma.agentDelegationAudit.create({
        data: {
          relationshipId: relationship.id,
          actorUserId: agent.id,
          ownerUserId: relationship.hustlerUserId,
          action: "agent_relationship.accepted",
          metadata: { agentUserId: agent.id }
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "agent_relationship.accepted",
          source: "api",
          payload: {
            relationshipId: relationship.id,
            hustlerUserId: relationship.hustlerUserId,
            agentUserId: agent.id
          }
        }
      })
    ]);

    return this.relationshipView(relationship.id);
  }

  async decline(identity: AuthIdentity, relationshipId: string) {
    const agent = await this.requireActiveUser(identity, Capability.AGENT);
    const relationship = await this.requireAgentRelationship(relationshipId, agent.id);

    if (relationship.status !== AgentRelationshipStatus.PENDING) {
      throw new BadRequestException("Only pending Agent invitations can be declined");
    }

    const scopes = await this.activeScopes(relationship.id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.agentRelationship.update({
        where: { id: relationship.id },
        data: {
          status: AgentRelationshipStatus.DECLINED,
          respondedAt: now
        }
      }),
      this.prisma.agentPermissionGrant.updateMany({
        where: { relationshipId: relationship.id, active: true },
        data: { active: false, revokedAt: now }
      }),
      this.prisma.agentDelegationAudit.create({
        data: {
          relationshipId: relationship.id,
          actorUserId: agent.id,
          ownerUserId: relationship.hustlerUserId,
          action: "agent_relationship.declined",
          metadata: { agentUserId: agent.id, permissions: scopes }
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "agent_relationship.declined",
          source: "api",
          payload: {
            relationshipId: relationship.id,
            hustlerUserId: relationship.hustlerUserId,
            agentUserId: agent.id
          }
        }
      })
    ]);

    return this.relationshipView(relationship.id);
  }

  async leave(identity: AuthIdentity, relationshipId: string) {
    const agent = await this.requireActiveUser(identity, Capability.AGENT);
    const relationship = await this.requireAgentRelationship(relationshipId, agent.id);

    if (relationship.status === AgentRelationshipStatus.REVOKED) {
      return this.relationshipView(relationship.id);
    }
    if (relationship.status !== AgentRelationshipStatus.ACTIVE) {
      throw new BadRequestException("Only an active Agent relationship can be left");
    }

    await this.endRelationship(
      relationship.id,
      agent.id,
      relationship.hustlerUserId,
      agent.id,
      "agent_relationship.left_by_agent"
    );

    return this.relationshipView(relationship.id);
  }

  async assertAgentPermission(
    actorUserId: string,
    ownerUserId: string,
    scope: AgentPermissionScope
  ) {
    if (actorUserId === ownerUserId) {
      throw new ForbiddenException("Delegated permission requires a distinct Agent actor");
    }

    await Promise.all([
      this.requireCapabilityByUserId(actorUserId, Capability.AGENT),
      this.requireCapabilityByUserId(ownerUserId, Capability.HUSTLER)
    ]);
    await this.assertUsersNotBlocked(ownerUserId, actorUserId);

    const relationship = await this.prisma.agentRelationship.findFirst({
      where: {
        agentUserId: actorUserId,
        hustlerUserId: ownerUserId,
        status: AgentRelationshipStatus.ACTIVE,
        permissions: {
          some: { scope, active: true }
        }
      },
      select: { id: true }
    });

    if (!relationship) {
      throw new ForbiddenException(
        `Active Agent permission ${scope} is required for this Hustler`
      );
    }

    return relationship;
  }

  private async endRelationship(
    relationshipId: string,
    actorUserId: string,
    ownerUserId: string,
    agentUserId: string,
    action: string
  ) {
    const scopes = await this.activeScopes(relationshipId);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.agentRelationship.update({
        where: { id: relationshipId },
        data: {
          status: AgentRelationshipStatus.REVOKED,
          revokedAt: now,
          revokedByUserId: actorUserId
        }
      }),
      this.prisma.agentPermissionGrant.updateMany({
        where: { relationshipId, active: true },
        data: { active: false, revokedAt: now }
      }),
      this.prisma.agentDelegationAudit.create({
        data: {
          relationshipId,
          actorUserId,
          ownerUserId,
          action,
          metadata: { agentUserId, permissions: scopes }
        }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: action,
          source: "api",
          payload: {
            relationshipId,
            actorUserId,
            hustlerUserId: ownerUserId,
            agentUserId,
            permissions: scopes
          }
        }
      })
    ]);
  }

  private relationshipView(relationshipId: string) {
    return this.prisma.agentRelationship.findUniqueOrThrow({
      where: { id: relationshipId },
      include: {
        hustler: { select: partySelect },
        agent: { select: partySelect },
        permissions: {
          where: { active: true },
          orderBy: { scope: "asc" }
        }
      }
    });
  }

  private async requireHustlerRelationship(relationshipId: string, hustlerUserId: string) {
    const relationship = await this.prisma.agentRelationship.findFirst({
      where: {
        id: this.requiredId(relationshipId, "relationshipId"),
        hustlerUserId
      }
    });
    if (!relationship) throw new NotFoundException("Agent relationship not found");
    return relationship;
  }

  private async requireAgentRelationship(relationshipId: string, agentUserId: string) {
    const relationship = await this.prisma.agentRelationship.findFirst({
      where: {
        id: this.requiredId(relationshipId, "relationshipId"),
        agentUserId
      }
    });
    if (!relationship) throw new NotFoundException("Agent relationship not found");
    return relationship;
  }

  private async requireActiveUser(identity: AuthIdentity, capability: Capability) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        capabilities: {
          where: { capability },
          select: { status: true }
        }
      }
    });

    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    if (user.capabilities[0]?.status !== "ACTIVE") {
      throw new ForbiddenException(`ACTIVE ${capability} capability required`);
    }
    return user;
  }

  private async requireCapabilityByUserId(userId: string, capability: Capability) {
    const record = await this.prisma.userCapability.findUnique({
      where: { userId_capability: { userId, capability } },
      select: { status: true }
    });

    if (record?.status !== "ACTIVE") {
      throw new ForbiddenException(`ACTIVE ${capability} capability required`);
    }
  }

  private async assertUsersNotBlocked(firstUserId: string, secondUserId: string) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: firstUserId, blockedUserId: secondUserId },
          { blockerUserId: secondUserId, blockedUserId: firstUserId }
        ]
      },
      select: { id: true }
    });

    if (block) {
      throw new ForbiddenException(
        "An Agent relationship is unavailable because one user has blocked the other"
      );
    }
  }

  private async activeScopes(relationshipId: string) {
    const grants = await this.prisma.agentPermissionGrant.findMany({
      where: { relationshipId, active: true },
      select: { scope: true },
      orderBy: { scope: "asc" }
    });
    return grants.map((item) => item.scope);
  }

  private requiredUsername(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("agentUsername is required");
    }
    const username = value.trim().replace(/^@/, "");
    if (!username || username.length > 80) {
      throw new BadRequestException("agentUsername is required");
    }
    return username;
  }

  private requiredPermissions(value: unknown): AgentPermissionScope[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException("permissions must be a list");
    }

    const permissions: AgentPermissionScope[] = [];
    for (const item of value) {
      if (
        typeof item !== "string" ||
        !Object.values(AgentPermissionScope).includes(item as AgentPermissionScope)
      ) {
        throw new BadRequestException("Invalid Agent permission scope");
      }
      if (!permissions.includes(item as AgentPermissionScope)) {
        permissions.push(item as AgentPermissionScope);
      }
    }

    if (permissions.length === 0) {
      throw new BadRequestException("Select at least one Agent permission");
    }

    return permissions;
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }
}

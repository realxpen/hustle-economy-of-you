import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AdaptiveMemberRole, AdaptiveMemberStatus, AdaptiveWorkspaceKind, AdaptiveWorkStatus, Capability, CapabilityStatus, Prisma } from "@prisma/client";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";
import { ADAPTIVE_BLUEPRINTS, allowedWorkspacePermissions } from "./adaptive-blueprints";

type Data = Record<string, unknown>;

@Injectable()
export class AdaptiveService {
  constructor(private readonly db: PrismaService) {}
  private data(input: unknown): Data {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new BadRequestException("Expected a JSON object");
    return input as Data;
  }
  private text(value: unknown, field: string, min = 2, max = 120): string {
    if (typeof value !== "string" || value.trim().length < min || value.trim().length > max)
      throw new BadRequestException(field + " must have between " + min + " and " + max + " characters");
    return value.trim();
  }
  private int(value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 2000000000)
      throw new BadRequestException(field + " must be a safe, nonnegative integer");
    return value;
  }
  private async actor(identity: AuthIdentity) {
    const user = await this.db.user.findUnique({ where: { authSubject: identity.subject },
      select: { id: true, username: true } });
    if (!user) throw new NotFoundException("Sync your existing Hustle account before using My Economy");
    return user;
  }
  private async membership(userId: string, workspaceId: string, permission?: string) {
    const m = await this.db.adaptiveMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
    if (!m || m.status !== AdaptiveMemberStatus.ACTIVE)
      throw new ForbiddenException("No active membership in this workspace");
    if (permission && m.role !== AdaptiveMemberRole.OWNER && !m.permissions.includes(permission))
      throw new ForbiddenException("This workspace permission has not been granted");
    return m;
  }
  async workspaces(identity: AuthIdentity) {
    const user = await this.actor(identity);
    return this.db.adaptiveMembership.findMany({
      where: { userId: user.id, status: AdaptiveMemberStatus.ACTIVE },
      include: { workspace: true }, orderBy: { createdAt: "asc" }
    });
  }
  async provisionPersonal(identity: AuthIdentity) {
    const user = await this.actor(identity);
    return this.db.$transaction(async tx => {
      const space = await tx.adaptiveWorkspace.upsert({
        where: { ownerUserId_slug: { ownerUserId: user.id, slug: "personal" } },
        create: { ownerUserId: user.id, slug: "personal", name: "Personal",
          kind: AdaptiveWorkspaceKind.PERSONAL }, update: {}
      });
      await tx.adaptiveMembership.upsert({
        where: { workspaceId_userId: { workspaceId: space.id, userId: user.id } },
        create: { workspaceId: space.id, userId: user.id, invitedById: user.id,
          role: AdaptiveMemberRole.OWNER, status: AdaptiveMemberStatus.ACTIVE,
          acceptedAt: new Date(), permissions: [] },
        update: { role: AdaptiveMemberRole.OWNER, status: AdaptiveMemberStatus.ACTIVE,
          acceptedAt: new Date(), revokedAt: null }
      });
      return space;
    });
  }
  async createWorkspace(identity: AuthIdentity, raw: unknown) {
    const user = await this.actor(identity), d = this.data(raw);
    const name = this.text(d.name, "name", 3, 90);
    if (d.kind !== "BUSINESS" && d.kind !== "TEAM" && d.kind !== "AGENCY")
      throw new BadRequestException("Kind must be BUSINESS, TEAM or AGENCY");
    const slug = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,72);
    if (slug.length < 3) throw new BadRequestException("Use a readable business name");
    const category = d.category == null || d.category === "" ? null : this.text(d.category, "category", 2, 80);
    try {
      return await this.db.adaptiveWorkspace.create({
        data: { ownerUserId: user.id, name, slug, kind: d.kind, category,
          memberships: { create: { userId: user.id, invitedById: user.id,
            role: AdaptiveMemberRole.OWNER, status: AdaptiveMemberStatus.ACTIVE,
            acceptedAt: new Date(), permissions: [] } } }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("You already own a workspace with this name");
      throw error;
    }
  }
  async members(identity: AuthIdentity, workspaceId: string) {
    const user = await this.actor(identity);
    await this.membership(user.id, workspaceId);
    return this.db.adaptiveMembership.findMany({
      where: { workspaceId },
      select: { id: true, role: true, status: true, permissions: true,
        createdAt: true, acceptedAt: true,
        user: { select: { username: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" }
    });
  }
  async invite(identity: AuthIdentity, workspaceId: string, raw: unknown) {
    const user = await this.actor(identity), d = this.data(raw);
    const space = await this.db.adaptiveWorkspace.findUnique({ where: { id: workspaceId } });
    if (!space || space.ownerUserId !== user.id)
      throw new ForbiddenException("Only the owner can invite members");
    const username = this.text(d.username, "username", 3, 30);
    const role = this.text(d.role, "role", 3, 20).toUpperCase();
    if (!["MANAGER","WORKER","AGENT","ASSISTANT","ACCOUNTANT"].includes(role))
      throw new BadRequestException("Ownership and sensitive operations cannot be delegated");
    let permissions: string[];
    try { permissions = allowedWorkspacePermissions(d.permissions); }
    catch { throw new BadRequestException("Invalid permission scope"); }
    const invitee = await this.db.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, capabilities: { select: { capability: true, status: true } } }
    });
    if (!invitee) throw new NotFoundException("No Hustle user has that username");
    if (invitee.id === user.id) throw new BadRequestException("You cannot invite yourself");
    if (role === "AGENT" && !invitee.capabilities.some(c =>
      c.capability === Capability.AGENT && c.status === CapabilityStatus.ACTIVE))
      throw new ForbiddenException("An agent must have the approved AGENT capability");
    const grant = await this.db.adaptiveMembership.upsert({
      where: { workspaceId_userId: { workspaceId, userId: invitee.id } },
      create: { workspaceId, userId: invitee.id, invitedById: user.id,
        role: role as AdaptiveMemberRole, permissions, status: AdaptiveMemberStatus.INVITED },
      update: { invitedById: user.id, role: role as AdaptiveMemberRole,
        permissions, status: AdaptiveMemberStatus.INVITED, acceptedAt: null, revokedAt: null }
    });
    return { id: grant.id, role: grant.role, status: grant.status, permissions: grant.permissions };
  }
  async invitations(identity: AuthIdentity) {
    const user = await this.actor(identity);
    return this.db.adaptiveMembership.findMany({
      where: { userId: user.id, status: AdaptiveMemberStatus.INVITED },
      select: { id: true, role: true, permissions: true, createdAt: true,
        workspace: { select: { id: true, name: true, kind: true } } }
    });
  }
  async respond(identity: AuthIdentity, membershipId: string, accept: boolean) {
    const user = await this.actor(identity);
    const updated = await this.db.adaptiveMembership.updateMany({
      where: { id: membershipId, userId: user.id, status: AdaptiveMemberStatus.INVITED },
      data: accept ? { status: AdaptiveMemberStatus.ACTIVE, acceptedAt: new Date() }
        : { status: AdaptiveMemberStatus.REVOKED, revokedAt: new Date(), permissions: [] }
    });
    if (updated.count !== 1) throw new ConflictException("Invitation unavailable or already answered");
    return { status: accept ? "ACTIVE" : "REVOKED" };
  }
  async revoke(identity: AuthIdentity, workspaceId: string, memberId: string) {
    const user = await this.actor(identity);
    const space = await this.db.adaptiveWorkspace.findUnique({ where: { id: workspaceId } });
    if (space?.ownerUserId !== user.id) throw new ForbiddenException("Only the owner may revoke access");
    const updated = await this.db.adaptiveMembership.updateMany({
      where: { id: memberId, workspaceId, userId: { not: user.id },
        status: { in: [AdaptiveMemberStatus.INVITED, AdaptiveMemberStatus.ACTIVE] } },
      data: { status: AdaptiveMemberStatus.REVOKED, revokedAt: new Date(), permissions: [] }
    });
    if (updated.count !== 1) throw new ConflictException("Membership already inactive");
    return { status: "REVOKED" };
  }
  blueprints() {
    return ADAPTIVE_BLUEPRINTS.map(b => ({ ...b, status: "AVAILABLE_FOR_DRAFTS" }));
  }
  async services(identity: AuthIdentity, workspaceId: string) {
    const user = await this.actor(identity);
    await this.membership(user.id, workspaceId);
    return this.db.adaptiveServiceDraft.findMany({
      where: { workspaceId },
      include: { blueprint: { select: { slug: true, version: true, type: true } } },
      orderBy: { updatedAt: "desc" }
    });
  }
  async draftService(identity: AuthIdentity, workspaceId: string, raw: unknown) {
    const user = await this.actor(identity);
    await this.membership(user.id, workspaceId, "services.manage");
    const d = this.data(raw), title = this.text(d.title, "title", 3, 150);
    const priceMinor = this.int(d.priceMinor, "priceMinor");
    const template = ADAPTIVE_BLUEPRINTS.find(b => b.slug === d.blueprint);
    if (!template) throw new BadRequestException("Unknown blueprint type");
    const policy = d.policy ?? {};
    if (!policy || typeof policy !== "object" || Array.isArray(policy) ||
      JSON.stringify(policy).length > 10000)
      throw new BadRequestException("policy must be a small JSON object");
    const blueprint = await this.db.adaptiveBlueprint.upsert({
      where: { slug_version: { slug: template.slug, version: template.version } },
      update: {},
      create: { slug: template.slug, version: template.version, type: template.type,
        definition: { label: template.label, steps: [...template.steps], features: [...template.features] } }
    });
    return this.db.adaptiveServiceDraft.create({
      data: { workspaceId, blueprintId: blueprint.id, title, priceMinor,
        currency: "NGN", policy: policy as Prisma.InputJsonValue }
    });
  }
  async draftWork(identity: AuthIdentity, workspaceId: string, raw: unknown) {
    const user = await this.actor(identity);
    await this.membership(user.id, workspaceId, "work.manage");
    const d = this.data(raw), title = this.text(d.title, "title", 3, 150);
    const description = d.description == null ? "" : this.text(d.description, "description", 0, 2000);
    const serviceDraftId = d.serviceDraftId == null ? null :
      this.text(d.serviceDraftId, "serviceDraftId", 3, 120);
    if (serviceDraftId && !await this.db.adaptiveServiceDraft.findFirst({
      where: { id: serviceDraftId, workspaceId }, select: { id: true }
    })) throw new BadRequestException("Service draft belongs to another workspace");
    return this.db.$transaction(async tx => {
      const work = await tx.adaptiveWorkRecord.create({
        data: { workspaceId, clientUserId: user.id, serviceDraftId, title,
          status: AdaptiveWorkStatus.DRAFT, requirements: { description } }
      });
      await tx.adaptiveWorkEvent.create({ data: { workId: work.id, revision: 1,
        actorUserId: user.id, eventType: "work.draft_created", payload: {} } });
      return work;
    });
  }
  async cancelDraft(identity: AuthIdentity, workId: string, raw: unknown) {
    const user = await this.actor(identity), d = this.data(raw);
    const version = this.int(d.expectedVersion, "expectedVersion");
    const work = await this.db.adaptiveWorkRecord.findUnique({
      where: { id: workId }, select: { workspaceId: true }
    });
    if (!work) throw new NotFoundException("Work draft not found");
    await this.membership(user.id, work.workspaceId, "work.manage");
    return this.db.$transaction(async tx => {
      const changed = await tx.adaptiveWorkRecord.updateMany({
        where: { id: workId, workspaceId: work.workspaceId, version,
          status: AdaptiveWorkStatus.DRAFT },
        data: { status: AdaptiveWorkStatus.CANCELLED, version: { increment: 1 } }
      });
      if (changed.count !== 1) throw new ConflictException("Work draft changed or already cancelled");
      await tx.adaptiveWorkEvent.create({ data: { workId, actorUserId: user.id,
        revision: version + 1, eventType: "work.draft_cancelled", payload: {} } });
      return { id: workId, status: "CANCELLED", version: version + 1 };
    });
  }

  /** One honest read model; Booking and Order retain their original authoritative state. */
  async workHub(identity: AuthIdentity, workspaceId?: string) {
    const user = await this.actor(identity);
    const members = await this.db.adaptiveMembership.findMany({
      where: { userId: user.id, status: AdaptiveMemberStatus.ACTIVE },
      select: { workspaceId: true, workspace: { select: { kind: true } } }
    });
    const ids = members.map(m => m.workspaceId);
    if (workspaceId && !ids.includes(workspaceId))
      throw new ForbiddenException("No access to that workspace");
    const drafts = await this.db.adaptiveWorkRecord.findMany({
      where: { workspaceId: { in: workspaceId ? [workspaceId] : ids } },
      select: { id: true, workspaceId: true, title: true, status: true, version: true, updatedAt: true },
      orderBy: { updatedAt: "desc" }, take: 60
    });
    const items: Array<Record<string, unknown>> = drafts.map(w => ({
      id: "draft:" + w.id, source: "ADAPTIVE_DRAFT", title: w.title,
      status: w.status, updatedAt: w.updatedAt, version: w.version,
      workspaceId: w.workspaceId, canWrite: w.status === AdaptiveWorkStatus.DRAFT
    }));
    // No retroactive attribution of personal bookings/orders to arbitrary businesses.
    const personal = !workspaceId || members.some(m =>
      m.workspaceId === workspaceId && m.workspace.kind === AdaptiveWorkspaceKind.PERSONAL);
    if (personal) {
      const [bookings, orders] = await Promise.all([
        this.db.booking.findMany({
          where: { OR: [{ clientUserId: user.id }, { hustlerUserId: user.id }] },
          select: { id: true, serviceTitleSnapshot: true, status: true, updatedAt: true,
            clientUserId: true, agreedPriceMinor: true },
          orderBy: { updatedAt: "desc" }, take: 60
        }),
        this.db.order.findMany({
          where: { OR: [{ buyerUserId: user.id }, { sellerUserId: user.id }] },
          select: { id: true, status: true, updatedAt: true, buyerUserId: true, totalMinor: true },
          orderBy: { updatedAt: "desc" }, take: 60
        })
      ]);
      items.push(...bookings.map(b => ({
        id: "booking:" + b.id, source: "BOOKING", title: b.serviceTitleSnapshot,
        status: b.status, updatedAt: b.updatedAt, amountMinor: b.agreedPriceMinor,
        role: b.clientUserId === user.id ? "CLIENT" : "HUSTLER",
        canonicalPath: "/bookings/" + b.id, canWrite: false
      })));
      items.push(...orders.map(o => ({
        id: "order:" + o.id, source: "ORDER", title: "Product order " + o.id,
        status: o.status, updatedAt: o.updatedAt, amountMinor: o.totalMinor,
        role: o.buyerUserId === user.id ? "BUYER" : "SELLER",
        canonicalPath: "/orders/" + o.id, canWrite: false
      })));
    }
    items.sort((a,b) => new Date(String(b.updatedAt)).getTime() - new Date(String(a.updatedAt)).getTime());
    return { items: items.slice(0,100), nextCursor: null };
  }
}

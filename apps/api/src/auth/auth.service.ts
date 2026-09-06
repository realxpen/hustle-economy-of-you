import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
    const account = await this.prisma.user.upsert({
      where: { authSubject: identity.subject },
      update: {
        email: identity.email ?? null,
        phone: identity.phone ?? null,
        emailVerified: identity.emailVerified,
        phoneVerified: identity.phoneVerified
      },
      create: {
        authSubject: identity.subject,
        email: identity.email ?? null,
        phone: identity.phone ?? null,
        emailVerified: identity.emailVerified,
        phoneVerified: identity.phoneVerified,
        capabilities: { create: { capability: "CLIENT", status: "ACTIVE" } }
      }
    });

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
    const existing = await this.prisma.user.findUnique({ where: { authSubject: identity.subject }, select: { id: true } });
    if (!existing) throw new NotFoundException("Hustle account not synchronized");

    const displayName = this.optionalText(input.displayName, "displayName", 80);
    const username = this.optionalUsername(input.username);
    const bio = this.optionalText(input.bio, "bio", 300);
    const location = this.optionalText(input.location, "location", 120);
    const avatarUrl = this.optionalUrl(input.avatarUrl);

    try {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(displayName !== undefined ? { displayName } : {}),
          ...(username !== undefined ? { username } : {}),
          ...(bio !== undefined ? { bio } : {}),
          ...(location !== undefined ? { location } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          onboardingCompleted: Boolean(displayName && username)
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        throw new BadRequestException("That username is already taken");
      }
      throw error;
    }
    return this.getBySubject(identity.subject);
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

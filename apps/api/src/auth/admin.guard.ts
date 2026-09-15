import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";

type AuthenticatedRequest = Request & { authIdentity?: AuthIdentity };

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authIdentity) throw new ForbiddenException("Authenticated identity required");

    const account = await this.prisma.user.findUnique({
      where: { authSubject: request.authIdentity.subject },
      select: { id: true }
    });
    if (!account) throw new ForbiddenException("Hustle account not synchronized");

    const allowed = new Set(
      (process.env.HUSTLE_ADMIN_USER_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );

    if (!allowed.has(account.id)) {
      throw new ForbiddenException("Hustle admin access required");
    }

    return true;
  }
}

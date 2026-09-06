import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Capability } from "@prisma/client";
import type { Request } from "express";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";
import { REQUIRED_CAPABILITY } from "./capability.decorator";

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Capability>(REQUIRED_CAPABILITY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request & { authIdentity?: AuthIdentity }>();
    if (!request.authIdentity) throw new ForbiddenException("Authenticated identity required");

    const account = await this.prisma.user.findUnique({ where: { authSubject: request.authIdentity.subject }, select: { id: true } });
    if (!account) throw new ForbiddenException("Hustle account not synchronized");

    const capability = await this.prisma.userCapability.findUnique({
      where: { userId_capability: { userId: account.id, capability: required } },
      select: { status: true }
    });
    if (capability?.status !== "ACTIVE") throw new ForbiddenException(`${required} capability required`);
    return true;
  }
}

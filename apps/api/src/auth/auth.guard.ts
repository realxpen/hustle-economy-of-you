import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AUTH_PORT, type AuthIdentity, type AuthPort } from "../infrastructure/auth/auth.port";

type AuthenticatedRequest = Request & { authIdentity?: AuthIdentity };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH_PORT) private readonly auth: AuthPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("Bearer access token required");
    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedException("Bearer access token required");
    request.authIdentity = await this.auth.verifyAccessToken(token);
    return true;
  }
}

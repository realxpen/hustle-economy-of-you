import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

import type { AuthIdentity } from "../infrastructure/auth/auth.port";

type AuthenticatedRequest = Request & { authIdentity?: AuthIdentity };

@Injectable()
export class HustleReviewerGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const identity = request.authIdentity;

    if (!identity?.email || !identity.emailVerified) {
      throw new ForbiddenException("A verified reviewer email is required");
    }

    const reviewers = (this.config.get<string>("HUSTLE_REVIEWER_EMAILS") ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (reviewers.length === 0) {
      throw new ForbiddenException("Hustle reviewer access is not configured");
    }

    if (!reviewers.includes(identity.email.toLowerCase())) {
      throw new ForbiddenException("This identity is not authorized to review Hustler applications");
    }

    return true;
  }
}

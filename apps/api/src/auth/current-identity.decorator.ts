import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export const CurrentIdentity = createParamDecorator((_data: unknown, context: ExecutionContext): AuthIdentity => {
  const request = context.switchToHttp().getRequest<Request & { authIdentity: AuthIdentity }>();
  return request.authIdentity;
});

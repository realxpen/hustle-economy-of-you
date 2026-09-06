import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { AuthGuard } from "./auth.guard";
import { AuthService, type UpdateProfileInput } from "./auth.service";
import { CurrentIdentity } from "./current-identity.decorator";

@Controller("auth")
@UseGuards(AuthGuard)
export class AuthController {
  constructor(private readonly accounts: AuthService) {}

  @Post("sync")
  sync(@CurrentIdentity() identity: AuthIdentity) {
    return this.accounts.sync(identity);
  }

  @Get("me")
  me(@CurrentIdentity() identity: AuthIdentity) {
    return this.accounts.me(identity);
  }

  @Patch("profile")
  updateProfile(@CurrentIdentity() identity: AuthIdentity, @Body() body: UpdateProfileInput) {
    return this.accounts.updateProfile(identity, body);
  }
}

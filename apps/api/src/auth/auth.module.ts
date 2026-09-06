import { Module } from "@nestjs/common";
import { AUTH_PORT } from "../infrastructure/auth/auth.port";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CapabilityGuard } from "./capability.guard";
import { SupabaseAuthService } from "./supabase-auth.service";

@Module({
  controllers: [AuthController],
  providers: [
    SupabaseAuthService,
    { provide: AUTH_PORT, useExisting: SupabaseAuthService },
    AuthGuard,
    CapabilityGuard,
    AuthService
  ],
  exports: [AuthGuard, CapabilityGuard, AuthService]
})
export class AuthModule {}

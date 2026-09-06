import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthIdentity, AuthPort } from "../infrastructure/auth/auth.port";

@Injectable()
export class SupabaseAuthService implements AuthPort {
  private readonly client: SupabaseClient | null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    this.client = url && key
      ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
      : null;
  }

  async verifyAccessToken(token: string): Promise<AuthIdentity> {
    if (!this.client) throw new UnauthorizedException("Hustle authentication is not configured");
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException("Invalid or expired access token");

    const user = data.user;
    return {
      subject: user.id,
      email: user.email,
      phone: user.phone,
      emailVerified: Boolean(user.email_confirmed_at),
      phoneVerified: Boolean(user.phone_confirmed_at)
    };
  }
}

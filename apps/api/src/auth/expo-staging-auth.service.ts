import { UnauthorizedException } from "@nestjs/common";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { expo } from "@better-auth/expo";
import { PrismaClient } from "@hustle/staging-auth-client";
import type { AuthPort, AuthIdentity } from "../infrastructure/auth/auth.port";

/** Factory is also exercised against a disposable database, with no production access. */
export function createExpoStagingAuth(database: PrismaClient, config: {
  baseURL: string; secret: string; allowedEmails: string[];
}) {
  const allowed = new Set(config.allowedEmails.map(email => email.trim().toLowerCase()));
  return betterAuth({
    appName: "Hustle isolated test",
    baseURL: config.baseURL,
    basePath: "/api/auth",
    secret: config.secret,
    database: prismaAdapter(database, { provider: "postgresql" }),
    trustedOrigins: [new URL(config.baseURL).origin, "hustle-preview://"],
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 24, updateAge: 60 * 60, cookieCache: { enabled: false } },
    account: { accountLinking: { enabled: false } },
    advanced: { cookiePrefix: "hustle-staging", useSecureCookies: new URL(config.baseURL).protocol === "https:" },
    rateLimit: { enabled: true, storage: "database", modelName: "rateLimit", window: 60, max: 30 },
    databaseHooks: {
      user: { create: { before: async user => {
        if (!allowed.has(user.email.trim().toLowerCase())) {
          throw new APIError("FORBIDDEN", { message: "This internal test is limited to invited test accounts." });
        }
        return { data: user };
      } } }
    },
    // Native cookie transport and existing API Bearer AuthPort use official plugins.
    plugins: [expo(), bearer()],
    logger: { disabled: true }
  });
}

export type ExpoStagingAuth = ReturnType<typeof createExpoStagingAuth>;
let runtime: { auth: ExpoStagingAuth; database: PrismaClient } | undefined;

export function getExpoStagingAuth() {
  if (!runtime) {
    const database = new PrismaClient({ datasources: { db: { url: process.env.STAGING_AUTH_DATABASE_URL } } });
    runtime = { database, auth: createExpoStagingAuth(database, {
      baseURL: process.env.BETTER_AUTH_URL!, secret: process.env.BETTER_AUTH_SECRET!,
      allowedEmails: process.env.HUSTLE_STAGING_TEST_EMAILS!.split(",")
    }) };
  }
  return runtime.auth;
}

export class ExpoStagingAuthService implements AuthPort {
  constructor(private readonly auth: () => ExpoStagingAuth = getExpoStagingAuth) {}

  async verifyAccessToken(token: string): Promise<AuthIdentity> {
    if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) throw new UnauthorizedException("Invalid staging session");
    try {
      const result = await this.auth().api.getSession({
        headers: new Headers({ authorization: `Bearer ${token}` }),
        query: { disableCookieCache: true }
      });
      if (!result || result.session.expiresAt.getTime() <= Date.now()) throw new Error("Expired");
      return { subject: result.user.id, email: result.user.email,
        emailVerified: result.user.emailVerified, phoneVerified: false };
    } catch {
      throw new UnauthorizedException("Invalid or expired staging session");
    }
  }
}

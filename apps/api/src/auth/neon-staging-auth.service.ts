import { createPublicKey, verify as verifySignature } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthIdentity, AuthPort } from "../infrastructure/auth/auth.port";

/**
 * Neon Better Auth's /token JWT is Ed25519/JWKS-verifiable, distinct from a
 * session cookie or opaque Better Auth session token. This staging-only port
 * intentionally accepts no Supabase JWTs, symmetric JWTs, mock bearers or
 * remote issuers provided by clients.
 */
const ISSUER = "https://ep-square-sea-zax0gyud.neonauth.c-2.eu-west-2.aws.neon.tech/hustle_staging/auth";
const JWKS = ISSUER + "/.well-known/jwks.json";
const MAX_TOKEN_BYTES = 8192;
const CLOCK_SKEW_SECONDS = 30;
const MAX_LIFETIME_SECONDS = 30 * 60;
const KEY_CACHE_MS = 5 * 60 * 1000;

type JsonObject = Record<string, unknown>;
type PublicJwk = JsonObject & { kty: string; crv: string; x: string; kid: string };

function reject(): never {
  throw new UnauthorizedException("Invalid or expired staging access token");
}
function decodeJson(part: string): JsonObject {
  if (part.length < 2 || !/^[A-Za-z0-9_-]+$/.test(part)) return reject();
  let result: unknown;
  try {
    result = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return reject();
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) return reject();
  return result as JsonObject;
}
function validAudience(audience: unknown): boolean {
  return audience === ISSUER ||
    (Array.isArray(audience) && audience.length > 0 && audience.length <= 4 &&
      audience.every(value => value === ISSUER));
}

@Injectable()
export class NeonStagingAuthService implements AuthPort {
  private cachedKeys: PublicJwk[] = [];
  private fetchedAt = 0;
  private readonly getJwks: typeof fetch;

  constructor(fetcher: typeof fetch = globalThis.fetch) {
    this.getJwks = fetcher;
  }

  private async loadKeys(force = false): Promise<PublicJwk[]> {
    if (!force && this.cachedKeys.length && Date.now() - this.fetchedAt < KEY_CACHE_MS) {
      return this.cachedKeys;
    }
    let response: Response;
    try {
      response = await this.getJwks(JWKS, {
        method: "GET", redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(4000)
      });
    } catch { return reject(); }
    if (!response.ok) return reject();
    if (Number(response.headers.get("content-length") || 0) > 32768) return reject();
    let body: unknown;
    try {
      const raw = await response.text();
      if (raw.length > 32768) return reject();
      body = JSON.parse(raw);
    } catch { return reject(); }
    const keys = (body as { keys?: unknown } | null)?.keys;
    if (!Array.isArray(keys) || !keys.length || keys.length > 16) return reject();
    const valid: PublicJwk[] = [];
    const kids = new Set<string>();
    for (const entry of keys) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return reject();
      const key = entry as JsonObject;
      if (key.kty !== "OKP" || key.crv !== "Ed25519" ||
          typeof key.x !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(key.x) ||
          typeof key.kid !== "string" || key.kid.length > 128 || !key.kid ||
          key.d !== undefined || (key.alg !== undefined && key.alg !== "EdDSA") ||
          (key.use !== undefined && key.use !== "sig") || kids.has(key.kid)) return reject();
      kids.add(key.kid);
      valid.push(key as PublicJwk);
    }
    this.cachedKeys = valid;
    this.fetchedAt = Date.now();
    return valid;
  }

  async verifyAccessToken(token: string): Promise<AuthIdentity> {
    if (typeof token !== "string" || token.length > MAX_TOKEN_BYTES) return reject();
    const segments = token.split(".");
    if (segments.length !== 3) return reject();
    const [head, payloadPart, signaturePart] = segments;
    const header = decodeJson(head);
    const claims = decodeJson(payloadPart);
    if (header.alg !== "EdDSA" || typeof header.kid !== "string" ||
        !header.kid || header.kid.length > 128 ||
        (header.typ !== undefined && header.typ !== "JWT") ||
        header.crit !== undefined || !/^[A-Za-z0-9_-]{85,87}$/.test(signaturePart)) return reject();
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== ISSUER || !validAudience(claims.aud) ||
        typeof claims.sub !== "string" || !claims.sub.trim() || claims.sub.length > 256 ||
        !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) ||
        (claims.iat as number) > now + CLOCK_SKEW_SECONDS ||
        (claims.exp as number) <= now - CLOCK_SKEW_SECONDS ||
        (claims.exp as number) <= (claims.iat as number) ||
        (claims.exp as number) - (claims.iat as number) > MAX_LIFETIME_SECONDS ||
        (claims.nbf !== undefined &&
          (!Number.isInteger(claims.nbf) || (claims.nbf as number) > now + CLOCK_SKEW_SECONDS))) return reject();
    let keys = await this.loadKeys();
    let key = keys.find(value => value.kid === header.kid);
    if (!key) {
      keys = await this.loadKeys(true);
      key = keys.find(value => value.kid === header.kid);
    }
    if (!key) return reject();
    try {
      const publicKey = createPublicKey({ key, format: "jwk" });
      const signed = Buffer.from(head + "." + payloadPart);
      const signature = Buffer.from(signaturePart, "base64url");
      if (signature.length !== 64 || !verifySignature(null, signed, publicKey, signature)) return reject();
    } catch { return reject(); }
    const email = typeof claims.email === "string" && claims.email.length <= 256
      ? claims.email : undefined;
    const phone = typeof claims.phone === "string" && claims.phone.length <= 30
      ? claims.phone : undefined;
    return {
      subject: claims.sub as string,
      email,
      phone,
      emailVerified: claims.email_verified === true || claims.emailVerified === true,
      phoneVerified: claims.phone_verified === true || claims.phoneVerified === true
    };
  }
}

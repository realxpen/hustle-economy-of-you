import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  Capability,
  CapabilityStatus,
  LiveSessionStatus,
  Prisma,
  ProfessionalProfileStatus
} from "@prisma/client";
import { createHash, createHmac, randomUUID } from "node:crypto";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export const LIVE_MEDIA_PRESENCE_WINDOW_MS = 35_000;
const LIVE_MEDIA_TOKEN_TTL_SECONDS = 10 * 60;

export interface LiveMediaViewerInput {
  viewerKey?: unknown;
}

export interface LiveMediaPresenceInput {
  connected?: unknown;
}

type LiveKitConfig = {
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
};

@Injectable()
export class LiveMediaService {
  constructor(private readonly prisma: PrismaService) {}

  isConfigured() {
    return Boolean(
      process.env.LIVEKIT_URL?.trim()
      && process.env.LIVEKIT_API_KEY?.trim()
      && process.env.LIVEKIT_API_SECRET?.trim()
    );
  }

  descriptor(playbackUrl: string | null, nativeBroadcasting: boolean) {
    const configured = this.isConfigured();
    return {
      provider: configured ? "LIVEKIT" : playbackUrl ? "EXTERNAL" : "NONE",
      playbackUrl,
      ready: nativeBroadcasting || Boolean(playbackUrl),
      nativeTransportAvailable: configured,
      nativeBroadcasting
    };
  }

  async issuePublishCredential(identity: AuthIdentity, liveIdInput: string) {
    const config = this.requireConfig();
    const host = await this.requireHost(identity);
    const session = await this.requireOwnedSession(host.id, liveIdInput);

    if (session.status !== LiveSessionStatus.DRAFT && session.status !== LiveSessionStatus.LIVE) {
      throw new BadRequestException("Ended Live sessions cannot issue publishing credentials");
    }

    const roomName = this.roomName(session.id);
    const participantIdentity = `host:${host.id}`;
    const credential = this.createToken(config, {
      identity: participantIdentity,
      roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishSources: ["camera", "microphone"]
    });

    await this.event("live.media_publish_authorized", {
      liveId: session.id,
      hostUserId: host.id,
      provider: "LIVEKIT",
      expiresAt: credential.expiresAt
    });

    return {
      provider: "LIVEKIT" as const,
      serverUrl: config.serverUrl,
      participantToken: credential.token,
      expiresAt: credential.expiresAt,
      ttlSeconds: LIVE_MEDIA_TOKEN_TTL_SECONDS,
      role: "HOST" as const
    };
  }

  async issueViewerCredential(liveIdInput: string, input: LiveMediaViewerInput) {
    const config = this.requireConfig();
    const liveId = this.requiredId(liveIdInput, "liveId");
    const session = await this.prisma.liveSession.findUnique({
      where: { id: liveId },
      select: { id: true, status: true }
    });

    if (!session || session.status !== LiveSessionStatus.LIVE) {
      throw new NotFoundException("Live session is not active");
    }

    const viewerKey = this.requiredViewerKey(input.viewerKey);
    const opaqueViewer = createHash("sha256").update(viewerKey).digest("hex").slice(0, 32);
    const credential = this.createToken(config, {
      identity: `viewer:${opaqueViewer}`,
      roomName: this.roomName(session.id),
      canPublish: false,
      canSubscribe: true
    });

    return {
      provider: "LIVEKIT" as const,
      serverUrl: config.serverUrl,
      participantToken: credential.token,
      expiresAt: credential.expiresAt,
      ttlSeconds: LIVE_MEDIA_TOKEN_TTL_SECONDS,
      role: "VIEWER" as const
    };
  }

  async recordHostPresence(
    identity: AuthIdentity,
    liveIdInput: string,
    input: LiveMediaPresenceInput
  ) {
    const host = await this.requireHost(identity);
    const session = await this.requireOwnedSession(host.id, liveIdInput);

    if (session.status !== LiveSessionStatus.DRAFT && session.status !== LiveSessionStatus.LIVE) {
      throw new BadRequestException("Ended Live sessions cannot publish media presence");
    }
    if (typeof input.connected !== "boolean") {
      throw new BadRequestException("connected must be true or false");
    }

    if (input.connected) {
      const now = new Date();
      await this.prisma.liveMediaPresence.upsert({
        where: { sessionId: session.id },
        create: {
          sessionId: session.id,
          connectedAt: now,
          lastSeenAt: now
        },
        update: { lastSeenAt: now }
      });
    } else {
      await this.prisma.liveMediaPresence.deleteMany({
        where: { sessionId: session.id }
      });
    }

    return {
      recorded: true,
      connected: input.connected,
      liveId: session.id
    };
  }

  async clearPresence(liveId: string) {
    await this.prisma.liveMediaPresence.deleteMany({ where: { sessionId: liveId } });
  }

  private requireConfig(): LiveKitConfig {
    const serverUrl = process.env.LIVEKIT_URL?.trim() ?? "";
    const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";

    if (!serverUrl || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        "Native Live media is not configured. LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required on the API."
      );
    }

    let url: URL;
    try {
      url = new URL(serverUrl);
    } catch {
      throw new ServiceUnavailableException("LIVEKIT_URL must be a valid ws:// or wss:// URL");
    }
    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
      throw new ServiceUnavailableException("LIVEKIT_URL must use ws:// or wss://");
    }
    if (
      process.env.NODE_ENV === "production"
      && url.protocol !== "wss:"
      && url.hostname !== "localhost"
      && url.hostname !== "127.0.0.1"
    ) {
      throw new ServiceUnavailableException("Production LiveKit transport must use wss://");
    }

    return { serverUrl: url.toString().replace(/\/$/, ""), apiKey, apiSecret };
  }

  private createToken(
    config: LiveKitConfig,
    input: {
      identity: string;
      roomName: string;
      canPublish: boolean;
      canSubscribe: boolean;
      canPublishSources?: string[];
    }
  ) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = now + LIVE_MEDIA_TOKEN_TTL_SECONDS;
    const header = { alg: "HS256", typ: "JWT" };
    const video: Record<string, unknown> = {
      roomJoin: true,
      room: input.roomName,
      canPublish: input.canPublish,
      canSubscribe: input.canSubscribe,
      canPublishData: false
    };
    if (input.canPublishSources?.length) {
      video.canPublishSources = input.canPublishSources;
    }

    const payload = {
      iss: config.apiKey,
      sub: input.identity,
      iat: now,
      nbf: now - 5,
      exp: expiresAtSeconds,
      jti: randomUUID(),
      video
    };
    const encodedHeader = this.base64UrlJson(header);
    const encodedPayload = this.base64UrlJson(payload);
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac("sha256", config.apiSecret)
      .update(unsigned)
      .digest("base64url");

    return {
      token: `${unsigned}.${signature}`,
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
    };
  }

  private base64UrlJson(value: unknown) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  }

  private roomName(liveId: string) {
    return `hustle-live:${liveId}`;
  }

  private async requireHost(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        capabilities: {
          where: { capability: Capability.HUSTLER, status: CapabilityStatus.ACTIVE },
          select: { id: true }
        },
        professionalProfile: { select: { status: true } }
      }
    });

    if (!user) throw new ForbiddenException("Hustle account is required");
    if (
      user.capabilities.length === 0
      || user.professionalProfile?.status !== ProfessionalProfileStatus.PUBLISHED
    ) {
      throw new ForbiddenException(
        "An active Hustler with a published professional profile is required to host Live"
      );
    }
    return user;
  }

  private async requireOwnedSession(hostUserId: string, liveIdInput: string) {
    const liveId = this.requiredId(liveIdInput, "liveId");
    const session = await this.prisma.liveSession.findUnique({
      where: { id: liveId },
      select: { id: true, hostUserId: true, status: true }
    });

    if (!session) throw new NotFoundException("Live session not found");
    if (session.hostUserId !== hostUserId) {
      throw new ForbiddenException("Only the Live host can manage this session");
    }
    return session;
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private requiredViewerKey(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("viewerKey is required");
    }
    const key = value.trim();
    if (key.length > 160) throw new BadRequestException("viewerKey is too long");
    return key;
  }

  private async event(name: string, payload: Prisma.InputJsonObject) {
    await this.prisma.systemEvent.create({
      data: { name, source: "api", payload }
    });
  }
}

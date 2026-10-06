import { Injectable } from "@nestjs/common";
import { LiveSessionStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

const DEFAULT_LIVE_INACTIVITY_MINUTES = 120;
const MIN_LIVE_INACTIVITY_MINUTES = 15;
const MAX_LIVE_INACTIVITY_MINUTES = 24 * 60;

@Injectable()
export class LiveLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async expireStaleLiveSessions() {
    const now = new Date();
    const timeoutMinutes = this.inactivityMinutes();
    const cutoff = new Date(now.getTime() - timeoutMinutes * 60_000);

    const candidates = await this.prisma.liveSession.findMany({
      where: {
        status: LiveSessionStatus.LIVE,
        startedAt: { lte: cutoff },
        updatedAt: { lte: cutoff }
      },
      select: {
        id: true,
        hostUserId: true,
        startedAt: true,
        updatedAt: true,
        mediaPresence: { select: { lastSeenAt: true } }
      }
    });

    const stale = candidates.filter((session) => {
      const lastMediaSeenAt = session.mediaPresence?.lastSeenAt;
      return !lastMediaSeenAt || lastMediaSeenAt <= cutoff;
    });

    if (stale.length === 0) return { expired: 0, timeoutMinutes };

    const ids = stale.map((session) => session.id);
    await this.prisma.$transaction([
      this.prisma.liveSession.updateMany({
        where: {
          id: { in: ids },
          status: LiveSessionStatus.LIVE
        },
        data: {
          status: LiveSessionStatus.ENDED,
          endedAt: now
        }
      }),
      this.prisma.liveMediaPresence.deleteMany({
        where: { sessionId: { in: ids } }
      })
    ]);

    await Promise.all(stale.map((session) => this.event("live.auto_ended_inactive", {
      liveId: session.id,
      hostUserId: session.hostUserId,
      startedAt: session.startedAt?.toISOString() ?? null,
      lastSessionActivityAt: session.updatedAt.toISOString(),
      timeoutMinutes,
      endedAt: now.toISOString()
    })));

    return { expired: stale.length, timeoutMinutes };
  }

  private inactivityMinutes() {
    const configured = Number(process.env.LIVE_INACTIVITY_TIMEOUT_MINUTES);
    if (!Number.isFinite(configured) || configured <= 0) {
      return DEFAULT_LIVE_INACTIVITY_MINUTES;
    }
    return Math.min(
      MAX_LIVE_INACTIVITY_MINUTES,
      Math.max(MIN_LIVE_INACTIVITY_MINUTES, Math.floor(configured))
    );
  }

  private async event(name: string, payload: Prisma.InputJsonObject) {
    await this.prisma.systemEvent.create({
      data: { name, source: "api", payload }
    });
  }
}

import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

const allowedSources = new Set(["mobile", "web", "admin", "api"]);

export interface CaptureEventInput {
  name?: unknown;
  source?: unknown;
  occurredAt?: unknown;
  payload?: unknown;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async capture(input: CaptureEventInput) {
    if (!process.env.DATABASE_URL) {
      throw new BadRequestException("Analytics persistence requires DATABASE_URL");
    }
    if (typeof input.name !== "string" || input.name.length < 1 || input.name.length > 120) {
      throw new BadRequestException("Invalid analytics event name");
    }
    if (typeof input.source !== "string" || !allowedSources.has(input.source)) {
      throw new BadRequestException("Invalid analytics event source");
    }
    const occurredAt = typeof input.occurredAt === "string" ? new Date(input.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException("Invalid occurredAt");

    const payload = input.payload && typeof input.payload === "object" ? input.payload : undefined;
    return this.prisma.systemEvent.create({
      data: { name: input.name, source: input.source, occurredAt, payload: payload as object | undefined },
      select: { id: true, name: true, source: true, occurredAt: true }
    });
  }
}

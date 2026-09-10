import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export type SearchObservationEventName =
  | "search.performed"
  | "search.zero_results"
  | "search.result_clicked";

export type MarketplaceObservationEventName =
  | "marketplace.viewed"
  | "marketplace.result_clicked";

export interface SearchObservationInput {
  name?: unknown;
  source?: unknown;
  query?: unknown;
  tab?: unknown;
  filters?: unknown;
  resultCount?: unknown;
  resultType?: unknown;
  resultId?: unknown;
  resultUrl?: unknown;
  position?: unknown;
  sessionId?: unknown;
}

const searchEvents = new Set<SearchObservationEventName>([
  "search.performed",
  "search.zero_results",
  "search.result_clicked"
]);

const marketplaceEvents = new Set<MarketplaceObservationEventName>([
  "marketplace.viewed",
  "marketplace.result_clicked"
]);

const resultTypes = new Set(["person", "post", "service", "product"]);

@Injectable()
export class SearchObservationService {
  constructor(private readonly prisma: PrismaService) {}

  recordSearch(identity: AuthIdentity, input: SearchObservationInput) {
    const name = this.requireEventName(input.name, searchEvents, "search");
    return this.record(identity, name, input);
  }

  recordMarketplace(identity: AuthIdentity, input: SearchObservationInput) {
    const name = this.requireEventName(input.name, marketplaceEvents, "marketplace");
    return this.record(identity, name, input);
  }

  private async record(
    identity: AuthIdentity,
    name: SearchObservationEventName | MarketplaceObservationEventName,
    input: SearchObservationInput
  ) {
    const viewer = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });

    if (!viewer) throw new NotFoundException("Hustle account is not synchronized");

    const source = this.optionalSource(input.source) ?? "web";
    const query = this.optionalText(input.query, "query", 240);
    const tab = this.optionalText(input.tab, "tab", 40);
    const sessionId = this.optionalText(input.sessionId, "sessionId", 160);
    const resultType = this.optionalResultType(input.resultType);
    const resultId = this.optionalText(input.resultId, "resultId", 160);
    const resultUrl = this.optionalText(input.resultUrl, "resultUrl", 1000);
    const position = this.optionalInteger(input.position, "position", 0, 10_000);
    const resultCount = this.optionalInteger(input.resultCount, "resultCount", 0, 100_000);
    const filters = this.optionalFilters(input.filters);

    if ((name === "search.performed" || name === "search.zero_results") && !query) {
      throw new BadRequestException(`${name} requires query`);
    }

    if (name === "search.result_clicked" || name === "marketplace.result_clicked") {
      if (!resultType || !resultId) {
        throw new BadRequestException(`${name} requires resultType and resultId`);
      }
    }

    const payload: Prisma.InputJsonObject = {
      viewerUserId: viewer.id,
      ...(query !== null ? { query } : {}),
      ...(tab !== null ? { tab } : {}),
      ...(sessionId !== null ? { sessionId } : {}),
      ...(resultType !== null ? { resultType } : {}),
      ...(resultId !== null ? { resultId } : {}),
      ...(resultUrl !== null ? { resultUrl } : {}),
      ...(position !== null ? { position } : {}),
      ...(resultCount !== null ? { resultCount } : {}),
      ...(filters !== null ? { filters } : {})
    };

    const event = await this.prisma.systemEvent.create({
      data: {
        name,
        source,
        payload
      },
      select: {
        id: true,
        name: true,
        source: true,
        occurredAt: true
      }
    });

    return event;
  }

  private requireEventName<T extends string>(
    value: unknown,
    allowed: Set<T>,
    namespace: string
  ): T {
    if (typeof value !== "string" || !allowed.has(value as T)) {
      throw new BadRequestException(`Unsupported ${namespace} observation event`);
    }
    return value as T;
  }

  private optionalSource(value: unknown): "web" | "mobile" | "api" | null {
    if (value === undefined || value === null || value === "") return null;
    if (value === "web" || value === "mobile" || value === "api") return value;
    throw new BadRequestException("source must be web, mobile, or api");
  }

  private optionalResultType(value: unknown): string | null {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !resultTypes.has(value)) {
      throw new BadRequestException("resultType must be person, post, service, or product");
    }
    return value;
  }

  private optionalText(value: unknown, field: string, maxLength: number): string | null {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) {
      throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    }
    return normalized;
  }

  private optionalInteger(
    value: unknown,
    field: string,
    minimum: number,
    maximum: number
  ): number | null {
    if (value === undefined || value === null || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new BadRequestException(`${field} must be an integer between ${minimum} and ${maximum}`);
    }
    return parsed;
  }

  private optionalFilters(value: unknown): Prisma.InputJsonObject | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("filters must be an object");
    }

    const safe = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
    return safe;
  }
}

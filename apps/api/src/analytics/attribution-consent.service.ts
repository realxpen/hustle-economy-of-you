import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

/**
 * This source is deliberately not accepted by the public POST /events endpoint.
 * It prevents clients from submitting a consent decision for another account.
 * Consent is always checked by the API using the authenticated User, never
 * trusted from the browser's analytics/click payload.
 */
export const ATTRIBUTION_CONSENT_SOURCE = "attribution-preference";
export const ATTRIBUTION_ENABLED = "attribution.enabled";
export const ATTRIBUTION_DISABLED = "attribution.disabled";
export const ATTRIBUTION_ELIGIBLE_NAMES = new Set([
  "feed.service_clicked",
  "feed.product_clicked",
  "search.result_clicked",
  "marketplace.result_clicked"
]);

@Injectable()
export class AttributionConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async status(identity: AuthIdentity) {
    const userId = await this.requireUser(identity);
    return this.statusForUser(userId);
  }

  async set(identity: AuthIdentity, input: { enabled?: unknown }) {
    if (typeof input?.enabled !== "boolean") {
      throw new BadRequestException("enabled must be true or false");
    }
    const userId = await this.requireUser(identity);
    const previous = await this.statusForUser(userId);
    if (previous.enabled === input.enabled) return previous;
    const event = await this.prisma.systemEvent.create({
      data: {
        name: input.enabled ? ATTRIBUTION_ENABLED : ATTRIBUTION_DISABLED,
        source: ATTRIBUTION_CONSENT_SOURCE,
        payload: { viewerUserId: userId, preferenceVersion: 1 }
      },
      select: { occurredAt: true }
    });
    return {
      enabled: input.enabled,
      enabledSince: input.enabled ? event.occurredAt : null,
      explanation: this.description(input.enabled)
    };
  }

  async statusForUser(userId: string) {
    const event = await this.prisma.systemEvent.findFirst({
      where: {
        source: ATTRIBUTION_CONSENT_SOURCE,
        name: { in: [ATTRIBUTION_ENABLED, ATTRIBUTION_DISABLED] },
        payload: { path: ["viewerUserId"], equals: userId }
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { name: true, occurredAt: true }
    });
    const enabled = event?.name === ATTRIBUTION_ENABLED;
    return {
      enabled,
      enabledSince: enabled ? event.occurredAt : null,
      explanation: this.description(enabled)
    };
  }

  /**
   * Only exact offer click events can carry this marker. The server verifies
   * consent at collection time. New consent cannot backfill old click events.
   */
  async clickMetadata(userId: string, name: string): Promise<Prisma.InputJsonObject> {
    if (!ATTRIBUTION_ELIGIBLE_NAMES.has(name)) return {};
    const state = await this.statusForUser(userId);
    return state.enabled ? { attributionEligible: true, attributionVersion: 1 } : {};
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user.id;
  }

  private description(enabled: boolean) {
    return enabled
      ? "Optional attribution is on. Hustle can link your future Service/Product taps to your own later Booking or Order for aggregate analytics. You can turn this off anytime."
      : "Optional attribution is off. Your discovery taps are not eligible to be linked to your Bookings or Orders in Hustle Analytics.";
  }
}

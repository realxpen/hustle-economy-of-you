import { ConflictException } from "@nestjs/common";

/**
 * A provider + eventId identifies ONE immutable signed event.
 * Altered content, even when signed by a sandbox key, is never a retry.
 * This helper does not authorize payments or mutate the ledger.
 */
export function assertWebhookEventEvidence(
  stored: { eventType: string; providerReference: string; payloadDigest: string },
  incoming: { type: string; providerReference: string; payloadDigest: string }
) {
  if (stored.eventType !== incoming.type ||
      stored.providerReference !== incoming.providerReference ||
      stored.payloadDigest !== incoming.payloadDigest) {
    throw new ConflictException("Provider event ID already belongs to different signed financial evidence");
  }
}

import type { SearchResult, SlotPage, BookingSlot, DirectConversation, ConsultationMessage } from '../../experience/feed-api';
import { enquiryServiceId, currentEnquirySlots, enquirySlotLabel } from './connectedOpportunityAvailability';

const canonicalId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export type EnquiryMessage = { recipientUserId: string; contextType: 'SERVICE'; contextId: string; text: string };
export type Delivery = { status: 'idle' | 'opening' | 'sending' | 'sent' | 'uncertain' | 'failed' | 'cancelled'; conversationId?: string };
export type ConsultationApi = {
  openDirect: (token: string, recipient: string) => Promise<{ conversation: DirectConversation }>;
  sendEnquiry: (token: string, conversation: string, input: Omit<EnquiryMessage, 'recipientUserId'>) => Promise<ConsultationMessage>;
};

/** A preference is message text, never a slot hold, quote or booking instruction. */
export function prepareEnquiryMessage(offer: SearchResult | null, draft: string,
  page: SlotPage | null, slot: BookingSlot | null, now = Date.now()): EnquiryMessage | null {
  const serviceId = enquiryServiceId(offer);
  const recipient = offer?.owner?.id;
  const text = draft.trim();
  if (!serviceId || !canonicalId(recipient) || !text || text.length > 1200) return null;
  const selected = slot && currentEnquirySlots(page, now).find(item => item.startAt === slot.startAt);
  const label = selected && page ? enquirySlotLabel(selected.startAt, page.timezone) : null;
  const preference = label && page && selected
    ? `Preferred appointment: ${page.date}, ${label} (${page.timezone}); ${selected.startAt}. Not reserved.`
    : 'Scheduling to be agreed with the provider; no appointment reserved.';
  return { recipientUserId: recipient, contextType: 'SERVICE', contextId: serviceId,
    text: `Service enquiry\n\n${text}\n\n${preference}\nThis is a consultation message, not a booking or payment.` };
}

/** One message attempt per enquiry. An HTTP error may occur after a server commit:
 * never automatically retry it or claim "not sent". Invalidation prevents a
 * late direct-conversation response from initiating a message after navigation.
 */
export function createEnquiryDelivery(api: ConsultationApi) {
  let state: Delivery = { status: 'idle' };
  let active = true;
  return {
    snapshot: () => ({ ...state }),
    invalidate: () => { active = false; state = { status: 'cancelled' }; },
    async deliver(token: string, message: EnquiryMessage): Promise<Delivery> {
      if (!active || !['idle', 'failed'].includes(state.status) || !token) return { ...state };
      state = { status: 'opening' };
      let attempted = false;
      try {
        const { conversation } = await api.openDirect(token, message.recipientUserId);
        if (!active) return { ...state };
        if (!canonicalId(conversation?.id) || conversation.otherParticipant?.id !== message.recipientUserId
          || !canonicalId(conversation.viewer?.userId) || conversation.viewer.userId === message.recipientUserId)
          throw new Error('Conversation identity mismatch');
        state = { status: 'sending', conversationId: conversation.id };
        attempted = true;
        const { recipientUserId: _recipient, ...input } = message;
        const sent = await api.sendEnquiry(token, conversation.id, input);
        if (!active) return { ...state };
        if (!canonicalId(sent?.id) || sent.conversationId !== conversation.id
          || sent.senderId !== conversation.viewer.userId || sent.text !== message.text
          || sent.context?.type !== 'SERVICE' || sent.context.id !== message.contextId)
          throw new Error('Message acknowledgement mismatch');
        state = { status: 'sent', conversationId: conversation.id };
      } catch {
        if (active) state = { ...state, status: attempted ? 'uncertain' : 'failed' };
      }
      return { ...state };
    }
  };
}

/** Canonical Web conversation only; never put tokens, enquiry text or times in URLs.
 * The browser signs in independently and the server still checks participation.
 */
export function consultationWebLink(conversationId: string, serviceId: string, webOrigin?: string): string | null {
  const origin = webOrigin?.trim().replace(/\/+$/, '');
  if (!canonicalId(conversationId) || !canonicalId(serviceId) || !origin
    || !(/^https:\/\/[^\s/?#@]+$/i.test(origin) || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin))) return null;
  try { if (new URL(origin).origin !== origin) return null; } catch { return null; }
  return origin + '/messages/' + conversationId + '?returnTo=' + encodeURIComponent('/bookings/new/' + serviceId);
}

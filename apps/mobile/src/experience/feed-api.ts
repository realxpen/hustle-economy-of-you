// Mobile-only adapter for existing authenticated NestJS APIs.
// Do not add mock responses or create financial transactions here.
export type FeedTab = 'for-you' | 'nearby' | 'connections';
export type Media = { id: string; type: 'VIDEO' | 'IMAGE'; mediaUrl: string | null; position: number };
export type Offer = { id: string; title: string; description?: string | null; priceMinor?: number | null; currency?: string; bookingMode?: string };
export type FeedItem = {
  post: { id: string; caption: string | null; category: string | null; location: string | null; media: Media[] };
  creator: { id: string; displayName: string | null; username: string | null; avatarUrl: string | null; location: string | null; verified: boolean; professionalProfile?: { primarySkill: string | null; headline: string | null } | null };
  engagement: { likes: number; saves: number; comments: number };
  viewer: { liked: boolean; saved: boolean; following: boolean };
  services: Offer[];
  products: Offer[];
};
export type FeedPage = { items: FeedItem[]; nextCursor: string | null; hasMore: boolean; reason?: string; viewerLocation?: string | null };
export type PostComment = { id: string; body: string; parentId: string | null; createdAt: string; user: { displayName: string | null; username: string | null } };
export type PostDiscussion = { comments: PostComment[]; commentCount: number; likeCount: number; saveCount: number };
export type BookingSlot = { startAt: string; endAt: string | null; available: boolean; remainingCapacity: number };
export type SlotPage = { mode: string; date: string; timezone: string; slots: BookingSlot[] };
export type DirectConversation = { id: string; viewer: { userId: string }; otherParticipant: { id: string } | null };
export type ConsultationMessage = { id: string; conversationId: string; senderId: string; text: string | null;
  context: { type: string; id: string } | null };
/** SearchService.publicResult spreads canonical value fields onto each result. */
export type SearchResult = {
  kind: 'person' | 'post' | 'service' | 'product';
  id: string;
  url?: string | null;
  person?: {
    id?: string; displayName?: string | null; username?: string | null;
    bio?: string | null; location?: string | null; verified?: boolean;
    professionalProfile?: { headline?: string | null; primarySkill?: string | null; professionalSummary?: string | null } | null;
  };
  post?: { caption?: string | null; category?: string | null; location?: string | null };
  service?: Offer & { category?: string | null; location?: string | null };
  product?: Offer & { category?: string | null };
  owner?: {
    id?: string; displayName?: string | null; username?: string | null;
    bio?: string | null; verified?: boolean; location?: string | null;
    professionalProfile?: { headline?: string | null; primarySkill?: string | null; professionalSummary?: string | null } | null;
  };
};
export type SearchPage = { items: SearchResult[]; hasMore: boolean; nextCursor: string | null };
export type SearchTab = 'top' | 'people' | 'posts' | 'services' | 'products';

/** The backend owns each tab's ranking and cursor; no client-side result slicing. */
export function searchTabPath(tab: SearchTab, query: string, cursor?: string | null) {
  const route = tab === 'top' ? '/search' : '/search/' + tab;
  return route + '?q=' + encodeURIComponent(query) + '&limit=16'
    + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
}

const base = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
export async function api<T>(token: string, path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  if (!token) throw new Error('Sign in to use Hustle.');
  const response = await fetch(base + path, {
    method,
    signal,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const message = details && typeof details.message === 'string'
      ? details.message
      : 'Hustle request failed (' + response.status + ')';
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
// An aborted POST may already have committed. Callers must classify that result
// as uncertain and never automatically resend the message.
async function consultationApi<T>(token: string, path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try { return await api<T>(token, path, 'POST', body, controller.signal); }
  finally { clearTimeout(timeout); }
}
export const mobileApi = {
  openDirect: (token: string, recipientUserId: string) =>
    consultationApi<{ conversation: DirectConversation }>(token, '/messaging/conversations/direct', { recipientUserId }),
  sendEnquiry: (token: string, conversationId: string, input: { text: string; contextType: 'SERVICE'; contextId: string }) =>
    consultationApi<ConsultationMessage>(token, '/messaging/conversations/' + encodeURIComponent(conversationId) + '/messages', input),
  feed: (token: string, tab: FeedTab, cursor?: string | null) =>
    api<FeedPage>(token, '/feed/' + tab + '?limit=8' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')),
  search: (token: string, query: string) =>
    api<SearchPage>(token, '/search?q=' + encodeURIComponent(query) + '&limit=16'),
  searchTab: (token: string, tab: SearchTab, query: string, cursor?: string | null) =>
    api<SearchPage>(token, searchTabPath(tab, query, cursor)),
  discussion: (token: string, postId: string) =>
    api<PostDiscussion>(token, '/posts/' + encodeURIComponent(postId) + '/interactions'),
  like: (token: string, postId: string, enabled: boolean) =>
    api(token, '/posts/' + encodeURIComponent(postId) + '/like', enabled ? 'POST' : 'DELETE'),
  save: (token: string, postId: string, enabled: boolean) =>
    api(token, '/posts/' + encodeURIComponent(postId) + '/save', enabled ? 'POST' : 'DELETE'),
  comment: (token: string, postId: string, body: string, parentId?: string) =>
    api<PostComment>(token, '/posts/' + encodeURIComponent(postId) + '/comments', 'POST', { body, ...(parentId ? { parentId } : {}) }),
  follow: (token: string, userId: string, enabled: boolean) =>
    api(token, '/users/' + encodeURIComponent(userId) + '/follow', enabled ? 'POST' : 'DELETE'),
  slots: (token: string, serviceId: string, date: string) =>
    api<SlotPage>(token, '/bookings/slots?serviceId=' + encodeURIComponent(serviceId) + '&date=' + encodeURIComponent(date)),
  requestBooking: (token: string, serviceId: string, startAt: string, endAt: string | null, requirements: string) =>
    api<{ id: string; status: string }>(token, '/bookings', 'POST', { serviceId, requestedStartAt: startAt, ...(endAt ? { requestedEndAt: endAt } : {}), requirements }),
  event: (token: string, name: string, postId: string, tab: FeedTab, extra: Record<string, unknown> = {}) =>
    api(token, '/feed/events', 'POST', { name, postId, feedTab: tab, source: 'mobile', ...extra })
};

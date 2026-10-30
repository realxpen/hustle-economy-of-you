import { api } from './feed-api';
import type { Conversation, InboxTransport, Message, Page } from './inbox-store';
export function inboxApi(token: string): InboxTransport {
  const path = (id: string) => '/messaging/conversations/' + encodeURIComponent(id);
  async function request<T>(route: string, method = 'GET', body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try { return await api<T>(token, route, method, body, controller.signal); }
    finally { clearTimeout(timeout); }
  }
  return {
    conversations: cursor => request<Page<Conversation>>('/messaging/conversations?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')),
    conversation: id => request<Conversation>(path(id)),
    messages: (id, cursor) => request<Page<Message>>(path(id) + '/messages?limit=30' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')),
    send: (id, text) => request<Message>(path(id) + '/messages', 'POST', { text }),
    read: (id, messageId) => request<{ unreadCount: number }>(path(id) + '/read', 'POST', { messageId })
  };
}

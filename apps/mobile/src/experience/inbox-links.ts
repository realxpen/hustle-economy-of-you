import type { Message } from './inbox-store';
export function messageContextUrl(context: Message['context'], base = process.env.EXPO_PUBLIC_PUBLIC_WEB_URL) {
  const route = context?.type === 'SERVICE' ? 'services' : context?.type === 'PRODUCT' ? 'products'
    : context?.type === 'POST' ? 'posts' : null;
  if (!route || !context || !/^[a-zA-Z0-9_-]{1,200}$/.test(context.id) || !base) return null;
  try {
    const origin = new URL(base);
    if (origin.protocol !== 'https:' || origin.username || origin.password) return null;
    return origin.origin + '/' + route + '/' + encodeURIComponent(context.id);
  } catch { return null; }
}

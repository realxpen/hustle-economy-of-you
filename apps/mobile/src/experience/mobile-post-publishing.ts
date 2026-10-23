import { api } from './feed-api';

export type OwnerPost = {
  id: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | string;
  caption: string | null; category: string | null; location: string | null;
  media: Array<{ id: string; type: 'IMAGE' | 'VIDEO'; mediaUrl: string | null }>;
};
export type PostInput = { caption: string; category: string; location: string; imageUrl: string };
export type CreatorPostState = {
  phase: 'idle' | 'sending' | 'review' | 'published';
  postId: string | null; notice: string; mine: OwnerPost[];
  listing: boolean; listError: string;
};
export type CreatorPostTransport = {
  mine(): Promise<OwnerPost[]>;
  get(id: string): Promise<OwnerPost>;
  create(input: { caption: string; category: string; location?: string }): Promise<OwnerPost>;
  image(id: string, url: string): Promise<OwnerPost>;
  publish(id: string): Promise<OwnerPost>;
};

export function normalizeCreatorPost(input: PostInput): PostInput {
  const caption = input.caption.trim(), category = input.category.trim(), location = input.location.trim();
  if (!caption || caption.length > 4000) throw new Error('Describe your work in 1–4000 characters.');
  if (!category || category.length > 100) throw new Error('Provide a skill category (maximum 100 characters).');
  if (location.length > 160) throw new Error('Location must be at most 160 characters.');
  if (input.imageUrl.trim().length > 1200) throw new Error('Image URL is too long.');
  let url: URL;
  try { url = new URL(input.imageUrl.trim()); }
  catch { throw new Error('Provide a public HTTPS image link that you own or may share.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname) ||
      url.hostname.endsWith('.local')) {
    throw new Error('Use a public HTTPS image link, never a local/private address.');
  }
  return { caption, category, location, imageUrl: url.toString() };
}

export function ownerPostApi(token: string): CreatorPostTransport {
  const postPath = (id: string) => '/posts/' + encodeURIComponent(id);
  const request = <T>(path: string, method = 'GET', body?: unknown) => api<T>(token, path, method, body);
  return {
    mine: () => request<OwnerPost[]>('/posts/mine'),
    get: id => request<OwnerPost>('/posts/mine/' + encodeURIComponent(id)),
    create: data => request<OwnerPost>('/posts', 'POST', data),
    image: (id, url) => request<OwnerPost>(postPath(id) + '/media', 'POST', { type: 'IMAGE', mediaUrl: url }),
    publish: id => request<OwnerPost>(postPath(id) + '/publish', 'POST')
  };
}

/** Unacknowledged POSTs are never replayed automatically. */
export function createCreatorPostStore(transport: CreatorPostTransport) {
  let state: CreatorPostState = { phase: 'idle', postId: null, notice: '', mine: [], listing: false, listError: '' };
  const listeners = new Set<() => void>();
  const update = (delta: Partial<CreatorPostState>) => {
    state = { ...state, ...delta };
    listeners.forEach(l => l());
  };
  let busy = false;
  async function list() {
    if (state.listing || busy) return;
    update({ listing: true, listError: '' });
    try {
      const mine = await transport.mine();
      if (!Array.isArray(mine)) throw new Error('Unexpected owner list.');
      update({ mine });
    } catch (e) {
      update({ listError: e instanceof Error ? e.message : 'Could not fetch your posts.' });
    } finally { update({ listing: false }); }
  }
  async function publish(input: PostInput) {
    if (busy || state.phase === 'review' || state.phase === 'published') return;
    let validated: PostInput;
    try { validated = normalizeCreatorPost(input); }
    catch (e) { update({ notice: e instanceof Error ? e.message : 'Invalid post.' }); return; }
    busy = true; update({ phase: 'sending', notice: '', listError: '' });
    let postId = state.postId;
    try {
      if (!postId) {
        const created = await transport.create({ caption: validated.caption, category: validated.category,
          ...(validated.location ? { location: validated.location } : {}) });
        if (!created.id || created.status !== 'DRAFT') throw new Error('Draft acknowledgement not confirmed.');
        postId = created.id; update({ postId });
      }
      const canonical = await transport.get(postId);
      if (canonical.status === 'PUBLISHED') {
        update({ phase: 'published', notice: 'Already published. Refresh Home to see your work.' });
        return;
      }
      if (canonical.status !== 'DRAFT') throw new Error('Post is not an editable draft.');
      const imageUrls = canonical.media.filter(m => m.type === 'IMAGE').map(m => m.mediaUrl);
      if (canonical.media.some(m => m.type !== 'IMAGE') || imageUrls.some(url => url !== validated.imageUrl))
        throw new Error('Saved draft has different media. Review the draft before publishing.');
      if (!imageUrls.includes(validated.imageUrl)) await transport.image(postId, validated.imageUrl);
      const result = await transport.publish(postId);
      if (result.id !== postId || result.status !== 'PUBLISHED') throw new Error('Publish acknowledgement is uncertain.');
      update({ phase: 'published', notice: 'Published to Hustle. Return Home to refresh your feed.' });
    } catch {
      update({ phase: 'review', notice: 'Delivery uncertain or publishing unavailable. Your draft may exist. Review My posts before trying again; no automatic resend.' });
    } finally { busy = false; }
  }
  function resume(post: OwnerPost) {
    if (busy || state.listing || post.status !== 'DRAFT') return;
    update({ phase: 'idle', postId: post.id, notice: 'Draft selected. Review its fields before explicitly publishing.' });
  }
  function newPost() {
    if (busy) return;
    update({ phase: 'idle', postId: null, notice: '' });
  }
  return { snapshot: () => state, subscribe: (listener: () => void) => {
    listeners.add(listener); return () => { listeners.delete(listener); };
  }, list, publish, resume, newPost };
}

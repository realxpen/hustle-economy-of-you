// Private session-scoped state; the existing API owns identity and authorization.
export type Message = { id: string; conversationId: string; senderId: string; text: string | null;
  createdAt: string; attachment: { fileName: string | null; type: string } | null;
  context: { type: string; id: string } | null };
export type Conversation = { id: string; viewer: { userId: string; unreadCount: number };
  otherParticipant: { id: string; displayName: string | null; username: string | null } | null;
  lastMessage: Message | null };
export type Page<T> = { items: T[]; nextCursor: string | null; hasMore: boolean };
export type InboxTransport = {
  conversations(cursor?: string | null): Promise<Page<Conversation>>;
  conversation(id: string): Promise<Conversation>;
  messages(id: string, cursor?: string | null): Promise<Page<Message>>;
  send(id: string, text: string): Promise<Message>;
  read(id: string, messageId: string): Promise<{ unreadCount: number }>;
};
type Draft = { text: string; status: 'idle' | 'sending' | 'uncertain'; checked: boolean };
type State = { conversations: Conversation[]; listCursor: string | null; listBusy: boolean; listError: string;
  selected: string | null; conversation: Conversation | null; messages: Message[]; cursor: string | null;
  busy: boolean; error: string; readError: string; drafts: Record<string, Draft> };
const emptyDraft: Draft = { text: '', status: 'idle', checked: false };
const reason = (e: unknown) => e instanceof Error ? e.message : 'Please try again.';
const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map(i => [i.id, i])).values()];
export function createInboxStore(transport: InboxTransport) {
  let state: State = { conversations: [], listCursor: null, listBusy: false, listError: '', selected: null,
    conversation: null, messages: [], cursor: null, busy: false, error: '', readError: '', drafts: {} };
  let version = 0;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const draft = (id: string) => state.drafts[id] || emptyDraft;
  const putDraft = (id: string, value: Draft) => update({ drafts: { ...state.drafts, [id]: value } });
  async function list(more = false) {
    if (state.listBusy || (more && !state.listCursor)) return;
    update({ listBusy: true, listError: '' });
    try {
      const page = await transport.conversations(more ? state.listCursor : null);
      update({ conversations: unique(more ? [...state.conversations, ...page.items] : page.items), listCursor: page.nextCursor });
    } catch (e) { update({ listError: reason(e) }); }
    finally { update({ listBusy: false }); }
  }
  async function load(more = false) {
    const id = state.selected, requestVersion = version;
    if (!id || state.busy || (more && !state.cursor)) return;
    update({ busy: true, error: '', readError: '' });
    try {
      const [conversation, page] = await Promise.all([
        transport.conversation(id), transport.messages(id, more ? state.cursor : null)
      ]);
      if (requestVersion !== version) return;
      if (conversation.id !== id || page.items.some(m => m.conversationId !== id)) throw new Error('Conversation response did not match.');
      update({ conversation, messages: unique(more ? [...page.items, ...state.messages] : page.items), cursor: page.nextCursor });
      if (!more && draft(id).status === 'uncertain') putDraft(id, { ...draft(id), checked: true });
    } catch (e) {
      if (requestVersion === version) update({ error: reason(e), conversation: null, messages: [], cursor: null });
    } finally { if (requestVersion === version) update({ busy: false }); }
  }
  function select(id: string | null) {
    version++;
    update({ selected: id, conversation: null, messages: [], cursor: null, busy: false, error: '', readError: '' });
    if (id) void load(); else void list();
  }
  async function send() {
    const id = state.selected;
    if (!id || !state.conversation || state.busy || state.error) return;
    const value = draft(id), text = value.text.trim(), viewer = state.conversation.viewer.userId;
    if (value.status !== 'idle' || !text || text.length > 4000) return;
    putDraft(id, { text, status: 'sending', checked: false }); // synchronous double-tap lock
    try {
      const message = await transport.send(id, text);
      if (!message.id || message.conversationId !== id || message.senderId !== viewer || message.text !== text)
        throw new Error('Message acknowledgement did not match.');
      putDraft(id, { ...emptyDraft });
      if (state.selected === id) await load();
      void list();
    } catch {
      // Timeout or malformed acknowledgement can follow a commit. Never resend.
      putDraft(id, { text, status: 'uncertain', checked: false });
    }
  }
  async function markVisible() {
    const id = state.selected, last = state.messages.at(-1), requestVersion = version;
    if (!id || !last || !state.conversation || state.error) return;
    try {
      const result = await transport.read(id, last.id);
      if (requestVersion !== version) return;
      update({ readError: '', conversations: state.conversations.map(c => c.id === id
        ? { ...c, viewer: { ...c.viewer, unreadCount: result.unreadCount } } : c) });
    } catch { if (requestVersion === version) update({ readError: 'Read status could not sync. Refresh to retry.' }); }
  }
  return {
    snapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    list, load, select, send, markVisible,
    edit(text: string) { if (state.selected && draft(state.selected).status === 'idle') putDraft(state.selected, { ...emptyDraft, text }); },
    discardCheckedDraft() {
      const id = state.selected;
      if (id && draft(id).status === 'uncertain' && draft(id).checked) putDraft(id, { ...emptyDraft });
    }
  };
}

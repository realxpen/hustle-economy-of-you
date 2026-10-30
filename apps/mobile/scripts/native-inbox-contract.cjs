// Actual mobile store/transport execution with generated staging fixtures; not live/device QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, overrides = {}) {
  const absolute = path.join(root, file), mod = new Module(absolute, module);
  mod.filename = absolute; mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  const original = mod.require.bind(mod);
  mod.require = name => overrides[name] || original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  } }).outputText, absolute);
  return mod.exports;
}
const { createInboxStore } = load('src/experience/inbox-store.ts');
const page = items => ({ items, nextCursor: null, hasMore: false });
const message = (id, conversationId = 'a', senderId = 'viewer', text = 'Hello') => ({ id, conversationId, senderId, text, createdAt: '2026-10-23T10:00:00Z', attachment: null, context: null });
const conversation = id => ({ id, viewer: { userId: 'viewer', unreadCount: 2 }, otherParticipant: { id: 'provider', displayName: 'STAGING TEST provider', username: null }, lastMessage: null });
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup(overrides = {}) {
  const calls = [], api = { conversations: async () => page([conversation('a')]), conversation: async id => conversation(id),
    messages: async id => page([message('first', id, 'provider')]),
    send: async (id, text) => { calls.push(['send', id, text]); return message('ack', id, 'viewer', text); },
    read: async (id, messageId) => { calls.push(['read', id, messageId]); return { unreadCount: 0 }; }, ...overrides };
  return { store: createInboxStore(api), calls };
}
async function test(label, fn) { await fn(); console.log('PASS ' + label); }
(async () => {
  await test('Late private history cannot replace another thread', async () => {
    const wait = deferred(); const { store } = setup({ messages: id => id === 'a' ? wait.promise : Promise.resolve(page([message('b1', id)])) });
    store.select('a'); store.select('b'); await flush(); wait.resolve(page([message('a1')])); await flush();
    assert.equal(store.snapshot().conversation.id, 'b'); assert.deepEqual(store.snapshot().messages.map(m => m.id), ['b1']);
  });
  await test('Provider reply, loaded-message read boundary and canonical viewer identity', async () => {
    const { store, calls } = setup(); await store.list(); store.select('a'); await flush(); await store.markVisible();
    assert.deepEqual(calls[0], ['read', 'a', 'first']); assert.equal(store.snapshot().conversations[0].viewer.unreadCount, 0);
    store.edit('  My reply  '); await store.send(); assert.deepEqual(calls[1], ['send', 'a', 'My reply']); assert.equal(store.snapshot().drafts.a.text, '');
  });
  await test('Duplicate-tap lock survives leaving and reopening a thread', async () => {
    const wait = deferred(); let sends = 0; const { store } = setup({ send: () => { sends++; return wait.promise; } });
    store.select('a'); await flush(); store.edit('Draft'); const pending = store.send(); void store.send();
    store.select('b'); await flush(); store.select('a'); await flush(); void store.send(); assert.equal(sends, 1);
    wait.resolve(message('sent', 'a', 'viewer', 'Draft')); await pending; assert.equal(store.snapshot().drafts.a.status, 'idle');
  });
  await test('Uncertain send requires successful history check and explicit draft discard', async () => {
    let sends = 0, failRead = false; const { store } = setup({ send: async () => { sends++; throw Error('timeout'); },
      messages: async id => { if (failRead) throw Error('offline'); return page([message('history', id)]); } });
    store.select('a'); await flush(); store.edit('Possibly sent'); await store.send(); await store.send();
    store.edit('Duplicate'); store.discardCheckedDraft(); assert.equal(sends, 1); assert.equal(store.snapshot().drafts.a.status, 'uncertain');
    failRead = true; await store.load(); store.discardCheckedDraft(); assert.equal(store.snapshot().drafts.a.status, 'uncertain');
    failRead = false; await store.load(); store.discardCheckedDraft(); assert.equal(store.snapshot().drafts.a.text, ''); assert.equal(sends, 1);
  });
  await test('Malformed acknowledgements uncertain; empty and oversized messages never send', async () => {
    let sends = 0; const { store } = setup({ send: async () => { sends++; return message('wrong', 'other'); } });
    store.select('a'); await flush(); store.edit(' '); await store.send(); store.edit('x'.repeat(4001)); await store.send(); assert.equal(sends, 0);
    store.edit('Valid'); await store.send(); assert.equal(store.snapshot().drafts.a.status, 'uncertain');
  });
  await test('Cursor pagination preserves chronology and deduplicates boundaries', async () => {
    const cursors = []; const { store } = setup({ messages: async (id, cursor) => {
      cursors.push(cursor); return cursor ? page([message('old', id), message('new', id)]) : { items: [message('new', id)], nextCursor: 'opaque+/=', hasMore: true };
    } }); store.select('a'); await flush(); await store.load(true);
    assert.deepEqual(store.snapshot().messages.map(m => m.id), ['old', 'new']); assert.deepEqual(cursors, [null, 'opaque+/=']);
  });
  await test('Access errors show no private thread; new account store has no old drafts', async () => {
    const { store } = setup({ conversation: async () => { throw Error('Conversation not found'); } }); store.select('a'); await flush();
    assert.equal(store.snapshot().conversation, null); assert.deepEqual(store.snapshot().messages, []); assert.match(store.snapshot().error, /not found/);
    assert.deepEqual(setup().store.snapshot().drafts, {});
  });
  await test('Transport encodes IDs/cursors and sends only canonical text/read input', async () => {
    const calls = []; const { inboxApi } = load('src/experience/inbox-api.ts', { './feed-api': { api: async (...args) => { calls.push(args); return {}; } } });
    const api = inboxApi('test-token'); await api.messages('id/with slash', 'opaque+/='); await api.send('a', 'reply'); await api.read('a', 'seen');
    assert.equal(calls[0][1], '/messaging/conversations/id%2Fwith%20slash/messages?limit=30&cursor=opaque%2B%2F%3D');
    assert.deepEqual(calls[1].slice(1, 4), ['/messaging/conversations/a/messages', 'POST', { text: 'reply' }]);
    assert.deepEqual(calls[2].slice(1, 4), ['/messaging/conversations/a/read', 'POST', { messageId: 'seen' }]);
  });
  await test('Public context links reject unsafe type, identifier, credentials and protocol', () => {
    const { messageContextUrl } = load('src/experience/inbox-links.ts');
    assert.equal(messageContextUrl({ type: 'SERVICE', id: 'svc-1' }, 'https://hustle.example/base'), 'https://hustle.example/services/svc-1');
    for (const type of ['BOOKING', 'ADMIN', '__proto__']) assert.equal(messageContextUrl({ type, id: 'safe' }, 'https://hustle.example'), null);
    assert.equal(messageContextUrl({ type: 'SERVICE', id: '../private' }, 'https://hustle.example'), null);
    for (const base of ['http://hustle.example', 'javascript:alert(1)', 'https://user:secret@hustle.example']) assert.equal(messageContextUrl({ type: 'POST', id: 'post-1' }, base), null);
  });
  await test('Late read receipt cannot change another thread', async () => {
    const wait = deferred(); const { store } = setup({ read: () => wait.promise }); store.select('a'); await flush();
    const pending = store.markVisible(); store.select('b'); await flush(); wait.resolve({ unreadCount: 0 }); await pending;
    assert.equal(store.snapshot().conversation.id, 'b'); assert.equal(store.snapshot().conversation.viewer.unreadCount, 2);
  });
  console.log('Generated native inbox execution passed; live two-account/device acceptance unverified.');
})().catch(e => { console.error(e); process.exitCode = 1; });

#!/usr/bin/env node
// Actual pure TS/adapter execution with generated transports; not live messaging QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative, overrides = {}) {
  const file = path.join(root, relative);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true
  }, reportDiagnostics: true });
  assert.equal(output.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const mod = new Module(file, module);
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  const originalRequire = mod.require.bind(mod);
  mod.require = name => overrides[name] || originalRequire(name);
  mod._compile(output.outputText, file);
  return mod.exports;
}
const availability = load('src/ux004/discovery/connectedOpportunityAvailability.ts');
const { prepareEnquiryMessage, createEnquiryDelivery, consultationWebLink } = load(
  'src/ux004/discovery/enquiryConsultation.ts', { './connectedOpportunityAvailability': availability });
const service = { kind: 'service', id: 'svc-1', service: { id: 'svc-1', title: 'Fitting' }, owner: { id: 'provider-1' } };
const now = Date.parse('2026-11-10T00:00:00Z');
const slot = { startAt: '2026-11-10T09:00:00Z', endAt: null, available: true, remainingCapacity: 1 };
const page = { mode: 'APPOINTMENT', date: '2026-11-10', timezone: 'Africa/Lagos', slots: [slot] };
const message = prepareEnquiryMessage(service, '  Fit my outfit  ', page, slot, now);
const conversation = { id: 'thread-1', viewer: { userId: 'client-1' }, otherParticipant: { id: 'provider-1' } };
const ack = { id: 'msg-1', conversationId: 'thread-1', senderId: 'client-1', text: message.text, context: { type: 'SERVICE', id: 'svc-1' } };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function check(label, fn) { await fn(); console.log('PASS: ' + label); }
(async () => {
  await check('Canonical Service/owner and nonempty bounded text required', () => {
    assert.deepEqual(Object.keys(message).sort(), ['contextId', 'contextType', 'recipientUserId', 'text']);
    assert.equal(message.contextType, 'SERVICE'); assert.equal(message.contextId, 'svc-1');
    assert.match(message.text, /Fit my outfit/); assert.match(message.text, /Africa\/Lagos/);
    assert.match(message.text, /2026-11-10T09:00:00Z/); assert.match(message.text, /Not reserved/);
    for (const bad of [null, { ...service, id: 'mismatch' }, { ...service, owner: { id: '../admin' } }, { ...service, kind: 'product' }])
      assert.equal(prepareEnquiryMessage(bad, 'Draft', null, null, now), null);
    for (const text of ['  ', 'x'.repeat(1201)]) assert.equal(prepareEnquiryMessage(service, text, null, null, now), null);
  });
  await check('Stale, full or nonappointment preference never becomes a reservation', () => {
    for (const p of [null, { ...page, mode: 'WORK_QUEUE' }, { ...page, slots: [{ ...slot, available: false }] }])
      assert.match(prepareEnquiryMessage(service, 'Draft', p, slot, now).text, /Scheduling to be agreed/);
    assert.match(prepareEnquiryMessage(service, 'Draft', page, slot, now + 86400000).text, /Scheduling to be agreed/);
  });
  await check('Real acknowledgement required; duplicate taps create one message only', async () => {
    const wait = deferred(); let opens = 0, sends = 0;
    const delivery = createEnquiryDelivery({ openDirect: async () => { opens++; return wait.promise; }, sendEnquiry: async (token, id, input) => {
      sends++; assert.equal(token, 'synthetic-token'); assert.equal(id, 'thread-1');
      assert.deepEqual(input, { contextType: 'SERVICE', contextId: 'svc-1', text: message.text }); return ack;
    } });
    const first = delivery.deliver('synthetic-token', message);
    await delivery.deliver('synthetic-token', message); assert.equal(opens, 1); assert.equal(sends, 0);
    wait.resolve({ conversation });
    assert.deepEqual(await first, { status: 'sent', conversationId: 'thread-1' });
    await delivery.deliver('synthetic-token', message); assert.equal(sends, 1);
  });
  await check('Wrong counterpart/viewer blocks message; direct-open failure can safely retry', async () => {
    let opens = 0, sends = 0;
    const delivery = createEnquiryDelivery({ openDirect: async () => { opens++; if (opens === 1) throw Error('network'); return { conversation }; }, sendEnquiry: async () => { sends++; return ack; } });
    assert.equal((await delivery.deliver('token', message)).status, 'failed'); assert.equal(sends, 0);
    assert.equal((await delivery.deliver('token', message)).status, 'sent'); assert.equal(sends, 1);
    for (const bad of [{ ...conversation, otherParticipant: { id: 'other' } }, { ...conversation, viewer: { userId: 'provider-1' } }, { ...conversation, id: '../other' }]) {
      const d = createEnquiryDelivery({ openDirect: async () => ({ conversation: bad }), sendEnquiry: async () => { throw Error('must not call'); } });
      assert.equal((await d.deliver('token', message)).status, 'failed');
    }
  });
  await check('Post-commit errors and malformed acknowledgements stay uncertain; never resend', async () => {
    for (const response of [null, { ...ack, senderId: 'other' }, { ...ack, conversationId: 'other' }, { ...ack, context: { type: 'SERVICE', id: 'other' } }, { ...ack, text: 'wrong' }]) {
      let sends = 0;
      const d = createEnquiryDelivery({ openDirect: async () => ({ conversation }), sendEnquiry: async () => { sends++; if (!response) throw Error('timeout after commit'); return response; } });
      assert.equal((await d.deliver('token', message)).status, 'uncertain');
      await d.deliver('token', message); assert.equal(sends, 1);
    }
  });
  await check('Closing/session invalidation before direct response prevents send; late ack cannot revive UI', async () => {
    const wait = deferred(); let sends = 0;
    const d = createEnquiryDelivery({ openDirect: () => wait.promise, sendEnquiry: async () => { sends++; return ack; } });
    const first = d.deliver('token', message); d.invalidate(); wait.resolve({ conversation });
    assert.equal((await first).status, 'cancelled'); assert.equal(sends, 0);
    const posted = deferred();
    const d2 = createEnquiryDelivery({ openDirect: async () => ({ conversation }), sendEnquiry: () => posted.promise });
    const second = d2.deliver('token', message); await Promise.resolve(); d2.invalidate(); posted.resolve(ack);
    assert.equal((await second).status, 'cancelled');
  });
  await check('Conversation URL carries only canonical navigation and safe booking return', () => {
    const url = consultationWebLink('thread-1', 'svc-1', 'https://hustle.test');
    assert.equal(url, 'https://hustle.test/messages/thread-1?returnTo=%2Fbookings%2Fnew%2Fsvc-1');
    for (const origin of ['javascript:alert(1)', 'https://user:secret@hustle.test', 'https://hustle.test/path', 'https://hustle.test?token=secret'])
      assert.equal(consultationWebLink('thread-1', 'svc-1', origin), null);
    assert.equal(consultationWebLink('../other', 'svc-1', 'https://hustle.test'), null);
    assert.equal(consultationWebLink('thread-1', '../other', 'https://hustle.test'), null);
  });
  await check('Actual mobile adapter posts only existing canonical messaging contracts', async () => {
    const { mobileApi } = load('src/experience/feed-api.ts');
    const calls = []; const original = global.fetch;
    global.fetch = async (url, init) => { calls.push({ url, ...init }); return { ok: true, json: async () => ({}) }; };
    try { await mobileApi.openDirect('synthetic-token', 'provider-1'); await mobileApi.sendEnquiry('synthetic-token', 'thread-1', { text: 'Draft', contextType: 'SERVICE', contextId: 'svc-1' }); }
    finally { global.fetch = original; }
    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.endsWith('/messaging/conversations/direct'));
    assert.ok(calls[1].url.endsWith('/messaging/conversations/thread-1/messages'));
    assert.deepEqual(JSON.parse(calls[0].body), { recipientUserId: 'provider-1' });
    for (const call of calls) { assert.equal(call.method, 'POST'); assert.equal(call.headers.Authorization, 'Bearer synthetic-token'); assert.ok(call.signal instanceof AbortSignal); }
  });
  await check('UI opt-in, explicit confirmation, no booking/payment and backend participant controls retained', () => {
    const screen = fs.readFileSync(path.join(root, 'src/experience/MobileExperience.tsx'), 'utf8');
    assert.match(screen, /EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES !== 'true'/);
    assert.match(screen, /Alert\.alert\('Send enquiry as message\?'/);
    assert.match(screen, /attempt !== enquiryDelivery\.current/);
    assert.match(screen, /attempt === enquiryDelivery\.current/);
    assert.match(screen, /enquiryDelivery\.current\.invalidate\(\)/);
    assert.match(screen, /Delivery uncertain — check the conversation/);
    assert.match(screen, /Browser sign-in is separate/);
    const handler = screen.slice(screen.indexOf('  function confirmEnquiryMessage()'), screen.indexOf('  async function openSearchResult('));
    assert.doesNotMatch(handler, /requestBooking|initializePayment|escrow|console\./);
    const controller = fs.readFileSync(path.join(root, '../api/src/messaging/messaging.controller.ts'), 'utf8');
    assert.match(controller, /assertDirectContact\(identity, input.recipientUserId\)/);
    assert.match(controller, /assertConversationContact\(identity, conversationId\)/);
    const service = fs.readFileSync(path.join(root, '../api/src/messaging/messaging.service.ts'), 'utf8');
    assert.match(service, /await this.requireParticipant\(id, viewer.id\)/);
    assert.match(service, /parseAndValidateContext\(input.contextType, input.contextId\)/);
  });
  console.log('A3.5 generated enquiry/message contracts PASS; signed-in staging/device QA PENDING.');
})().catch(error => { console.error(error); process.exitCode = 1; });

// SDK 1.2.0: User-Agent, structured errors, Retry-After, bounded opt-in retries, streaming (Oct 20, 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { AutoRouter, RouterClientError, parseRetryAfter, VERSION, USER_AGENT, RETRYABLE_CODES, DEFAULT_TIMEOUT_MS } from '../src/index.js';

const RL = { error: { message: 'Upstream community is currently rate limited. Retry after 900s or configure your BYOK provider key in the Vault.', type: 'rate_limit_error', code: 'upstream_rate_limited' } };
const OK = { id: 'c', model: 'sentiogate-community', choices: [{ index: 0, message: { role: 'assistant', content: 'hi' } }] };
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const sse = (...chunks) => new Response(chunks.map(c => `data: ${typeof c === 'string' ? c : JSON.stringify(c)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });

async function withFetch(script, fn) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init, headers: init.headers, body: init.body ? JSON.parse(init.body) : null }); const s = script.length > 1 ? script.shift() : script[0]; return typeof s === 'function' ? s() : s.clone(); };
  try { await fn(calls); } finally { globalThis.fetch = orig; }
}
const client = (o = {}) => { const c = new AutoRouter({ baseUrl: 'https://api.test', ...o }); c._slept = []; c._sleep = async (ms) => { c._slept.push(ms); }; return c; };
const msgs = [{ role: 'user', content: 'x' }];

test('version, package.json and User-Agent agree; CJS wrapper exports the new names', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
  assert.ok(pkg.files.includes('CHANGELOG.md'));
  assert.equal(USER_AGENT, `ai-auto-router-sdk-js/${VERSION} (+https://sentiogate.app)`);
  assert.deepEqual([...RETRYABLE_CODES], ['upstream_rate_limited', 'rate_limited', 'upstream_circuit_open']);
  const src = readFileSync(new URL('../src/index.cjs', import.meta.url), 'utf8');
  for (const n of ['parseRetryAfter', 'RETRYABLE_CODES', 'VERSION', 'USER_AGENT']) assert.match(src, new RegExp(`${n}: esm\\.${n}`));
});

test('User-Agent is sent from Node (overridable)', async () => {
  await withFetch([json(200, OK)], async (calls) => {
    await client().chat({ messages: msgs });
    await client({ userAgent: 'my-app/2' }).chat({ messages: msgs });
    assert.equal(calls[0].headers['User-Agent'], USER_AGENT);
    assert.equal(calls[1].headers['User-Agent'], 'my-app/2');
  });
});

test('parseRetryAfter: seconds, HTTP date, junk', () => {
  const now = Date.parse('2026-10-20T08:00:00Z');
  assert.equal(parseRetryAfter('900'), 900);
  assert.equal(parseRetryAfter('5'), 5);
  assert.equal(parseRetryAfter(null), null); assert.equal(parseRetryAfter(''), null); assert.equal(parseRetryAfter('soon'), null);
  assert.equal(parseRetryAfter('Tue, 20 Oct 2026 08:02:00 GMT', now), 120);
  assert.equal(parseRetryAfter('Tue, 20 Oct 2026 07:00:00 GMT', now), 0);
});

test('community 429: code, type and retryAfter surface; no retry by default', async () => {
  await withFetch([json(429, RL, { 'retry-after': '900' })], async (calls) => {
    const c = client();
    const e = await c.chat({ messages: msgs }).catch(x => x);
    assert.ok(e instanceof RouterClientError);
    assert.equal(e.statusCode, 429); assert.equal(e.code, 'upstream_rate_limited'); assert.equal(e.type, 'rate_limit_error'); assert.equal(e.retryAfter, 900);
    assert.equal(e.retryable, true); assert.match(e.message, /Retry after 900s/);
    assert.equal(calls.length, 1); assert.deepEqual(c._slept, []);
  });
});

test('opt-in retry waits Retry-After (gate probe wait = 5 s) and succeeds', async () => {
  await withFetch([json(429, RL, { 'retry-after': '5' }), json(200, OK)], async (calls) => {
    const c = client({ maxRetries: 2 });
    const r = await c.chat({ messages: msgs });
    assert.equal(r.choices[0].message.content, 'hi');
    assert.deepEqual(c._slept, [5000]); assert.equal(calls.length, 2);
  });
});

test('no hot loop: long Retry-After, missing Retry-After, quota codes and 403 are never retried; 0 waits >= 1 s', async () => {
  await withFetch([json(429, RL, { 'retry-after': '900' })], async (calls) => {
    const c = client({ maxRetries: 5 });
    await assert.rejects(c.chat({ messages: msgs }), RouterClientError);
    assert.equal(calls.length, 1); assert.deepEqual(c._slept, []);
  });
  await withFetch([json(429, RL, { 'retry-after': '0' })], async (calls) => {
    const c = client({ maxRetries: 3 });
    await assert.rejects(c.chat({ messages: msgs }));
    assert.equal(calls.length, 4); assert.deepEqual(c._slept, [1000, 1000, 1000]);
  });
  for (const r of [json(429, RL), json(429, { error: { code: 'community_pool_exhausted', type: 'rate_limit_error', message: 'cooling' } }, { 'retry-after': '5' }),
    json(403, { error: { code: 'community_pool_disabled_with_byok', type: 'permission_error', message: 'BYOK' } })]) {
    await withFetch([r], async (calls) => {
      const c = client({ maxRetries: 3 });
      const e = await c.chat({ messages: msgs, model: 'sentiogate-community' }).catch(x => x);
      assert.equal(e.retryable, false); assert.equal(calls.length, 1); assert.deepEqual(c._slept, []);
    });
  }
});

test('BYOK / community exclusivity surfaces the code on chat and batch', async () => {
  const byok = { error: { message: 'Community batch pipeline is disabled when BYOK keys are configured in your Vault.', type: 'permission_error', code: 'community_pool_disabled_with_byok' } };
  await withFetch([json(403, byok)], async () => {
    const c = client();
    const e1 = await c.chat({ messages: msgs, model: 'sentiogate-community' }).catch(x => x);
    assert.equal(e1.statusCode, 403); assert.equal(e1.code, 'community_pool_disabled_with_byok');
    const e2 = await c.enqueueBatch({ messages: msgs }).catch(x => x);
    assert.equal(e2.statusCode, 403); assert.equal(e2.code, 'community_pool_disabled_with_byok'); assert.match(e2.message, /^Enqueue batch failed \(403\)/);
  });
  await withFetch([json(404, { error: { code: 'not_found', message: 'no such job' } })], async () => {
    const e = await client().pollBatch('job_x').catch(x => x);
    assert.equal(e.statusCode, 404); assert.equal(e.code, 'not_found');
  });
});

test('allowQueue (typed top-level option) sends the queue header; 202 is returned', async () => {
  await withFetch([json(202, { status: 'queued', job_id: 'j1' })], async (calls) => {
    const r = await client().chat({ messages: msgs, allowQueue: true });
    assert.equal(r.job_id, 'j1');
    assert.equal(calls[0].headers['X-SentioGate-Allow-Queue'], 'true');
  });
});

test('streamChat: yields SSE chunks; errors before the first chunk are structured and retryable', async () => {
  await withFetch([sse({ choices: [{ index: 0, delta: { content: 'he' } }] }, { choices: [{ index: 0, delta: { content: 'llo' } }] }, '[DONE]')], async (calls) => {
    const out = [];
    for await (const ch of client().streamChat({ messages: msgs })) out.push(ch.choices[0].delta.content);
    assert.deepEqual(out, ['he', 'llo']);
    assert.equal(calls[0].body.stream, true); assert.equal(calls[0].headers.Accept, 'text/event-stream');
  });
  await withFetch([json(429, RL, { 'retry-after': '86' })], async () => {
    const it = client().streamChat({ messages: msgs });
    const e = await it.next().catch(x => x);
    assert.equal(e.code, 'upstream_rate_limited'); assert.equal(e.retryAfter, 86);
  });
  await withFetch([json(429, RL, { 'retry-after': '5' }), sse({ choices: [{ index: 0, delta: { content: 'ok' } }] }, '[DONE]')], async (calls) => {
    const c = client({ maxRetries: 1 });
    const out = [];
    for await (const ch of c.streamChat({ messages: msgs })) out.push(ch.choices[0].delta.content);
    assert.deepEqual(out, ['ok']); assert.equal(calls.length, 2); assert.deepEqual(c._slept, [5000]);
  });
});

test('CommonJS entry loads (Node >= 20.19 / 22.12 require(esm))', () => {
  const require = createRequire(import.meta.url);
  let cjs;
  try { cjs = require('../src/index.cjs'); } catch (e) { if (e.code === 'ERR_REQUIRE_ESM') return; throw e; }
  assert.equal(typeof cjs.AutoRouter, 'function'); assert.equal(typeof cjs.parseRetryAfter, 'function');
});

test('default timeout 130 s (above the server 120 s community deadline); LICENSE ships', () => {
  assert.equal(DEFAULT_TIMEOUT_MS, 130000);
  assert.equal(new AutoRouter().timeout, 130000);
  assert.equal(new AutoRouter({ timeout: 5000 }).timeout, 5000);
  assert.match(readFileSync(new URL('../LICENSE', import.meta.url), 'utf8').slice(0, 200), /Apache License/);
});

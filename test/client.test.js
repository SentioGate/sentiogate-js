import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AutoRouter, RouterClientError, DEFAULT_BASE_URL } from '../src/index.js';

test('AutoRouter initializes with default options', () => {
  const router = new AutoRouter();
  assert.equal(router.baseUrl, 'https://api.sentiogate.dev');
  assert.equal(DEFAULT_BASE_URL, 'https://api.sentiogate.dev');
  assert.equal(router.apiKey, null);
  assert.equal(router.timeout, 130000);
});

test('AutoRouter trims trailing slash and respects custom options', () => {
  const router = new AutoRouter({
    baseUrl: 'https://api.custom.com/v1/',
    apiKey: 'secret-token',
    timeout: 5000,
  });
  assert.equal(router.baseUrl, 'https://api.custom.com/v1');
  assert.equal(router.apiKey, 'secret-token');
  assert.equal(router.timeout, 5000);

  const headers = router._headers({ 'X-Custom': 'yes' });
  assert.equal(headers['Authorization'], 'Bearer secret-token');
  assert.equal(headers['X-Custom'], 'yes');
  assert.equal(headers['Content-Type'], 'application/json');
});

test('RouterClientError retains statusCode and responseBody', () => {
  const err = new RouterClientError('Unauthorized', 401, { error: 'invalid_token' });
  assert.equal(err.name, 'RouterClientError');
  assert.equal(err.statusCode, 401);
  assert.deepEqual(err.responseBody, { error: 'invalid_token' });
});

test('AutoRouter enqueueBatch and pollBatch call appropriate endpoints', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    requests.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
    if (url.endsWith('/v1/batch/enqueue')) {
      return new Response(JSON.stringify({ job_id: 'job_xyz123', status: 'queued', poll_url: '/v1/batch/poll/job_xyz123' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/v1/batch/poll/')) {
      return new Response(JSON.stringify({ job_id: 'job_xyz123', status: 'completed', response: { choices: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  };

  try {
    const router = new AutoRouter({ baseUrl: 'https://api.test.com' });
    const enq = await router.enqueueBatch({ messages: [{ role: 'user', content: 'test batch' }] });
    assert.equal(enq.status, 'queued');
    assert.equal(enq.job_id, 'job_xyz123');
    assert.equal(requests[0].url, 'https://api.test.com/v1/batch/enqueue');
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].body.model, 'sentiogate-community');

    const poll = await router.pollBatch(enq.job_id);
    assert.equal(poll.status, 'completed');
    assert.equal(requests[1].url, 'https://api.test.com/v1/batch/poll/job_xyz123');
    assert.equal(requests[1].method, 'GET');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('path identifiers are encoded as single URL segments', async () => {
  const urls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(url);
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const router = new AutoRouter({ baseUrl: 'https://api.test.com' });
    await router.pollBatch('job/with space');
    await router.getSessionHandoff('session/with space');
    await router.compactSession({ sessionId: 'session/with space', messages: [] });
    assert.deepEqual(urls, [
      'https://api.test.com/v1/batch/poll/job%2Fwith%20space',
      'https://api.test.com/v1/sessions/session%2Fwith%20space/handoff',
      'https://api.test.com/v1/sessions/session%2Fwith%20space/compact',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('internal / web-app-only methods are not part of the public client', () => {
  const router = new AutoRouter();
  for (const name of ['getClusterHealth', 'broadcastClusterBreaker', 'getEdgeStatus', 'verifyTurnstile']) {
    assert.equal(typeof router[name], 'undefined', `${name} should not exist`);
  }
});

test('clearCache flushes only the caller\'s cache (no user_id parameter)', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method });
    return new Response('{"status":"cleared"}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const router = new AutoRouter({ baseUrl: 'https://api.test.com' });
    await router.clearCache('someone_else');
    assert.deepEqual(calls, [{ url: 'https://api.test.com/v1/cache', method: 'DELETE' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/**
 * SentioGate JavaScript / TypeScript Client SDK (@sentiogate/sdk).
 *
 * Direct, lightweight client that brings your own keys to the SentioGate gateway.
 */

export const VERSION = '1.3.0';
/** Sent from Node / server runtimes only (browsers control their own User-Agent). */
export const USER_AGENT = `sentiogate-js/${VERSION} (+https://sentiogate.app)`;
/** 429 codes worth retrying after Retry-After; quota codes (community_pool_exhausted, monthly_request_limit) are not. */
export const RETRYABLE_CODES = Object.freeze(['upstream_rate_limited', 'rate_limited', 'upstream_circuit_open']);
const IS_BROWSER = typeof window !== 'undefined' && typeof window.document !== 'undefined';

/** Retry-After header -> seconds (delta-seconds or HTTP-date), or null when absent / unparseable. */
export function parseRetryAfter(value, now = Date.now()) {
  if (value == null || String(value).trim() === '') return null;
  const v = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.max(0, (t - now) / 1000) : null;
}

export class RouterClientError extends Error {
  /**
   * @param {string} message
   * @param {number|null} [statusCode]
   * @param {any} [responseBody]
   * @param {{code?: string|null, type?: string|null, retryAfter?: number|null}} [extra]
   */
  constructor(message, statusCode = null, responseBody = null, extra = {}) {
    super(message);
    this.name = 'RouterClientError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.code = extra.code ?? null;
    this.type = extra.type ?? null;
    this.retryAfter = extra.retryAfter ?? null;
  }

  /** True for a 429 the server asked us to retry later (Retry-After present, transient code). */
  get retryable() {
    return this.statusCode === 429 && this.retryAfter != null && RETRYABLE_CODES.includes(this.code);
  }
}

async function errorFrom(res, prefix) {
  let body;
  const text = await res.text().catch(() => '');
  try { body = JSON.parse(text); } catch { body = text; }
  const err = body && typeof body === 'object' && body.error && typeof body.error === 'object' ? body.error : {};
  const serverMsg = typeof err.message === 'string' ? err.message : (body && typeof body.detail === 'string' ? body.detail : null);
  return new RouterClientError(
    `${prefix} ${res.status}: ${res.statusText}${serverMsg ? ` - ${serverMsg}` : ''}`,
    res.status,
    body,
    { code: err.code ?? null, type: err.type ?? null, retryAfter: parseRetryAfter(res.headers.get('retry-after')) },
  );
}

/** Hosted SentioGate API. The client appends /v1/... itself, so this is host-only. */
export const DEFAULT_BASE_URL = 'https://api.sentiogate.dev';
/** Default request timeout (130 s), generous enough for long-running requests. */
export const DEFAULT_TIMEOUT_MS = 130000;

export class AutoRouter {
  /**
   * @param {Object} options
   * @param {string} [options.baseUrl='https://api.sentiogate.dev'] Host only; use e.g. 'http://localhost:8000' for a self-hosted router.
   * @param {string} [options.apiKey]
   * @param {number} [options.timeout=130000] Milliseconds. Leaves room for long-running requests.
   * @param {number} [options.maxRetries=0] Opt-in: retry transient 429s after the server's Retry-After.
   * @param {number} [options.maxRetryWaitMs=60000] Never wait longer than this (the server may ask you to wait via Retry-After).
   * @param {string} [options.userAgent] Node / server runtimes only.
   */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    this.maxRetries = Math.max(0, Math.floor(Number(options.maxRetries) || 0));
    this.maxRetryWaitMs = options.maxRetryWaitMs ?? 60000;
    this.userAgent = options.userAgent || USER_AGENT;
    this._sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  }

  _headers(custom = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(IS_BROWSER ? {} : { 'User-Agent': this.userAgent }),
      ...custom,
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /** Wait the server's Retry-After before another attempt, or return false (never a hot loop: >= 1 s). */
  async _shouldRetry(err, attempt) {
    if (!(err instanceof RouterClientError) || !err.retryable || attempt >= this.maxRetries) return false;
    const waitMs = Math.max(1000, err.retryAfter * 1000);
    if (err.retryAfter * 1000 > this.maxRetryWaitMs) return false;
    await this._sleep(waitMs);
    return true;
  }

  _chatRequest({ messages, model, providerKeys, userId, difficulty, mode, constraints, plugins, routerMetadata, tier,
    hedgingMode, hedgeDelayMs, cache, cacheBypass, allowQueue, extraBody, stream }) {
    const payload = {
      model,
      messages,
      user_id: userId,
      provider_keys: providerKeys,
      tier,
      cache,
      ...(stream ? { stream: true } : {}),
      ...extraBody,
    };
    // Deprecated no-op: the gateway ignores hedging_mode / hedge_delay_ms (providers are tried one at a time with
    // fallback). Still forwarded so existing callers keep working; do not rely on it.
    if (hedgingMode !== undefined) payload.hedging_mode = hedgingMode;
    if (hedgeDelayMs !== undefined) payload.hedge_delay_ms = hedgeDelayMs;
    if (difficulty !== undefined) payload.difficulty = difficulty;
    if (mode !== undefined) payload.mode = mode;
    if (constraints !== undefined) payload.constraints = constraints;
    if (plugins !== undefined) payload.plugins = plugins;
    if (routerMetadata) payload.router_metadata = true;
    const extraHeaders = {};
    if (routerMetadata) extraHeaders['X-Router-Metadata'] = 'enabled';
    if (cacheBypass) extraHeaders['X-Cache-Bypass'] = 'true';
    if (allowQueue || extraBody?.allowQueue || extraBody?.allow_queue) extraHeaders['X-SentioGate-Allow-Queue'] = 'true';
    if (stream) extraHeaders['Accept'] = 'text/event-stream';
    return { body: JSON.stringify(payload), headers: this._headers(extraHeaders) };
  }

  /**
   * Route a chat completion request.
   *
   * @param {Object} params
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {string} [params.model='auto']
   * @param {Record<string, string>} [params.providerKeys]
   * @param {string} [params.userId='default_user']
   * @param {number} [params.difficulty]
   * @param {string} [params.mode]
   * @param {Object} [params.constraints]
   * @param {Array<Object>} [params.plugins]
   * @param {boolean} [params.routerMetadata=true]
   * @param {string} [params.tier='free']
   * @param {string} [params.hedgingMode] Deprecated: ignored by the gateway (no hedged racing).
   * @param {number} [params.hedgeDelayMs] Deprecated: ignored by the gateway.
   * @param {boolean} [params.allowQueue]
   * @param {Object} [params.extraBody]
   * @returns {Promise<Object>}
   */
  async chat({
    messages,
    model = 'auto',
    providerKeys = {},
    userId = 'default_user',
    difficulty,
    mode,
    constraints,
    plugins,
    routerMetadata = true,
    tier = 'free',
    hedgingMode,
    hedgeDelayMs,
    cache = false,
    cacheBypass = false,
    allowQueue = false,
    extraBody = {},
  }) {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const { body, headers } = this._chatRequest({ messages, model, providerKeys, userId, difficulty, mode, constraints,
      plugins, routerMetadata, tier, hedgingMode, hedgeDelayMs, cache, cacheBypass, allowQueue, extraBody, stream: false });

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      let err;
      try {
        const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
        if (res.status === 202) return await res.json();
        if (res.ok) return await res.json();
        err = await errorFrom(res, 'Router HTTP');
      } catch (e) {
        if (e instanceof RouterClientError) throw e;
        throw new RouterClientError(`Router chat failed: ${e.message}`);
      } finally {
        clearTimeout(timer);
      }
      if (!(await this._shouldRetry(err, attempt))) throw err;
    }
  }

  /**
   * Stream chat completion chunks (SSE). Errors (429 upstream_rate_limited with Retry-After, 403
   * community_pool_disabled_with_byok, ...) arrive as an HTTP status before the first chunk and throw
   * RouterClientError with code / retryAfter; maxRetries applies only before any chunk is yielded.
   * The timeout covers the time to the response headers.
   *
   * @param {Object} params Same as chat().
   * @returns {AsyncGenerator<Object>}
   */
  async *streamChat({
    messages, model = 'auto', providerKeys = {}, userId = 'default_user', difficulty, mode, constraints, plugins,
    routerMetadata = false, tier = 'free', hedgingMode, hedgeDelayMs, cache = false, cacheBypass = false,
    allowQueue = false, extraBody = {},
  }) {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const { body, headers } = this._chatRequest({ messages, model, providerKeys, userId, difficulty, mode, constraints,
      plugins, routerMetadata, tier, hedgingMode, hedgeDelayMs, cache, cacheBypass, allowQueue, extraBody, stream: true });
    let res;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
      } catch (e) {
        throw new RouterClientError(`Router stream failed: ${e.message}`);
      } finally {
        clearTimeout(timer);
      }
      if (res.ok) break;
      const err = await errorFrom(res, 'Router stream HTTP');
      if (!(await this._shouldRetry(err, attempt))) throw err;
    }
    if (res.status === 202 || !(res.headers.get('content-type') || '').includes('text/event-stream') || !res.body) {
      yield await res.json(); // queued (202) or a non-stream answer (e.g. a cache hit)
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          try { yield JSON.parse(data); } catch { /* keep-alive / partial */ }
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  }

  /**
   * Enqueue an asynchronous batch inference item.
   *
   * @param {Object} params
   * @param {Array<{role: string, content: string}>} [params.messages]
   * @param {string} [params.itemText]
   * @param {string} [params.model='sentiogate-community']
   * @returns {Promise<{job_id: string, status: string, poll_url: string}>}
   */
  async enqueueBatch({ messages, itemText, model = 'sentiogate-community', extra = {} }) {
    const url = `${this.baseUrl}/v1/batch/enqueue`;
    const payload = {
      model,
      ...(messages ? { messages } : {}),
      ...(itemText ? { item_text: itemText } : {}),
      ...extra,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status !== 202) {
      const err = await errorFrom(res, 'Enqueue batch HTTP');
      err.message = `Enqueue batch failed (${res.status}): ${typeof err.responseBody === 'string' ? err.responseBody : JSON.stringify(err.responseBody)}`;
      throw err;
    }
    return await res.json();
  }

  /**
   * Poll status of an enqueued batch job.
   *
   * @param {string} jobId
   * @returns {Promise<{job_id: string, status: string, response: any, error: string}>}
   */
  async pollBatch(jobId) {
    const cleanId = String(jobId || '').replace(/^\/api\/batch\/poll\//, '').replace(/^\/v1\/batch\/poll\//, '');
    const url = `${this.baseUrl}/v1/batch/poll/${encodeURIComponent(cleanId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this._headers(),
    });
    if (!res.ok) {
      const err = await errorFrom(res, 'Poll batch HTTP');
      err.message = `Poll batch failed (${res.status}): ${typeof err.responseBody === 'string' ? err.responseBody : JSON.stringify(err.responseBody)}`;
      throw err;
    }
    return await res.json();
  }

  /**
   * Report an outcome signal for a previous request.
   * Compatibility only: the hosted gateway answers `{ accepted: false }`; the signal is not stored and does not
   * change routing.
   *
   * @param {Object} params
   * @param {string} params.requestId
   * @param {Record<string, boolean>} params.signals
   * @param {string} [params.provider]
   * @param {string} [params.taskClass]
   * @returns {Promise<Object>}
   */
  async reportOutcome({ requestId, signals, provider, taskClass }) {
    const url = `${this.baseUrl}/v1/outcomes`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        request_id: requestId,
        signals,
        provider,
        task_class: taskClass,
      }),
    });
    if (!res.ok) {
      throw new RouterClientError(`Outcome report failed: ${res.status}`);
    }
    return await res.json();
  }

  /**
   * List registered models.
   * @returns {Promise<Array<Object>>}
   */
  async listModels() {
    const url = `${this.baseUrl}/v1/models`;
    const res = await fetch(url, { method: 'GET', headers: this._headers() });
    if (!res.ok) throw new RouterClientError(`List models failed: ${res.status}`);
    const data = await res.json();
    return data.data || [];
  }

  /**
   * Fetch public benchmark dataset.
   * @returns {Promise<Array<Object>>}
   */
  async getBenchmarks() {
    const url = `${this.baseUrl}/v1/benchmarks`;
    const res = await fetch(url, { method: 'GET', headers: this._headers() });
    if (!res.ok) throw new RouterClientError(`Get benchmarks failed: ${res.status}`);
    const data = await res.json();
    return data.benchmarks || [];
  }

  /**
   * Fetch active session handoff summary and state.
   * @param {string} sessionId
   * @returns {Promise<Object>}
   */
  async getSessionHandoff(sessionId) {
    const url = `${this.baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/handoff`;
    const res = await fetch(url, { method: 'GET', headers: this._headers() });
    if (!res.ok) throw new RouterClientError(`Get session handoff failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Compatibility only: the hosted gateway does not compact or store anything and answers
   * `{ accepted: false, compacted: false }`.
   * @param {Object} params
   * @param {string} params.sessionId
   * @param {Array<Object>} params.messages
   * @param {string} [params.userId='default_user']
   * @returns {Promise<Object>}
   */
  async compactSession({ sessionId, messages, userId = 'default_user' }) {
    const url = `${this.baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/compact`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ messages, user_id: userId }),
    });
    if (!res.ok) throw new RouterClientError(`Compact session failed: ${res.status}`);
    return await res.json();
  }

  /**
   * List registered custom OpenAI-compatible providers.
   * @param {string} [userId='default_user']
   * @returns {Promise<Array<Object>>}
   */
  async listCustomProviders(userId = 'default_user') {
    const url = `${this.baseUrl}/v1/custom-providers?user_id=${encodeURIComponent(userId)}`;
    const res = await fetch(url, { method: 'GET', headers: this._headers() });
    if (!res.ok) throw new RouterClientError(`List custom providers failed: ${res.status}`);
    const data = await res.json();
    return data.data || [];
  }

  /**
   * Register or update a custom OpenAI-compatible provider.
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async registerCustomProvider(params) {
    const url = `${this.baseUrl}/v1/custom-providers`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new RouterClientError(`Register custom provider failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Delete a custom provider.
   * @param {string} providerId
   * @param {string} [userId='default_user']
   * @returns {Promise<Object>}
   */
  async deleteCustomProvider(providerId, userId = 'default_user') {
    const url = `${this.baseUrl}/v1/custom-providers/${encodeURIComponent(providerId)}?user_id=${encodeURIComponent(userId)}`;
    const res = await fetch(url, { method: 'DELETE', headers: this._headers() });
    if (!res.ok) throw new RouterClientError(`Delete custom provider failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Fetch cache statistics for your account.
   * @returns {Promise<Object>}
   */
  async getCacheStats() {
    const url = `${this.baseUrl}/v1/cache/stats`;
    const res = await fetch(url, { method: 'GET', headers: this._headers() });
    if (!res.ok) throw new RouterClientError(`Fetch cache stats failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Flush your own cached responses (the signed-in account's cache).
   * @returns {Promise<Object>}
   */
  async clearCache() {
    const url = `${this.baseUrl}/v1/cache`;
    const res = await fetch(url, { method: 'DELETE', headers: this._headers() });
    if (!res.ok) throw new RouterClientError(`Clear cache failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Fetch dynamic community capacity pool status.
   * @returns {Promise<Object>}
   */
  async getCapacityPool() {
    const url = `${this.baseUrl}/v1/capacity`;
    const res = await fetch(url, { method: 'GET', headers: this._headers() });
    if (!res.ok) throw new RouterClientError(`Fetch capacity pool failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Redeem a license code for the signed-in account.
   * @param {Object} params
   * @param {string} params.code
   * @param {string} [params.userId='default_user']
   * @returns {Promise<Object>}
   */
  async redeemLicense({ code, userId = 'default_user' }) {
    const url = `${this.baseUrl}/v1/licenses/redeem`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ code, user_id: userId }),
    });
    if (!res.ok) throw new RouterClientError(`Redeem license failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Fetch user active redeemed license voucher.
   * @param {string} [userId='default_user']
   * @returns {Promise<Object>}
   */
  async getUserLicense(userId = 'default_user') {
    const url = `${this.baseUrl}/v1/licenses/user/${encodeURIComponent(userId)}`;
    const res = await fetch(url, { method: 'GET', headers: this._headers() });
    if (!res.ok) throw new RouterClientError(`Fetch user license failed: ${res.status}`);
    return await res.json();
  }
}

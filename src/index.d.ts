/**
 * TypeScript Type Definitions for @sentiogate/sdk
 * Zero-markup BYOK client SDK for SentioGate.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | string;
  content: string;
  name?: string;
}

export interface AutoRouterOptions {
  baseUrl?: string;
  apiKey?: string | null;
  /** Milliseconds; default 130000, generous enough for long-running requests. */
  timeout?: number;
  /** Opt-in (default 0): retry transient 429s after the server's Retry-After. */
  maxRetries?: number;
  /** Never wait longer than this for a retry (default 60000 ms; the server may ask you to wait via Retry-After). */
  maxRetryWaitMs?: number;
  /** Node / server runtimes only; browsers control their own User-Agent. */
  userAgent?: string;
}

/** Error codes returned by the SentioGate API (error.code). Open-ended: new codes may appear. */
export type RouterErrorCode =
  | 'upstream_rate_limited'
  | 'rate_limited'
  | 'rate_limit_unavailable'
  | 'upstream_circuit_open'
  | 'community_pool_exhausted'
  | 'community_pool_unavailable'
  | 'community_pool_disabled'
  | 'community_pool_disabled_with_byok'
  | 'community_upstream_error'
  | 'community_upstream_timeout'
  | 'monthly_request_limit'
  | 'batch_pending_limit'
  | 'batch_only_model'
  | 'live_only_model'
  | 'no_provider_key'
  | 'invalid_api_key'
  | 'payload_too_large'
  | 'context_limit_exceeded'
  | (string & {});

export interface ChatParams {
  messages: ChatMessage[];
  model?: string;
  providerKeys?: Record<string, string>;
  userId?: string;
  difficulty?: number;
  mode?: 'cost' | 'latency' | 'quality' | 'balanced' | string;
  constraints?: Record<string, any>;
  plugins?: Array<Record<string, any>>;
  routerMetadata?: boolean;
  tier?: 'free' | 'pro' | 'team' | 'business' | string;
  /** @deprecated Ignored by the gateway: providers are tried one at a time with fallback (no hedged racing). */
  hedgingMode?: 'off' | 'conservative' | 'aggressive' | string;
  /** @deprecated Ignored by the gateway. */
  hedgeDelayMs?: number;
  cache?: boolean;
  cacheBypass?: boolean;
  allowQueue?: boolean;
  extraBody?: Record<string, any>;
}

export interface ChatChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason?: string;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  provider: string;
  choices: ChatChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost_usd?: number;
  };
  router?: {
    request_id?: string;
    latency_ms?: number;
    features?: Record<string, any>;
    metadata?: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface OutcomeParams {
  requestId: string;
  signals: Record<string, boolean>;
  provider?: string;
  taskClass?: string;
}

export interface CustomProviderParams {
  provider_id: string;
  display_name: string;
  base_url: string;
  api_key?: string;
  api_type?: string;
  models?: Array<Record<string, any>>;
  headers?: Record<string, string>;
  user_id?: string;
}

export declare class RouterClientError extends Error {
  statusCode: number | null;
  responseBody: any;
  /** error.code from the JSON body, e.g. 'upstream_rate_limited'. */
  code: RouterErrorCode | null;
  /** error.type from the JSON body, e.g. 'rate_limit_error'. */
  type: string | null;
  /** Server Retry-After in seconds, when sent. */
  retryAfter: number | null;
  /** A 429 with Retry-After and a transient code (see RETRYABLE_CODES). */
  readonly retryable: boolean;
  constructor(message: string, statusCode?: number | null, responseBody?: any, extra?: { code?: string | null; type?: string | null; retryAfter?: number | null });
}

export declare const VERSION: string;
export declare const USER_AGENT: string;
export declare const RETRYABLE_CODES: readonly string[];
/** Retry-After header -> seconds (delta-seconds or HTTP-date), or null. */
export declare function parseRetryAfter(value: string | null | undefined, now?: number): number | null;
/** Validates and normalizes client baseUrl to ensure safe HTTP/HTTPS protocol scheme. */
export declare function validateBaseUrl(url?: string | null): string;

export declare const DEFAULT_BASE_URL: 'https://api.sentiogate.dev';
/** 130000 ms. */
export declare const DEFAULT_TIMEOUT_MS: number;

export declare class AutoRouter {
  baseUrl: string;
  apiKey: string | null;
  timeout: number;
  maxRetries: number;
  maxRetryWaitMs: number;
  userAgent: string;

  constructor(options?: AutoRouterOptions);

  chat(params: ChatParams): Promise<ChatResponse>;
  /** SSE chunks; errors arrive before the first chunk as RouterClientError (code, retryAfter). */
  streamChat(params: ChatParams): AsyncGenerator<Record<string, any>, void, unknown>;
  enqueueBatch(params: { messages?: ChatMessage[]; itemText?: string; model?: string; extra?: Record<string, any> }): Promise<{ job_id: string; status: string; poll_url: string; [key: string]: any }>;
  pollBatch(jobId: string): Promise<{ job_id: string; status: string; response?: any; error?: string; [key: string]: any }>;
  /** Compatibility only: answers `{ accepted: false }`; nothing is stored or used for routing. */
  reportOutcome(params: OutcomeParams): Promise<Record<string, any>>;
  listModels(): Promise<Array<Record<string, any>>>;
  getBenchmarks(): Promise<Array<Record<string, any>>>;
  getSessionHandoff(sessionId: string): Promise<Record<string, any>>;
  /** Compatibility only: answers `{ accepted: false, compacted: false }`; nothing is compacted or stored. */
  compactSession(params: { sessionId: string; messages: ChatMessage[]; userId?: string }): Promise<Record<string, any>>;
  listCustomProviders(userId?: string): Promise<Array<Record<string, any>>>;
  registerCustomProvider(params: CustomProviderParams): Promise<Record<string, any>>;
  deleteCustomProvider(providerId: string, userId?: string): Promise<Record<string, any>>;
  getCacheStats(): Promise<Record<string, any>>;
  /** Flushes the signed-in account's own cache. */
  clearCache(): Promise<Record<string, any>>;
  getCapacityPool(): Promise<Record<string, any>>;
  redeemLicense(params: { code: string; userId?: string }): Promise<Record<string, any>>;
  getUserLicense(userId?: string): Promise<Record<string, any>>;
}

export default AutoRouter;

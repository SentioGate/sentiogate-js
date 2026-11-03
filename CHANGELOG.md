# Changelog: @sentiogate/sdk

> Renamed from `@hushamdev/ai-auto-router-sdk`.

## Unreleased

Breaking (suggest releasing as 1.3.0; the API is still pre-2.0):
- Removed `getClusterHealth()` and `broadcastClusterBreaker()` and the `ClusterBreakerParams` type. Cluster
  coordination is not part of the hosted gateway (these always answered `accepted: false`).
- Removed `getEdgeStatus()` and `verifyTurnstile()`. They served the SentioGate web app's sign-in page, not API users.
- `clearCache()` no longer takes a `userId`; it always flushes the signed-in account's own cache (the server already
  ignored the parameter).

Changed:
- `User-Agent` is now `sentiogate-js/<version> (+https://sentiogate.app)`.
- Docs: Quickstart now uses the real `chat()` / `streamChat()` methods, `model: "auto"` and `route_preference`
  (the `auto:fastest` / `auto:cost-efficient` / `auto:reliable` aliases shown before never existed). Removed
  unverified latency and uptime claims.

## 1.2.0 (2026-10-20)

Added (backwards compatible):
- `RouterClientError` now carries `code`, `type`, `retryAfter` and a `retryable` getter, parsed from the JSON
  error body and the `Retry-After` header (seconds or HTTP-date). Messages include the server's error text.
- Opt-in retries: `new AutoRouter({ maxRetries, maxRetryWaitMs })`. Default `maxRetries: 0` (unchanged
  behaviour). Retries only 429 `upstream_rate_limited` / `rate_limited` / `upstream_circuit_open` that carry a
  Retry-After, waits at least 1 s, and never waits longer than `maxRetryWaitMs` (default 60 s), so long
  Retry-After waits surface immediately instead of blocking.
- `streamChat()` async generator for SSE, with the same structured errors.
- `parseRetryAfter`, `VERSION`, `USER_AGENT`, `RETRYABLE_CODES` exports; `RouterErrorCode` type.
- A `User-Agent` header from Node / server runtimes (not set in browsers); named after the old package at the time.

Changed:
- Default `timeout` raised from 30 s to 130 s (`DEFAULT_TIMEOUT_MS`), so long-running requests no longer time out
  on the client.
- Apache-2.0 `LICENSE` now ships in the package (it was listed in `files` but missing).

Fixed:
- `chat({ allowQueue: true })` (declared in the typings) now sends `X-SentioGate-Allow-Queue`.
- `enqueueBatch` / `pollBatch` errors now include `statusCode` and `code` (e.g. 403
  `community_pool_disabled_with_byok`, 429 `batch_pending_limit`).

Docs: free community pool (BYOK exclusivity, Retry-After behaviour).

## 1.1.0

- Batch helpers (`enqueueBatch`, `pollBatch`); default base URL `https://api.sentiogate.dev`.

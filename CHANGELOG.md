# Changelog: @hushamdev/ai-auto-router-sdk

## 1.2.0 (2026-10-20)

Added (backwards compatible):
- `RouterClientError` now carries `code`, `type`, `retryAfter` and a `retryable` getter, parsed from the JSON
  error body and the `Retry-After` header (seconds or HTTP-date). Messages include the server's error text.
- Opt-in retries: `new AutoRouter({ maxRetries, maxRetryWaitMs })`. Default `maxRetries: 0` (unchanged
  behaviour). Retries only 429 `upstream_rate_limited` / `rate_limited` / `upstream_circuit_open` that carry a
  Retry-After, waits at least 1 s, and never waits longer than `maxRetryWaitMs` (default 60 s), so the
  community pool's long cooldowns (up to 15 min) surface immediately instead of blocking.
- `streamChat()` async generator for SSE, with the same structured errors.
- `parseRetryAfter`, `VERSION`, `USER_AGENT`, `RETRYABLE_CODES` exports; `RouterErrorCode` type.
- `User-Agent: ai-auto-router-sdk-js/1.2.0` from Node / server runtimes (not set in browsers).

Changed:
- Default `timeout` raised from 30 s to 130 s (`DEFAULT_TIMEOUT_MS`), above the server's 120 s deadline for
  community-pool calls, so slow community answers no longer time out on the client.
- Apache-2.0 `LICENSE` now ships in the package (it was listed in `files` but missing).

Fixed:
- `chat({ allowQueue: true })` (declared in the typings) now sends `X-SentioGate-Allow-Queue`.
- `enqueueBatch` / `pollBatch` errors now include `statusCode` and `code` (e.g. 403
  `community_pool_disabled_with_byok`, 429 `batch_pending_limit`).

Docs: community pool (single fixed model, BYOK exclusivity, Retry-After behaviour).

## 1.1.0

- Batch helpers (`enqueueBatch`, `pollBatch`); default base URL `https://api.sentiogate.dev`.

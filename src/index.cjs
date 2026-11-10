const esm = require('./index.js');

module.exports = {
  AutoRouter: esm.AutoRouter,
  RouterClientError: esm.RouterClientError,
  DEFAULT_BASE_URL: esm.DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS: esm.DEFAULT_TIMEOUT_MS,
  VERSION: esm.VERSION,
  USER_AGENT: esm.USER_AGENT,
  RETRYABLE_CODES: esm.RETRYABLE_CODES,
  parseRetryAfter: esm.parseRetryAfter,
  validateBaseUrl: esm.validateBaseUrl,
  default: esm.AutoRouter,
};

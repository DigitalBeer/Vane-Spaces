// Classifies a model-provider failure so the fallback wrapper knows whether
// switching to another model can help. Ported from pi-orchestrator's
// src/pi-driver/provider-error.ts (same classes and patterns, same ordering),
// plus OpenRouter's "no longer free" wording.
//
//   "context"     -> the prompt was too big for the model. Another model with
//                    the same context won't help either; surface the error.
//   "unavailable" -> the model is gone, withdrawn, or no longer free.
//   "quota"       -> a usage, rate or credit limit was hit.
//   "transient"   -> overload, 5xx, timeouts, or the server is unreachable
//                    (e.g. a laptop running llama-server is asleep).
//   "auth"        -> the key is missing, wrong or expired. Like pi, which
//                    moves to the next rung on a 401: another provider has
//                    its own credentials.
//   "other"       -> anything else (bad request, parse errors). Never hidden
//                    behind a fallback, so real bugs stay visible.

export type ProviderErrorClass =
  | 'context'
  | 'unavailable'
  | 'quota'
  | 'transient'
  | 'auth'
  | 'other';

const pattern = (parts: string[]) => new RegExp(parts.join('|'), 'i');

const CONTEXT_PATTERN = pattern([
  'maximum context length',
  'context length exceeded',
  'context_length_exceeded',
  'context window',
  'exceeds? the context',
  'reduce the length',
  'prompt is too long',
  'too many tokens',
  'maximum prompt length',
  'input length and `max_tokens` exceed',
  'string too long',
]);

const UNAVAILABLE_PATTERN = pattern([
  'model is unavailable',
  'unavailable for free',
  'no longer (available )?(for )?free',
  'model_not_found',
  'no such model',
  'unknown model',
  'model not found',
  'is not a valid model',
  'does not exist or you do not have access',
  'no endpoints found',
  'no allowed providers',
]);

const QUOTA_PATTERN = pattern([
  'FreeUsageLimitError',
  'Monthly usage limit reached',
  'available balance',
  'insufficient_quota',
  'insufficient credits',
  'out of budget',
  'quota exceeded',
  'billing',
  'hit your limit',
  'usage limit',
  'limit reached',
  'rate_limit_error',
  'free-models-per-day',
]);

const AUTH_PATTERN = pattern([
  '^40[13]\\b',
  'invalid api key',
  'incorrect api key',
  'invalid_api_key',
  'missing authentication',
  'no auth credentials',
  'unauthorized',
  'authentication (failed|error)',
  'api key (is )?(expired|revoked|disabled)',
]);

const TRANSIENT_PATTERN = pattern([
  'overloaded',
  'rate.?limit',
  'too many requests',
  '\\b429\\b',
  '\\b50[0234]\\b',
  '\\b524\\b',
  'service.?unavailable',
  'server.?error',
  'internal.?error',
  'provider.?returned.?error',
  'network.?error',
  'connection.?error',
  'connection.?refused',
  'ECONNREFUSED',
  'ECONNRESET',
  'connection.?lost',
  'other side closed',
  'fetch failed',
  'getaddrinfo',
  'ENOTFOUND',
  'EAI_AGAIN',
  'upstream.?connect',
  'socket hang up',
  'timed? out',
  'timeout',
  'terminated',
  'stream(ing)? (response )?(failed|error|interrupted)',
  'ResourceExhausted',
]);

/** Checked in order: the most specific signal wins (see the pi original). */
export function classifyProviderError(error: unknown): ProviderErrorClass {
  const message = errorText(error);
  if (!message) return 'other';
  if (CONTEXT_PATTERN.test(message)) return 'context';
  if (UNAVAILABLE_PATTERN.test(message)) return 'unavailable';
  if (QUOTA_PATTERN.test(message)) return 'quota';
  if (AUTH_PATTERN.test(message)) return 'auth';
  if (TRANSIENT_PATTERN.test(message)) return 'transient';
  return 'other';
}

/** Whether trying a different model could succeed where this one failed. */
export const shouldFallBack = (cls: ProviderErrorClass): boolean =>
  cls === 'unavailable' ||
  cls === 'quota' ||
  cls === 'transient' ||
  cls === 'auth';

/** Message plus HTTP status and nested cause, which SDKs often split apart. */
export function errorText(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  const e = error as {
    message?: unknown;
    status?: unknown;
    code?: unknown;
    cause?: unknown;
  };
  const message = typeof e.message === 'string' ? e.message : '';
  const status = typeof e.status === 'number' ? String(e.status) : '';
  const parts = [
    // SDK messages often already start with the status ("401 Missing ...").
    status && !message.startsWith(status) ? status : '',
    typeof e.code === 'string' && !message.includes(e.code) ? e.code : '',
    message,
    e.cause && e.cause !== error ? errorText(e.cause) : '',
  ];
  return parts.filter(Boolean).join(' ');
}

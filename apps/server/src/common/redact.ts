/**
 * Secret redaction for logs. The original Gaps logged full tokens/keys at INFO;
 * we explicitly must not. This masks values of known-sensitive keys in objects
 * and strips secrets embedded in URL query strings.
 *
 * Used by the logging interceptor and can be called directly anywhere a value
 * is about to be logged.
 */

export const REDACTED = '[REDACTED]';

/**
 * Keys whose values are always sensitive. Matched case-insensitively against
 * both camelCase and snake_case / header-style variants.
 */
const SENSITIVE_KEYS = [
  'token',
  'apikey',
  'api_key',
  'password',
  'passwordhash',
  'password_hash',
  'plextoken',
  'plex_token',
  'x-emby-token',
  'x-plex-token',
  'x-api-key',
  'authorization',
  'webhookurl',
  'webhook_url',
  'botid',
  'bot_id',
  'bottoken',
  'bot_token',
  'secret',
  'accesstoken',
  'access_token',
  'client_secret',
  'clientsecret',
];

/** Query/path parameters whose values must be masked when embedded in URLs. */
const SENSITIVE_URL_PARAMS = [
  'api_key',
  'apikey',
  'token',
  'plextoken',
  'x-plex-token',
  'access_token',
  'key',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.includes(normalized);
}

/**
 * Redact secrets from a string. Handles URL query parameters (`?api_key=...`,
 * `&token=...`) and `bot<token>/` path segments (Telegram-style) and bearer
 * tokens in Authorization-like strings.
 */
function redactString(value: string): string {
  let out = value;

  // URL query params: ?api_key=XXX or &token=XXX (stop at & or # or whitespace).
  out = out.replace(
    /([?&](?:api_?key|token|plex_?token|x-plex-token|access_token|key)=)([^&#\s]+)/gi,
    (_m, prefix: string) => `${prefix}${REDACTED}`,
  );

  // Telegram-style bot token in path: /bot123456:ABC.../
  out = out.replace(/\/bot[^/\s]+/gi, `/bot${REDACTED}`);

  // Bearer / Basic credentials in an Authorization-style value.
  out = out.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`);

  return out;
}

/**
 * Redact secrets from any value: masks sensitive object keys recursively and
 * scrubs secret-bearing URL params / tokens from strings. Returns a new value;
 * never mutates the input. Handles cycles, arrays, Errors, and plain objects.
 */
export function redactSecrets<T>(value: T): T {
  return redactInternal(value, new WeakSet()) as T;
}

function redactInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;

  if (value instanceof Error) {
    // Preserve the error but scrub its message (e.g. a fetch error with a URL).
    const clone = new Error(redactString(value.message));
    clone.name = value.name;
    clone.stack = value.stack ? redactString(value.stack) : value.stack;
    return clone;
  }

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactInternal(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      out[key] = val === undefined || val === null ? val : REDACTED;
    } else {
      out[key] = redactInternal(val, seen);
    }
  }
  return out;
}

export { SENSITIVE_URL_PARAMS };

/**
 * Minimal logger that filters sensitive fields.
 * v1 just prints to stdout; file-based logging comes in a later milestone.
 */

const SENSITIVE_KEYS = [
  'api_key',
  'apiKey',
  'token',
  'password',
  'authorization',
  'cookie',
  'session',
];

function redact(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

function format(level: string, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const metaStr = meta !== undefined ? ' ' + JSON.stringify(redact(meta)) : '';
  return `[${ts}] [${level}] ${msg}${metaStr}`;
}

export const logger = {
  info(msg: string, meta?: unknown) {
    console.log(format('INFO', msg, meta));
  },
  warn(msg: string, meta?: unknown) {
    console.warn(format('WARN', msg, meta));
  },
  error(msg: string, meta?: unknown) {
    console.error(format('ERROR', msg, meta));
  },
  debug(msg: string, meta?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(format('DEBUG', msg, meta));
    }
  },
};

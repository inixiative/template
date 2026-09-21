/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { stringify } from 'safe-stable-stringify';

const sensitiveKey =
  /password|passwd|secret|token|authorization|cookie|api.?key|private.?key|credential|encrypted|(^|[._-])(email|phone|body|payload)($|[._-])/i;
const sanitizeString = (value: string): string =>
  value
    .replace(/(Bearer|Basic)\s+[^\s,;]+/gi, '$1 [REDACTED]')
    .replace(/(https?:\/\/|postgres(?:ql)?:\/\/|rediss?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/https?:\/\/[^\s)]+/gi, (url) => url.split(/[?#]/)[0] ?? '[URL]')
    .replace(/((?:password|secret|token|api[_-]?key|authorization)[\w_-]*\s*[=:]\s*)[^\s,;&]+/gi, '$1[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .slice(0, 4096);

export const redactLogValue = (value: unknown, seen = new WeakSet<object>(), depth = 0): unknown => {
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  if (depth >= 8) return '[Truncated]';
  seen.add(value);
  if (value instanceof Error && value.name.startsWith('PrismaClient'))
    return {
      name: value.name,
      message: 'Database operation failed',
      code: 'code' in value ? value.code : undefined,
      stack: value.stack
        ?.split('\n')
        .filter((line) => /^\s+at /.test(line))
        .join('\n')
        .slice(0, 4096),
    };
  if (value instanceof Error)
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
      cause: redactLogValue(value.cause, seen, depth + 1),
    };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactLogValue(item, seen, depth + 1));
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 100)
      .map(([key, item]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : redactLogValue(item, seen, depth + 1)]),
  );
};

export const stringifyLogValue = (value: unknown): string => stringify(redactLogValue(value)) ?? String(value);

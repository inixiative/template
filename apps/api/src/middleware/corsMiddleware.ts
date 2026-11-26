/**
 * @atlas
 * @kind middleware
 * @uses infrastructure:env, primitive:errors
 */
import { cors } from 'hono/cors';
import type { Env } from '#/config/env';
import { makeError } from '#/lib/errors';

const allowedOrigins: Record<Env['ENVIRONMENT'], string[]> = {
  local: ['*'],
  test: ['*'],
  pr: [],
  staging: [],
  prod: [],
};

const exactOriginOf = (value: string): string | null => {
  const parsed = URL.parse(value);
  return parsed && ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : null;
};

type HttpsWildcardPattern = {
  hostPrefix: string;
  hostSuffix: string;
  subdomainOnly: boolean;
};

const parseHttpsWildcardPattern = (pattern: string): HttpsWildcardPattern | null => {
  if (!pattern.startsWith('https://')) return null;
  const hostPattern = pattern.slice('https://'.length).toLowerCase();
  if (!/^[a-z0-9.*-]+$/.test(hostPattern) || hostPattern.includes('..')) return null;
  const parts = hostPattern.split('*');
  if (parts.length !== 2) return null;
  const [hostPrefix, hostSuffix] = parts as [string, string];
  if (!hostSuffix.includes('.') || hostSuffix.endsWith('.')) return null;
  const minSuffixLabels = hostSuffix.startsWith('.') ? 2 : 3;
  if (hostSuffix.split('.').filter(Boolean).length < minSuffixLabels) return null;
  return {
    hostPrefix,
    hostSuffix,
    subdomainOnly: hostPrefix === '' && hostSuffix.startsWith('.'),
  };
};

const isHttpsWildcardOriginMatch = (parsed: URL, pattern: HttpsWildcardPattern): boolean => {
  if (parsed.protocol !== 'https:' || parsed.port !== '') return false;
  const host = parsed.hostname.toLowerCase();
  if (!host.startsWith(pattern.hostPrefix) || !host.endsWith(pattern.hostSuffix)) return false;
  if (host.length <= pattern.hostPrefix.length + pattern.hostSuffix.length) return false;
  const matched = host.slice(pattern.hostPrefix.length, host.length - pattern.hostSuffix.length);
  const labelPattern = pattern.subdomainOnly ? /^[a-z0-9-]+(\.[a-z0-9-]+)*$/ : /^[a-z0-9-]+$/;
  return labelPattern.test(matched);
};

const configuredOriginPatterns = (): string[] =>
  (process.env.CORS_ALLOWED_ORIGIN_PATTERNS ?? '').split(',').flatMap((raw) => {
    const entry = raw.trim();
    if (!entry || entry === '*') return [];
    if (entry.includes('*')) return parseHttpsWildcardPattern(entry) ? [entry] : [];
    const exact = exactOriginOf(entry);
    return exact ? [exact] : [];
  });

export const allowedCorsOrigins = (): string[] => {
  const envUrls = [process.env.WEB_URL, process.env.ADMIN_URL, process.env.SUPERADMIN_URL].flatMap(
    (value) => {
      if (!value) return [];
      const exact = exactOriginOf(value);
      return exact ? [exact] : [];
    },
  );
  return [
    ...new Set([
      ...(allowedOrigins[process.env.ENVIRONMENT] ?? []),
      ...envUrls,
      ...configuredOriginPatterns(),
    ]),
  ];
};

export const matchingCorsOriginUrl = (origin: string): URL | null => {
  const parsed = URL.parse(origin);
  if (!parsed || parsed.origin !== origin) return null;

  for (const pattern of allowedCorsOrigins()) {
    if (pattern === '*') return parsed;
    if (pattern === origin) return parsed;
    if (pattern.includes('*')) {
      const wildcard = parseHttpsWildcardPattern(pattern);
      if (wildcard && isHttpsWildcardOriginMatch(parsed, wildcard)) return parsed;
    }
  }

  return null;
};

export const matchingCorsOrigin = (origin: string): string | null =>
  matchingCorsOriginUrl(origin)?.origin ?? null;

export const requireAllowedCorsOriginUrl = (origin: string): URL => {
  const parsed = matchingCorsOriginUrl(origin);
  if (!parsed) throw makeError({ status: 403, message: 'Origin is not allowed' });
  return parsed;
};

export const corsMiddleware = cors({
  origin: matchingCorsOrigin,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'x-spoof-user-email',
    'traceparent',
    'tracestate',
  ],
  exposeHeaders: ['request-id', 'traceparent'],
  credentials: true,
});

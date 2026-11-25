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
  pr: ['*.vercel.app', '*.render.com'],
  staging: ['*.vercel.app', '*.render.com'],
  prod: [],
};

export const allowedCorsOrigins = (): string[] => {
  return [
    ...(allowedOrigins[process.env.ENVIRONMENT] ?? []),
    ...[process.env.WEB_URL, process.env.ADMIN_URL, process.env.SUPERADMIN_URL].filter(
      (origin): origin is string => !!origin,
    ),
  ];
};

export const matchingCorsOriginUrl = (origin: string): URL | null => {
  const parsed = URL.parse(origin);
  if (!parsed || parsed.origin !== origin) return null;

  for (const pattern of allowedCorsOrigins()) {
    if (pattern === '*') return parsed;
    if (pattern === origin) return parsed;
    if (pattern.startsWith('*') && origin.endsWith(pattern.slice(1))) return parsed;
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

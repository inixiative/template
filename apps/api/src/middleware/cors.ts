import { cors } from 'hono/cors';
import type { Env } from '#/config/env';

const allowedOrigins: Record<Env['ENVIRONMENT'], string[]> = {
  local: ['*'],
  test: ['*'],
  develop: ['*localhost:*', '*.vercel.app'],
  staging: ['*.vercel.app'],
  production: [],
};

export const getAllowedOrigins = (): string[] => {
  return allowedOrigins[process.env.ENVIRONMENT] ?? [];
};

const validateOrigin = (origin: string): string | null => {
  const origins = allowedOrigins[process.env.ENVIRONMENT] ?? [];

  for (const pattern of origins) {
    if (pattern === '*') return origin;
    if (pattern === origin) return origin;
    if (pattern.startsWith('*') && origin.endsWith(pattern.slice(1))) return origin;
  }

  return null;
};

export const corsMiddleware = cors({
  origin: validateOrigin,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'spoof-user-email'],
  credentials: true,
});

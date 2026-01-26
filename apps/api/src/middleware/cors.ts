import { cors } from 'hono/cors';
import { env } from '#/config/env';

const allowedOrigins: Record<string, string[]> = {
  local: ['*'],
  test: ['*'],
  dev: ['*localhost:*', '*.vercel.app'],
  staging: ['*.vercel.app'],
  sandbox: ['*.vercel.app'],
  prod: [],
};

export const getAllowedOrigins = (): string[] => {
  return allowedOrigins[env.ENVIRONMENT] ?? [];
};

const validateOrigin = (origin: string): string | null => {
  const origins = allowedOrigins[env.ENVIRONMENT] ?? [];

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

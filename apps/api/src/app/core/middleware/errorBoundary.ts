import { Elysia } from 'elysia';
import * as Sentry from '@sentry/node';

export const errorBoundary = new Elysia({ name: 'errorBoundary' })
  .derive(({ env }) => {
    if (env.SENTRY_ENABLED && env.SENTRY_DSN) {
      Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.ENVIRONMENT,
        tracesSampleRate: 1.0,
      });
    }
    return {};
  })
  .onError(({ error, code, request, env }) => {
    console.error(`[${code}] ${request.method} ${request.url}:`, error);
    
    if (env.SENTRY_ENABLED && env.SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: {
          code,
          method: request.method,
          url: request.url,
        },
      });
    }
    
    return {
      error: code,
      message: error.message,
    };
  });
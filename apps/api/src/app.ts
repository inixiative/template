import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { errorHandlerMiddleware } from '@src/middleware/error/errorHandlerMiddleware';
import { notFoundHandlerMiddleware } from '@src/middleware/error/notFoundHandlerMiddleware';
import { authMiddleware } from '@src/middleware/auth/authMiddleware';
import { authRoutes } from '@src/modules/auth';
import type { AppEnv } from '@src/types/appEnv';
import { db } from '@template/db';
import { env } from '@src/config/env';

// Create the Hono app instance
export const app = new OpenAPIHono<AppEnv>();

// CORS
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Inject database into context
app.use('*', async (c, next) => {
  c.set('db', db);
  c.set('requestId', crypto.randomUUID());
  c.set('user', null);
  await next();
});

// Auth middleware (extracts JWT, sets user in context)
app.use('*', authMiddleware);

// Global error handler
app.onError(errorHandlerMiddleware);

// Health check (no auth)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount auth routes at /auth
app.route('/auth', authRoutes);

// OpenAPI docs
app.doc31('/openapi/docs', {
  openapi: '3.1.0',
  info: {
    title: 'Inixiative API',
    version: '0.1.0',
    description: 'Identity & Payment Platform API',
  },
});

// Global not found handler
app.notFound(notFoundHandlerMiddleware);

import { OpenAPIHono } from '@hono/zod-openapi';
import { isTest } from '@template/shared/utils';
import { auth } from '#/lib/auth';
import { corsMiddleware } from '#/middleware/corsMiddleware';
import { testRouter } from '#/modules/test';
import { apiRouter } from '#/routes/api';
import { bullBoardRouter } from '#/routes/bullBoard';
import { healthRouter } from '#/routes/health';
import type { AppEnv } from '#/types/appEnv';

export const routes = new OpenAPIHono<AppEnv>();

// Public routes (no auth)
routes.route('/health', healthRouter);

// Auth routes (cors only - better-auth handles its own auth)
routes.use('/auth/*', corsMiddleware);
routes.all('/auth/*', (c) => auth.handler(c.req.raw));

// API routes (full middleware stack in api.ts)
routes.route('/api', apiRouter);

// BullBoard (basic auth configured in bullBoard.ts)
routes.route('/bullBoard', bullBoardRouter);

// Test routes (only in test environment)
if (isTest) routes.route('/test', testRouter);

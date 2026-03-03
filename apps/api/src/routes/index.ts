import { OpenAPIHono } from '@hono/zod-openapi';
import { isTest } from '@template/shared/utils';
import { testRouter } from '#/modules/test';
import { apiRouter } from '#/routes/api';
import { bullBoardRouter } from '#/routes/bullBoard';
import { healthRouter } from '#/routes/health';
import type { AppEnv } from '#/types/appEnv';

export const routes = new OpenAPIHono<AppEnv>();

// Public routes (no auth)
routes.route('/health', healthRouter);

// API routes (includes /api/auth/* - see api.ts)
routes.route('/api', apiRouter);

// BullBoard (basic auth configured in bullBoard.ts)
routes.route('/bullBoard', bullBoardRouter);

// Test routes (only in test environment)
if (isTest) routes.route('/test', testRouter);

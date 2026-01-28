import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

import { adminCacheClearController } from './controllers/adminCacheClear';
import { adminCacheClearRoute } from './routes/adminCacheClear';

export const adminCacheRouter = new OpenAPIHono<AppEnv>();

adminCacheRouter.openapi(adminCacheClearRoute, adminCacheClearController);

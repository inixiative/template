import { OpenAPIHono } from '@hono/zod-openapi';
import { adminCacheClearController } from '#/modules/admin/cache/controllers/adminCacheClear';
import { adminCacheClearRoute } from '#/modules/admin/cache/routes/adminCacheClear';
import type { AppEnv } from '#/types/appEnv';

export const adminCacheRouter = new OpenAPIHono<AppEnv>();

adminCacheRouter.openapi(adminCacheClearRoute, adminCacheClearController);

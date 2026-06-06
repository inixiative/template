import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { adminCacheClearController } from '#/modules/admin/cache/controllers/adminCacheClear';
import { adminCacheClearRoute } from '#/modules/admin/cache/routes/adminCacheClear';
import type { AppEnv } from '#/types/appEnv';

export const adminCacheRouter = new OpenAPIHono<AppEnv>();

adminCacheRouter.openapi(toOpenApi(adminCacheClearRoute), adminCacheClearController);

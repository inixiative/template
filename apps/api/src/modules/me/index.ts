import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { meResourceMiddleware } from '#/middleware/resources/meResourceMiddleware';
import type { AppEnv } from '#/types/appEnv';

export const meRouter = new OpenAPIHono<AppEnv>();

meRouter.use('*', meResourceMiddleware);

await autoRegisterRoutes(meRouter, import.meta.dirname);

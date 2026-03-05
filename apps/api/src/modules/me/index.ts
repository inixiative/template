import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateUser } from '#/middleware/validations/validateUser';
import type { AppEnv } from '#/types/appEnv';

export const meRouter = new OpenAPIHono<AppEnv>();

meRouter.use('*', validateUser);

await autoRegisterRoutes(meRouter, import.meta.dirname);

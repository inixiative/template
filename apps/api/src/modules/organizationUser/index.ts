import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const organizationUserRouter = new OpenAPIHono<AppEnv>();

organizationUserRouter.use('*', validateActor);

await autoRegisterRoutes(organizationUserRouter, import.meta.dirname);

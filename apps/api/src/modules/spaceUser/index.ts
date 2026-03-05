import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const spaceUserRouter = new OpenAPIHono<AppEnv>();

spaceUserRouter.use('*', validateActor);

await autoRegisterRoutes(spaceUserRouter, import.meta.dirname);

import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const flowRouter = new OpenAPIHono<AppEnv>();

flowRouter.use('*', validateActor);

await autoRegisterRoutes(flowRouter, import.meta.dirname);

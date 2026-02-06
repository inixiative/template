import { OpenAPIHono } from '@hono/zod-openapi';
import { validateActor } from '#/middleware/validations/validateActor';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const tokenRouter = new OpenAPIHono<AppEnv>();

tokenRouter.use('*', validateActor);

await autoRegisterRoutes(tokenRouter, import.meta.dirname);

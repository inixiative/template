import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const userRouter = new OpenAPIHono<AppEnv>();

userRouter.use('*', validateActor);

await autoRegisterRoutes(userRouter, import.meta.dirname);

export const adminUserRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminUserRouter, import.meta.dirname);

import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const userRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(userRouter, import.meta.dirname);

export const adminUserRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminUserRouter, import.meta.dirname);

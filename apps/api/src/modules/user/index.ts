import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const adminUserRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminUserRouter, import.meta.dirname);

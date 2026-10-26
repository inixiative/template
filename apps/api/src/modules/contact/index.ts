import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const contactRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(contactRouter, import.meta.dirname);

export const adminContactRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminContactRouter, import.meta.dirname);

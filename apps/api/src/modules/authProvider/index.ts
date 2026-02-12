import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const authProviderRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(authProviderRouter, import.meta.dirname);

export const adminAuthProviderRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminAuthProviderRouter, import.meta.dirname);

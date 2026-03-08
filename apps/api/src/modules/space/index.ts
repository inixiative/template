import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const spaceRouter = new OpenAPIHono<AppEnv>();

// Note: No validateActor middleware here - spaceRead is public
// Protected routes use validatePermission middleware individually

await autoRegisterRoutes(spaceRouter, import.meta.dirname);

// Admin router (mounted under /api/admin/space)
export const adminSpaceRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminSpaceRouter, import.meta.dirname);

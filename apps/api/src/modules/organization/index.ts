import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const organizationRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(organizationRouter, import.meta.dirname);

export const adminOrganizationRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminOrganizationRouter, import.meta.dirname);

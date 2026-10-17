import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const organizationRouter = new OpenAPIHono<AppEnv>();

organizationRouter.use('*', validateActor);

await autoRegisterRoutes(organizationRouter, import.meta.dirname);

export const adminOrganizationRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminOrganizationRouter, import.meta.dirname);

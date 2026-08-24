import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const integrationRouter = new OpenAPIHono<AppEnv>();

integrationRouter.use('*', validateActor);

await autoRegisterRoutes(integrationRouter, import.meta.dirname);

export const adminIntegrationRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminIntegrationRouter, import.meta.dirname);

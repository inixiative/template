/**
 * @atlas
 * @kind module
 * @partOf feature:project
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const projectIntegrationRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(projectIntegrationRouter, import.meta.dirname);

export const adminProjectIntegrationRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminProjectIntegrationRouter, import.meta.dirname);

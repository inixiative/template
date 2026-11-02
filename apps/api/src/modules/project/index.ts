/**
 * @atlas
 * @kind module
 * @partOf feature:project
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const projectRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(projectRouter, import.meta.dirname);

export const adminProjectRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminProjectRouter, import.meta.dirname);

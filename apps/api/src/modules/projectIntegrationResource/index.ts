/**
 * @atlas
 * @kind router
 * @partOf feature:project
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const projectIntegrationResourceRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(projectIntegrationResourceRouter, import.meta.dirname);

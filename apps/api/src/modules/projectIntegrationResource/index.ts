/**
 * @atlas
 * @kind module
 * @partOf feature:integrations, feature:project
 * @uses primitive:routeTemplates
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

const projectIntegrationResourceRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(projectIntegrationResourceRouter, import.meta.dir);

export { projectIntegrationResourceRouter };

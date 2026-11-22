/**
 * @atlas
 * @kind module
 * @partOf feature:integrations
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const integrationResourceRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(integrationResourceRouter, import.meta.dirname);

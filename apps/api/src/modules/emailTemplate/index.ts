import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const adminEmailTemplateRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminEmailTemplateRouter, import.meta.dirname);

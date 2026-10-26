import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const organizationUserRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(organizationUserRouter, import.meta.dirname);

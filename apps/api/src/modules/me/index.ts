import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const meRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(meRouter, import.meta.dirname);

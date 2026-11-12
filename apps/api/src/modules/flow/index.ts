import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const flowRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(flowRouter, import.meta.dirname);

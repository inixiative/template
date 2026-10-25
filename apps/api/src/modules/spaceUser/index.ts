import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const spaceUserRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(spaceUserRouter, import.meta.dirname);

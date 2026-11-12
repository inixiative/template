import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const tokenRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(tokenRouter, import.meta.dirname);

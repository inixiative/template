import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const identifyRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(identifyRouter, import.meta.dirname);

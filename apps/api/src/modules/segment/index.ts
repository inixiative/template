import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const segmentRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(segmentRouter, import.meta.dirname);

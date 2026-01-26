import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

export const healthRouter = new OpenAPIHono<AppEnv>();

healthRouter.get('/', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

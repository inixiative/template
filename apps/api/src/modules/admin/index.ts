import { OpenAPIHono } from '@hono/zod-openapi';
import { cronJobRouter } from '#/modules/admin/cronJob';
import type { AppEnv } from '#/types/appEnv';

export const adminModuleRouter = new OpenAPIHono<AppEnv>();

adminModuleRouter.route('/cronJob', cronJobRouter);

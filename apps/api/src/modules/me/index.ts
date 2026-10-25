import { OpenAPIHono } from '@hono/zod-openapi';
import { UserAction } from '@template/permissions/client';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import type { AppEnv } from '#/types/appEnv';

export const meRouter = new OpenAPIHono<AppEnv>();

meRouter.use('*', validateSelfPermission(UserAction.me));

await autoRegisterRoutes(meRouter, import.meta.dirname);

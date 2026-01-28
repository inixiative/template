import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

import { adminUserRedactRoute } from '#/modules/user/routes/adminUserRedact';
import { adminUserRedactController } from '#/modules/user/controllers/adminUserRedact';

export const adminUserRouter = new OpenAPIHono<AppEnv>();

adminUserRouter.openapi(adminUserRedactRoute, adminUserRedactController);

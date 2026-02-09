import { OpenAPIHono } from '@hono/zod-openapi';
import { adminUserRedactController } from '#/modules/user/controllers/adminUserRedact';

import { adminUserRedactRoute } from '#/modules/user/routes/adminUserRedact';
import type { AppEnv } from '#/types/appEnv';

export const adminUserRouter = new OpenAPIHono<AppEnv>();

adminUserRouter.openapi(adminUserRedactRoute, adminUserRedactController);

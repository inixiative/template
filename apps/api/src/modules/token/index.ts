import { OpenAPIHono } from '@hono/zod-openapi';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

import { tokenDeleteRoute } from '#/modules/token/routes/tokenDelete';
import { tokenDeleteController } from '#/modules/token/controllers/tokenDelete';

export const tokenRouter = new OpenAPIHono<AppEnv>();

tokenRouter.use('*', validateActor);

tokenRouter.openapi(tokenDeleteRoute, tokenDeleteController);

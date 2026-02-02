import { OpenAPIHono } from '@hono/zod-openapi';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

import { spaceUserReadRoute } from '#/modules/spaceUser/routes/spaceUserRead';
import { spaceUserUpdateRoute } from '#/modules/spaceUser/routes/spaceUserUpdate';
import { spaceUserDeleteRoute } from '#/modules/spaceUser/routes/spaceUserDelete';
import { spaceUserCreateTokenRoute } from '#/modules/spaceUser/routes/spaceUserCreateToken';

import { spaceUserReadController } from '#/modules/spaceUser/controllers/spaceUserRead';
import { spaceUserUpdateController } from '#/modules/spaceUser/controllers/spaceUserUpdate';
import { spaceUserDeleteController } from '#/modules/spaceUser/controllers/spaceUserDelete';
import { spaceUserCreateTokenController } from '#/modules/spaceUser/controllers/spaceUserCreateToken';

export const spaceUserRouter = new OpenAPIHono<AppEnv>();

spaceUserRouter.use('*', validateActor);

spaceUserRouter.openapi(spaceUserReadRoute, spaceUserReadController);
spaceUserRouter.openapi(spaceUserUpdateRoute, spaceUserUpdateController);
spaceUserRouter.openapi(spaceUserDeleteRoute, spaceUserDeleteController);
spaceUserRouter.openapi(spaceUserCreateTokenRoute, spaceUserCreateTokenController);

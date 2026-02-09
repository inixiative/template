import { OpenAPIHono } from '@hono/zod-openapi';
import { validateActor } from '#/middleware/validations/validateActor';
import { spaceUserCreateTokenController } from '#/modules/spaceUser/controllers/spaceUserCreateToken';
import { spaceUserDeleteController } from '#/modules/spaceUser/controllers/spaceUserDelete';
import { spaceUserReadController } from '#/modules/spaceUser/controllers/spaceUserRead';
import { spaceUserUpdateController } from '#/modules/spaceUser/controllers/spaceUserUpdate';
import { spaceUserCreateTokenRoute } from '#/modules/spaceUser/routes/spaceUserCreateToken';
import { spaceUserDeleteRoute } from '#/modules/spaceUser/routes/spaceUserDelete';
import { spaceUserReadRoute } from '#/modules/spaceUser/routes/spaceUserRead';
import { spaceUserUpdateRoute } from '#/modules/spaceUser/routes/spaceUserUpdate';
import type { AppEnv } from '#/types/appEnv';

export const spaceUserRouter = new OpenAPIHono<AppEnv>();

spaceUserRouter.use('*', validateActor);

spaceUserRouter.openapi(spaceUserReadRoute, spaceUserReadController);
spaceUserRouter.openapi(spaceUserUpdateRoute, spaceUserUpdateController);
spaceUserRouter.openapi(spaceUserDeleteRoute, spaceUserDeleteController);
spaceUserRouter.openapi(spaceUserCreateTokenRoute, spaceUserCreateTokenController);

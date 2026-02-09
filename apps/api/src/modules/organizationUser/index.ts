import { OpenAPIHono } from '@hono/zod-openapi';
import { validateActor } from '#/middleware/validations/validateActor';
import { organizationUserCreateTokenController } from '#/modules/organizationUser/controllers/organizationUserCreateToken';
import { organizationUserDeleteController } from '#/modules/organizationUser/controllers/organizationUserDelete';
import { organizationUserReadController } from '#/modules/organizationUser/controllers/organizationUserRead';
import { organizationUserUpdateController } from '#/modules/organizationUser/controllers/organizationUserUpdate';
import { organizationUserCreateTokenRoute } from '#/modules/organizationUser/routes/organizationUserCreateToken';
import { organizationUserDeleteRoute } from '#/modules/organizationUser/routes/organizationUserDelete';
import { organizationUserReadRoute } from '#/modules/organizationUser/routes/organizationUserRead';
import { organizationUserUpdateRoute } from '#/modules/organizationUser/routes/organizationUserUpdate';
import type { AppEnv } from '#/types/appEnv';

export const organizationUserRouter = new OpenAPIHono<AppEnv>();

organizationUserRouter.use('*', validateActor);

organizationUserRouter.openapi(organizationUserReadRoute, organizationUserReadController);
organizationUserRouter.openapi(organizationUserUpdateRoute, organizationUserUpdateController);
organizationUserRouter.openapi(organizationUserDeleteRoute, organizationUserDeleteController);
organizationUserRouter.openapi(organizationUserCreateTokenRoute, organizationUserCreateTokenController);

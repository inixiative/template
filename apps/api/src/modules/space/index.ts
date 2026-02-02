import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

import { spaceReadRoute } from '#/modules/space/routes/spaceRead';
import { spaceReadProtectedRoute } from '#/modules/space/routes/spaceReadProtected';
import { spaceUpdateRoute } from '#/modules/space/routes/spaceUpdate';
import { spaceDeleteRoute } from '#/modules/space/routes/spaceDelete';
import { spaceReadManySpaceUserRoute } from '#/modules/space/routes/spaceReadManySpaceUser';
import { spaceReadManyTokenRoute } from '#/modules/space/routes/spaceReadManyToken';
import { spaceReadManyCustomerRoute } from '#/modules/space/routes/spaceReadManyCustomer';
import { spaceCreateTokenRoute } from '#/modules/space/routes/spaceCreateToken';
import { adminSpaceReadManyRoute } from '#/modules/space/routes/adminSpaceReadMany';

import { spaceReadController } from '#/modules/space/controllers/spaceRead';
import { spaceReadProtectedController } from '#/modules/space/controllers/spaceReadProtected';
import { spaceUpdateController } from '#/modules/space/controllers/spaceUpdate';
import { spaceDeleteController } from '#/modules/space/controllers/spaceDelete';
import { spaceReadManySpaceUserController } from '#/modules/space/controllers/spaceReadManySpaceUser';
import { spaceReadManyTokenController } from '#/modules/space/controllers/spaceReadManyToken';
import { spaceReadManyCustomerController } from '#/modules/space/controllers/spaceReadManyCustomer';
import { spaceCreateTokenController } from '#/modules/space/controllers/spaceCreateToken';
import { adminSpaceReadManyController } from '#/modules/space/controllers/adminSpaceReadMany';

export const spaceRouter = new OpenAPIHono<AppEnv>();

// Note: No validateActor middleware here - spaceRead is public
// Protected routes use validatePermission middleware individually

spaceRouter.openapi(spaceReadRoute, spaceReadController);
spaceRouter.openapi(spaceReadProtectedRoute, spaceReadProtectedController);
spaceRouter.openapi(spaceUpdateRoute, spaceUpdateController);
spaceRouter.openapi(spaceDeleteRoute, spaceDeleteController);
spaceRouter.openapi(spaceReadManySpaceUserRoute, spaceReadManySpaceUserController);
spaceRouter.openapi(spaceReadManyTokenRoute, spaceReadManyTokenController);
spaceRouter.openapi(spaceReadManyCustomerRoute, spaceReadManyCustomerController);
spaceRouter.openapi(spaceCreateTokenRoute, spaceCreateTokenController);

// Admin router (mounted under /api/admin/space)
export const adminSpaceRouter = new OpenAPIHono<AppEnv>();

adminSpaceRouter.openapi(adminSpaceReadManyRoute, adminSpaceReadManyController);

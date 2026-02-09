import { OpenAPIHono } from '@hono/zod-openapi';
import { adminSpaceReadManyController } from '#/modules/space/controllers/adminSpaceReadMany';
import { spaceCreateTokenController } from '#/modules/space/controllers/spaceCreateToken';
import { spaceDeleteController } from '#/modules/space/controllers/spaceDelete';
import { spaceReadController } from '#/modules/space/controllers/spaceRead';
import { spaceReadManyCustomersController } from '#/modules/space/controllers/spaceReadManyCustomers';
import { spaceReadManySpaceUsersController } from '#/modules/space/controllers/spaceReadManySpaceUsers';
import { spaceReadManyTokensController } from '#/modules/space/controllers/spaceReadManyTokens';
import { spaceReadProtectedController } from '#/modules/space/controllers/spaceReadProtected';
import { spaceUpdateController } from '#/modules/space/controllers/spaceUpdate';
import { adminSpaceReadManyRoute } from '#/modules/space/routes/adminSpaceReadMany';
import { spaceCreateTokenRoute } from '#/modules/space/routes/spaceCreateToken';
import { spaceDeleteRoute } from '#/modules/space/routes/spaceDelete';
import { spaceReadRoute } from '#/modules/space/routes/spaceRead';
import { spaceReadManyCustomersRoute } from '#/modules/space/routes/spaceReadManyCustomers';
import { spaceReadManySpaceUsersRoute } from '#/modules/space/routes/spaceReadManySpaceUsers';
import { spaceReadManyTokensRoute } from '#/modules/space/routes/spaceReadManyTokens';
import { spaceReadProtectedRoute } from '#/modules/space/routes/spaceReadProtected';
import { spaceUpdateRoute } from '#/modules/space/routes/spaceUpdate';
import type { AppEnv } from '#/types/appEnv';

export const spaceRouter = new OpenAPIHono<AppEnv>();

// Note: No validateActor middleware here - spaceRead is public
// Protected routes use validatePermission middleware individually

spaceRouter.openapi(spaceReadRoute, spaceReadController);
spaceRouter.openapi(spaceReadProtectedRoute, spaceReadProtectedController);
spaceRouter.openapi(spaceUpdateRoute, spaceUpdateController);
spaceRouter.openapi(spaceDeleteRoute, spaceDeleteController);
spaceRouter.openapi(spaceReadManySpaceUsersRoute, spaceReadManySpaceUsersController);
spaceRouter.openapi(spaceReadManyTokensRoute, spaceReadManyTokensController);
spaceRouter.openapi(spaceReadManyCustomersRoute, spaceReadManyCustomersController);
spaceRouter.openapi(spaceCreateTokenRoute, spaceCreateTokenController);

// Admin router (mounted under /api/admin/space)
export const adminSpaceRouter = new OpenAPIHono<AppEnv>();

adminSpaceRouter.openapi(adminSpaceReadManyRoute, adminSpaceReadManyController);

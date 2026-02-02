import { OpenAPIHono } from '@hono/zod-openapi';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

import { adminOrganizationReadManyController } from '#/modules/organization/controllers/adminOrganizationReadMany';
import { adminOrganizationReadManyRoute } from '#/modules/organization/routes/adminOrganizationReadMany';

import { organizationCreateRoute } from '#/modules/organization/routes/organizationCreate';
import { organizationCreateTokenRoute } from '#/modules/organization/routes/organizationCreateToken';
import { organizationCreateOrganizationUserRoute } from '#/modules/organization/routes/organizationCreateOrganizationUser';
import { organizationCreateWebhookSubscriptionRoute } from '#/modules/organization/routes/organizationCreateWebhookSubscription';
import { organizationDeleteRoute } from '#/modules/organization/routes/organizationDelete';
import { organizationReadRoute } from '#/modules/organization/routes/organizationRead';
import { organizationReadProtectedRoute } from '#/modules/organization/routes/organizationReadProtected';
import { organizationReadManyUsersRoute } from '#/modules/organization/routes/organizationReadManyUsers';
import { organizationReadManyTokenRoute } from '#/modules/organization/routes/organizationReadManyToken';
import { organizationReadManySpaceRoute } from '#/modules/organization/routes/organizationReadManySpace';
import { organizationReadManyWebhookSubscriptionRoute } from '#/modules/organization/routes/organizationReadManyWebhookSubscription';
import { organizationUpdateRoute } from '#/modules/organization/routes/organizationUpdate';

import { organizationCreateController } from '#/modules/organization/controllers/organizationCreate';
import { organizationCreateTokenController } from '#/modules/organization/controllers/organizationCreateToken';
import { organizationCreateOrganizationUserController } from '#/modules/organization/controllers/organizationCreateOrganizationUser';
import { organizationCreateWebhookSubscriptionController } from '#/modules/organization/controllers/organizationCreateWebhookSubscription';
import { organizationDeleteController } from '#/modules/organization/controllers/organizationDelete';
import { organizationReadController } from '#/modules/organization/controllers/organizationRead';
import { organizationReadProtectedController } from '#/modules/organization/controllers/organizationReadProtected';
import { organizationReadManyUsersController } from '#/modules/organization/controllers/organizationReadManyUsers';
import { organizationReadManyTokenController } from '#/modules/organization/controllers/organizationReadManyToken';
import { organizationReadManySpaceController } from '#/modules/organization/controllers/organizationReadManySpace';
import { organizationReadManyWebhookSubscriptionController } from '#/modules/organization/controllers/organizationReadManyWebhookSubscription';
import { organizationUpdateController } from '#/modules/organization/controllers/organizationUpdate';

export const organizationRouter = new OpenAPIHono<AppEnv>();

organizationRouter.use('*', validateActor);

organizationRouter.openapi(organizationCreateRoute, organizationCreateController);
organizationRouter.openapi(organizationReadRoute, organizationReadController);
organizationRouter.openapi(organizationReadProtectedRoute, organizationReadProtectedController);
organizationRouter.openapi(organizationUpdateRoute, organizationUpdateController);
organizationRouter.openapi(organizationDeleteRoute, organizationDeleteController);
organizationRouter.openapi(organizationCreateTokenRoute, organizationCreateTokenController);
organizationRouter.openapi(organizationReadManyTokenRoute, organizationReadManyTokenController);
organizationRouter.openapi(organizationCreateWebhookSubscriptionRoute, organizationCreateWebhookSubscriptionController);
organizationRouter.openapi(organizationReadManyWebhookSubscriptionRoute, organizationReadManyWebhookSubscriptionController);
organizationRouter.openapi(organizationCreateOrganizationUserRoute, organizationCreateOrganizationUserController);
organizationRouter.openapi(organizationReadManyUsersRoute, organizationReadManyUsersController);
organizationRouter.openapi(organizationReadManySpaceRoute, organizationReadManySpaceController);

export const adminOrganizationRouter = new OpenAPIHono<AppEnv>();

adminOrganizationRouter.openapi(adminOrganizationReadManyRoute, adminOrganizationReadManyController);

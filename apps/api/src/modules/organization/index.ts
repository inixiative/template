import { OpenAPIHono } from '@hono/zod-openapi';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

import { adminOrganizationReadManyController } from '#/modules/organization/controllers/adminOrganizationReadMany';
import { adminOrganizationReadManyRoute } from '#/modules/organization/routes/adminOrganizationReadMany';

import { organizationCreateRoute } from '#/modules/organization/routes/organizationCreate';
import { organizationCreateTokenRoute } from '#/modules/organization/routes/organizationCreateToken';
import { organizationCreateUserRoute } from '#/modules/organization/routes/organizationCreateUser';
import { organizationDeleteRoute } from '#/modules/organization/routes/organizationDelete';
import { organizationReadRoute } from '#/modules/organization/routes/organizationRead';
import { organizationReadManyOrganizationUserRoute } from '#/modules/organization/routes/organizationReadManyOrganizationUser';
import { organizationReadManyTokenRoute } from '#/modules/organization/routes/organizationReadManyToken';
import { organizationUpdateRoute } from '#/modules/organization/routes/organizationUpdate';

import { organizationCreateController } from '#/modules/organization/controllers/organizationCreate';
import { organizationCreateTokenController } from '#/modules/organization/controllers/organizationCreateToken';
import { organizationCreateUserController } from '#/modules/organization/controllers/organizationCreateUser';
import { organizationDeleteController } from '#/modules/organization/controllers/organizationDelete';
import { organizationReadController } from '#/modules/organization/controllers/organizationRead';
import { organizationReadManyOrganizationUserController } from '#/modules/organization/controllers/organizationReadManyOrganizationUser';
import { organizationReadManyTokenController } from '#/modules/organization/controllers/organizationReadManyToken';
import { organizationUpdateController } from '#/modules/organization/controllers/organizationUpdate';

export const organizationRouter = new OpenAPIHono<AppEnv>();

organizationRouter.use('*', validateActor);

organizationRouter.openapi(organizationCreateRoute, organizationCreateController);
organizationRouter.openapi(organizationReadRoute, organizationReadController);
organizationRouter.openapi(organizationUpdateRoute, organizationUpdateController);
organizationRouter.openapi(organizationDeleteRoute, organizationDeleteController);
organizationRouter.openapi(organizationCreateTokenRoute, organizationCreateTokenController);
organizationRouter.openapi(organizationReadManyTokenRoute, organizationReadManyTokenController);
organizationRouter.openapi(organizationCreateUserRoute, organizationCreateUserController);
organizationRouter.openapi(organizationReadManyOrganizationUserRoute, organizationReadManyOrganizationUserController);

export const adminOrganizationRouter = new OpenAPIHono<AppEnv>();

adminOrganizationRouter.openapi(adminOrganizationReadManyRoute, adminOrganizationReadManyController);

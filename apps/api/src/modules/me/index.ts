import { OpenAPIHono } from '@hono/zod-openapi';
import { validateUser } from '#/middleware/validations/validateUser';
import type { AppEnv } from '#/types/appEnv';

import { meCreateTokenRoute } from '#/modules/me/routes/meCreateToken';
import { meReadRoute } from '#/modules/me/routes/meRead';
import { meReadManyOrganizationRoute } from '#/modules/me/routes/meReadManyOrganization';
import { meReadManyTokenRoute } from '#/modules/me/routes/meReadManyToken';

import { meCreateTokenController } from '#/modules/me/controllers/meCreateToken';
import { meReadController } from '#/modules/me/controllers/meRead';
import { meReadManyOrganizationController } from '#/modules/me/controllers/meReadManyOrganization';
import { meReadManyTokenController } from '#/modules/me/controllers/meReadManyToken';

export const meRouter = new OpenAPIHono<AppEnv>();

meRouter.use('*', validateUser);

meRouter.openapi(meReadRoute, meReadController);
meRouter.openapi(meReadManyOrganizationRoute, meReadManyOrganizationController);
meRouter.openapi(meReadManyTokenRoute, meReadManyTokenController);
meRouter.openapi(meCreateTokenRoute, meCreateTokenController);

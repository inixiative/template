import { OpenAPIHono } from '@hono/zod-openapi';
import { validateUser } from '#/middleware/validations/validateUser';
import type { AppEnv } from '#/types/appEnv';

import { meCreateTokenRoute } from '#/modules/me/routes/meCreateToken';
import { meCreateWebhookSubscriptionRoute } from '#/modules/me/routes/meCreateWebhookSubscription';
import { meReadRoute } from '#/modules/me/routes/meRead';
import { meReadManyOrganizationRoute } from '#/modules/me/routes/meReadManyOrganization';
import { meReadManyProviderRoute } from '#/modules/me/routes/meReadManyProvider';
import { meReadManySpaceRoute } from '#/modules/me/routes/meReadManySpace';
import { meReadManyTokenRoute } from '#/modules/me/routes/meReadManyToken';
import { meReadManyWebhookSubscriptionRoute } from '#/modules/me/routes/meReadManyWebhookSubscription';
import { meRedactRoute } from '#/modules/me/routes/meRedact';

import { meCreateTokenController } from '#/modules/me/controllers/meCreateToken';
import { meCreateWebhookSubscriptionController } from '#/modules/me/controllers/meCreateWebhookSubscription';
import { meReadController } from '#/modules/me/controllers/meRead';
import { meReadManyOrganizationController } from '#/modules/me/controllers/meReadManyOrganization';
import { meReadManyProviderController } from '#/modules/me/controllers/meReadManyProvider';
import { meReadManySpaceController } from '#/modules/me/controllers/meReadManySpace';
import { meReadManyTokenController } from '#/modules/me/controllers/meReadManyToken';
import { meReadManyWebhookSubscriptionController } from '#/modules/me/controllers/meReadManyWebhookSubscription';
import { meRedactController } from '#/modules/me/controllers/meRedact';

export const meRouter = new OpenAPIHono<AppEnv>();

meRouter.use('*', validateUser);

meRouter.openapi(meReadRoute, meReadController);
meRouter.openapi(meReadManyOrganizationRoute, meReadManyOrganizationController);
meRouter.openapi(meReadManySpaceRoute, meReadManySpaceController);
meRouter.openapi(meReadManyProviderRoute, meReadManyProviderController);
meRouter.openapi(meReadManyTokenRoute, meReadManyTokenController);
meRouter.openapi(meReadManyWebhookSubscriptionRoute, meReadManyWebhookSubscriptionController);
meRouter.openapi(meCreateTokenRoute, meCreateTokenController);
meRouter.openapi(meCreateWebhookSubscriptionRoute, meCreateWebhookSubscriptionController);
meRouter.openapi(meRedactRoute, meRedactController);

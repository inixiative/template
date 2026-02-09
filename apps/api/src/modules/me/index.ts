import { OpenAPIHono } from '@hono/zod-openapi';
import { validateUser } from '#/middleware/validations/validateUser';
import { meCreateTokenController } from '#/modules/me/controllers/meCreateToken';
import { meCreateWebhookSubscriptionController } from '#/modules/me/controllers/meCreateWebhookSubscription';
import { meReadController } from '#/modules/me/controllers/meRead';
import { meReadManyOrganizationsController } from '#/modules/me/controllers/meReadManyOrganizations';
import { meReadManyProvidersController } from '#/modules/me/controllers/meReadManyProviders';
import { meReadManySpacesController } from '#/modules/me/controllers/meReadManySpaces';
import { meReadManyTokensController } from '#/modules/me/controllers/meReadManyTokens';
import { meReadManyWebhookSubscriptionsController } from '#/modules/me/controllers/meReadManyWebhookSubscriptions';
import { meRedactController } from '#/modules/me/controllers/meRedact';
import { meCreateTokenRoute } from '#/modules/me/routes/meCreateToken';
import { meCreateWebhookSubscriptionRoute } from '#/modules/me/routes/meCreateWebhookSubscription';
import { meReadRoute } from '#/modules/me/routes/meRead';
import { meReadManyOrganizationsRoute } from '#/modules/me/routes/meReadManyOrganizations';
import { meReadManyProvidersRoute } from '#/modules/me/routes/meReadManyProviders';
import { meReadManySpacesRoute } from '#/modules/me/routes/meReadManySpaces';
import { meReadManyTokensRoute } from '#/modules/me/routes/meReadManyTokens';
import { meReadManyWebhookSubscriptionsRoute } from '#/modules/me/routes/meReadManyWebhookSubscriptions';
import { meRedactRoute } from '#/modules/me/routes/meRedact';
import type { AppEnv } from '#/types/appEnv';

export const meRouter = new OpenAPIHono<AppEnv>();

meRouter.use('*', validateUser);

meRouter.openapi(meReadRoute, meReadController);
meRouter.openapi(meReadManyOrganizationsRoute, meReadManyOrganizationsController);
meRouter.openapi(meReadManySpacesRoute, meReadManySpacesController);
meRouter.openapi(meReadManyProvidersRoute, meReadManyProvidersController);
meRouter.openapi(meReadManyTokensRoute, meReadManyTokensController);
meRouter.openapi(meReadManyWebhookSubscriptionsRoute, meReadManyWebhookSubscriptionsController);
meRouter.openapi(meCreateTokenRoute, meCreateTokenController);
meRouter.openapi(meCreateWebhookSubscriptionRoute, meCreateWebhookSubscriptionController);
meRouter.openapi(meRedactRoute, meRedactController);

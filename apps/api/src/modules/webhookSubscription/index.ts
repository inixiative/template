import { OpenAPIHono } from '@hono/zod-openapi';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

import { adminWebhookSubscriptionReadManyController } from '#/modules/webhookSubscription/controllers/adminWebhookSubscriptionReadMany';
import { webhookSubscriptionDeleteController } from '#/modules/webhookSubscription/controllers/webhookSubscriptionDelete';
import { webhookSubscriptionInfoController } from '#/modules/webhookSubscription/controllers/webhookSubscriptionInfo';
import { webhookSubscriptionReadController } from '#/modules/webhookSubscription/controllers/webhookSubscriptionRead';
import { webhookSubscriptionUpdateController } from '#/modules/webhookSubscription/controllers/webhookSubscriptionUpdate';

import { adminWebhookSubscriptionReadManyRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionReadMany';
import { webhookSubscriptionDeleteRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionDelete';
import { webhookSubscriptionInfoRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionInfo';
import { webhookSubscriptionReadRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionRead';
import { webhookSubscriptionUpdateRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionUpdate';

export const webhookSubscriptionRouter = new OpenAPIHono<AppEnv>();

// Public route (no auth)
webhookSubscriptionRouter.openapi(webhookSubscriptionInfoRoute, webhookSubscriptionInfoController);

// Protected routes (create via /me or /organization submodels)
webhookSubscriptionRouter.use('*', validateActor);
webhookSubscriptionRouter.openapi(webhookSubscriptionReadRoute, webhookSubscriptionReadController);
webhookSubscriptionRouter.openapi(webhookSubscriptionUpdateRoute, webhookSubscriptionUpdateController);
webhookSubscriptionRouter.openapi(webhookSubscriptionDeleteRoute, webhookSubscriptionDeleteController);

// Admin router
export const adminWebhookSubscriptionRouter = new OpenAPIHono<AppEnv>();
adminWebhookSubscriptionRouter.openapi(adminWebhookSubscriptionReadManyRoute, adminWebhookSubscriptionReadManyController);

import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import { webhookSubscriptionInfoController } from '#/modules/webhookSubscription/controllers/webhookSubscriptionInfo';
import { webhookSubscriptionInfoRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionInfo';
import type { AppEnv } from '#/types/appEnv';

export const webhookSubscriptionRouter = new OpenAPIHono<AppEnv>();

// Public route (no auth)
webhookSubscriptionRouter.openapi(webhookSubscriptionInfoRoute, webhookSubscriptionInfoController);

// Protected routes (create via /me or /organization submodels)
webhookSubscriptionRouter.use('*', validateActor);

await autoRegisterRoutes(webhookSubscriptionRouter, import.meta.dirname, { skip: ['webhookSubscriptionInfo'] });

export const adminWebhookSubscriptionRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminWebhookSubscriptionRouter, import.meta.dirname);

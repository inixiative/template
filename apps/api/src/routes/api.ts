/**
 * @atlas
 * @kind route
 * @uses feature:auth, feature:contact, feature:inquiry, feature:segment, feature:tenancy, feature:users, feature:webhooks, primitive:batch, primitive:flows
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { auth } from '#/lib/auth';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { jwtAuthMiddleware } from '#/middleware/auth/jwtAuthMiddleware';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { corsMiddleware } from '#/middleware/corsMiddleware';
import { prepareRequestMiddleware } from '#/middleware/prepareRequestMiddleware';
import { apiRateLimit } from '#/middleware/rateLimit/apiRateLimit';
import { authRateLimit } from '#/middleware/rateLimit/authRateLimit';
import { authProviderRouter } from '#/modules/authProvider';
import { batchRouter } from '#/modules/batch';
import { billingAccountRouter } from '#/modules/billingAccount';
import { billingResourceRouter } from '#/modules/billingResource';
import { contactRouter } from '#/modules/contact';
import { flowRouter } from '#/modules/flow';
import { identifyRouter } from '#/modules/identify';
import { inquiryRouter } from '#/modules/inquiry';
import { integrationRouter } from '#/modules/integration';
import { integrationResourceRouter } from '#/modules/integrationResource';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { projectRouter } from '#/modules/project';
import { projectIntegrationRouter } from '#/modules/projectIntegration';
import { segmentRouter } from '#/modules/segment';
import { settingRouter } from '#/modules/setting';
import { spaceRouter } from '#/modules/space';
import { spaceUserRouter } from '#/modules/spaceUser';
import { tokenRouter } from '#/modules/token';
import { userRouter } from '#/modules/user';
import { webhookSubscriptionRouter } from '#/modules/webhookSubscription';
import { adminRouter } from '#/routes/admin';
import { billingWebhooksRouter } from '#/routes/billingWebhooks';
import { browserTelemetryRouter } from '#/routes/browserTelemetry';
import { internalRouter } from '#/routes/internal';
import { unsubscribeRouter } from '#/routes/unsubscribe';
import type { AppEnv } from '#/types/appEnv';

export const apiRouter = new OpenAPIHono<AppEnv>();

// Middleware (order matters)
apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequestMiddleware);
apiRouter.route('/telemetry/browser', browserTelemetryRouter);

// Internal service-to-service routes (shared-secret auth). Mounted BEFORE
// the better-auth middlewares so the secret check in internalRouter is the
// only auth gate — internal callers carry no JWT or token.
apiRouter.route('/internal', internalRouter);

// Auth routes (better-auth handles its own auth, returns early)
apiRouter.use('/auth/*', authRateLimit);
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));

// One-click unsubscribe — public (no JWT or token); authorized by its own signed link.
apiRouter.route('/unsubscribe', unsubscribeRouter);
apiRouter.route('/webhooks/billing', billingWebhooksRouter);

// A user presents a JWT, a program an API token; sessions never reach past /auth.
// Spoof runs last so it applies whichever credential resolved the user.
apiRouter.use('*', jwtAuthMiddleware);
apiRouter.use('*', tokenAuthMiddleware);
apiRouter.use('*', spoofMiddleware);
apiRouter.use('*', auditActorMiddleware);
apiRouter.use('*', apiRateLimit);

// Admin Routes (superadmin only - see routes/admin.ts)
apiRouter.route('/admin', adminRouter);

// v1 Routes
apiRouter.route('/v1/authProvider', authProviderRouter);
apiRouter.route('/v1/batch', batchRouter);
apiRouter.route('/v1/contact', contactRouter);
apiRouter.route('/v1/flow', flowRouter);
apiRouter.route('/v1/identify', identifyRouter);
apiRouter.route('/v1/integration', integrationRouter);
apiRouter.route('/v1/me', meRouter);
apiRouter.route('/v1/organization', organizationRouter);
apiRouter.route('/v1/organizationUser', organizationUserRouter);
apiRouter.route('/v1/segment', segmentRouter);
apiRouter.route('/v1/space', spaceRouter);
apiRouter.route('/v1/spaceUser', spaceUserRouter);
apiRouter.route('/v1/token', tokenRouter);
apiRouter.route('/v1/user', userRouter);
apiRouter.route('/v1/inquiry', inquiryRouter);
apiRouter.route('/v1/webhookSubscription', webhookSubscriptionRouter);
apiRouter.route('/v1/project', projectRouter);
apiRouter.route('/v1/integrationResource', integrationResourceRouter);
apiRouter.route('/v1/projectIntegration', projectIntegrationRouter);
apiRouter.route('/v1/setting', settingRouter);
apiRouter.route('/v1/billingAccount', billingAccountRouter);
apiRouter.route('/v1/billingResource', billingResourceRouter);

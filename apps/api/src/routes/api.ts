/**
 * @atlas
 * @kind route
 * @uses feature:auth, feature:contact, feature:inquiry, feature:tenancy, feature:users, feature:webhooks, primitive:batch
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { auth } from '#/lib/auth';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { authMiddleware } from '#/middleware/auth/authMiddleware';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { corsMiddleware } from '#/middleware/corsMiddleware';
import { prepareRequest } from '#/middleware/prepareRequest';
import { authProviderRouter } from '#/modules/authProvider';
import { batchRouter } from '#/modules/batch';
import { contactRouter } from '#/modules/contact';
import { inquiryRouter } from '#/modules/inquiry';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { spaceRouter } from '#/modules/space';
import { spaceUserRouter } from '#/modules/spaceUser';
import { tokenRouter } from '#/modules/token';
import { webhookSubscriptionRouter } from '#/modules/webhookSubscription';
import { adminRouter } from '#/routes/admin';
import { internalRouter } from '#/routes/internal';
import { unsubscribeRouter } from '#/routes/unsubscribe';
import type { AppEnv } from '#/types/appEnv';

export const apiRouter = new OpenAPIHono<AppEnv>();

// Middleware (order matters)
apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);

// Internal service-to-service routes (shared-secret auth). Mounted BEFORE
// the better-auth middlewares so the secret check in internalRouter is the
// only auth gate — internal callers don't have user sessions or tokens.
apiRouter.route('/internal', internalRouter);

// Auth routes (better-auth handles its own auth, returns early)
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));

// One-click unsubscribe — public (no session/token); authorized by its own signed link.
apiRouter.route('/unsubscribe', unsubscribeRouter);

// Token first so an Authorization header always wins over a session cookie when
// both are present (e.g. SDK xhr from a browser). Spoof runs last so it applies
// regardless of which auth path resolved the user.
apiRouter.use('*', tokenAuthMiddleware);
apiRouter.use('*', authMiddleware);
apiRouter.use('*', spoofMiddleware);
apiRouter.use('*', auditActorMiddleware);

// Admin Routes (superadmin only - see routes/admin.ts)
apiRouter.route('/admin', adminRouter);

// v1 Routes
apiRouter.route('/v1/authProvider', authProviderRouter);
apiRouter.route('/v1/batch', batchRouter);
apiRouter.route('/v1/contact', contactRouter);
apiRouter.route('/v1/me', meRouter);
apiRouter.route('/v1/organization', organizationRouter);
apiRouter.route('/v1/organizationUser', organizationUserRouter);
apiRouter.route('/v1/space', spaceRouter);
apiRouter.route('/v1/spaceUser', spaceUserRouter);
apiRouter.route('/v1/token', tokenRouter);
apiRouter.route('/v1/inquiry', inquiryRouter);
apiRouter.route('/v1/webhookSubscription', webhookSubscriptionRouter);

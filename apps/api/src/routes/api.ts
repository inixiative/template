import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '#/middleware/auth/authMiddleware';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { corsMiddleware } from '#/middleware/corsMiddleware';
import { prepareRequest } from '#/middleware/prepareRequest';
import type { AppEnv } from '#/types/appEnv';

import { batchRouter } from '#/modules/batch';
import { inquiryRouter } from '#/modules/inquiry';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { spaceRouter } from '#/modules/space';
import { spaceUserRouter } from '#/modules/spaceUser';
import { tokenRouter } from '#/modules/token';
import { webhookSubscriptionRouter } from '#/modules/webhookSubscription';
import { adminRouter } from '#/routes/admin';

export const apiRouter = new OpenAPIHono<AppEnv>();

// Middleware (order matters)
apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);
apiRouter.use('*', authMiddleware);
apiRouter.use('*', spoofMiddleware);
apiRouter.use('*', tokenAuthMiddleware);

// Admin Routes (superadmin only - see routes/admin.ts)
apiRouter.route('/admin', adminRouter);

// v1 Routes
apiRouter.route('/v1/batch', batchRouter);
apiRouter.route('/v1/me', meRouter);
apiRouter.route('/v1/organization', organizationRouter);
apiRouter.route('/v1/organizationUser', organizationUserRouter);
apiRouter.route('/v1/space', spaceRouter);
apiRouter.route('/v1/spaceUser', spaceUserRouter);
apiRouter.route('/v1/token', tokenRouter);
apiRouter.route('/v1/inquiry', inquiryRouter);
apiRouter.route('/v1/webhookSubscription', webhookSubscriptionRouter);

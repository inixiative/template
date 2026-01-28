import { OpenAPIHono } from '@hono/zod-openapi';
import { validateSuperadmin } from '#/middleware/validations/validateSuperadmin';
import type { AppEnv } from '#/types/appEnv';

import { adminCacheRouter } from '#/modules/admin/cache';
import { adminCronJobRouter } from '#/modules/admin/cronJob';
import { adminJobRouter } from '#/modules/admin/job';
import { adminInquiryRouter } from '#/modules/inquiry';
import { adminOrganizationRouter } from '#/modules/organization';
import { adminWebhookSubscriptionRouter } from '#/modules/webhookSubscription';

export const adminRouter = new OpenAPIHono<AppEnv>();

adminRouter.use('*', validateSuperadmin);

adminRouter.route('/cache', adminCacheRouter);
adminRouter.route('/cronJob', adminCronJobRouter);
adminRouter.route('/job', adminJobRouter);
adminRouter.route('/inquiry', adminInquiryRouter);
adminRouter.route('/organization', adminOrganizationRouter);
adminRouter.route('/webhookSubscription', adminWebhookSubscriptionRouter);

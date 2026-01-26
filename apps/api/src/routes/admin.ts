import { OpenAPIHono } from '@hono/zod-openapi';
import { validateSuperadmin } from '#/middleware/validations/validateSuperadmin';
import type { AppEnv } from '#/types/appEnv';

import { cronJobRouter } from '#/modules/admin/cronJob';
import { adminInquiryRouter } from '#/modules/inquiry';
import { adminOrganizationRouter } from '#/modules/organization';

export const adminRouter = new OpenAPIHono<AppEnv>();

adminRouter.use('*', validateSuperadmin);

adminRouter.route('/cronJob', cronJobRouter);
adminRouter.route('/inquiry', adminInquiryRouter);
adminRouter.route('/organization', adminOrganizationRouter);
